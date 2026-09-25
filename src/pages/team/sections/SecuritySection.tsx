import { useEffect, useState, type ReactNode } from 'react'
import { HTTPError } from 'ky'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { mfaApi, ORG_MFA_MAX_GRACE_DAYS } from '@/features/auth/mfa/api'
import { parseGraceDays, previewDeadline } from '@/features/auth/mfa/orgPolicy'
import { MFA_STATUS_KEY, orgMfaPolicyKey } from '@/features/auth/mfa/queryKeys'
import { useAuthStore } from '@/stores/auth'
import { useI18n, useTranslation } from '@/features/i18n/I18nProvider'

const DEFAULT_GRACE_DAYS = 7

interface Props {
  /** Opens Account security, for an admin who has not set up two-step yet. */
  onSetUpOwn?: () => void
}

/** The organisation's own two-step verification rule (Team > Security).
 *
 *  The engine decides everything that matters -- who may change it, where the
 *  grace period starts, what gets audited; this shows its answer and says,
 *  before anyone saves, when the change would bite: a grace period counts from
 *  when the organisation first required it, so shortening one can put the
 *  deadline in the past, and that is confirmed first. */
export function SecuritySection({ onSetUpOwn }: Props) {
  const t = useTranslation()
  const { locale } = useI18n()
  const qc = useQueryClient()
  const clientId = useAuthStore((s) => s.activeMembership?.client_id)
  // Super Admin of the organisation this page is for. isSuperAdmin() would say
  // yes for a Super Admin of any organisation, while the request goes to the
  // active one.
  const isAdminHere = useAuthStore((s) =>
    (s.session?.memberships ?? []).some(
      (m) => m.client_id === s.activeMembership?.client_id && m.permissions.includes('*'),
    ),
  )

  const policy = useQuery({
    queryKey: orgMfaPolicyKey(clientId),
    queryFn: mfaApi.orgPolicy,
    enabled: isAdminHere && !!clientId,
    retry: false,
  })
  const ownStatus = useQuery({
    queryKey: MFA_STATUS_KEY,
    queryFn: mfaApi.status,
    enabled: isAdminHere,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  const [required, setRequired] = useState(false)
  const [graceText, setGraceText] = useState(String(DEFAULT_GRACE_DAYS))
  const [confirming, setConfirming] = useState(false)

  // The form starts from what the engine holds, and follows it after a save.
  useEffect(() => {
    if (!policy.data) return
    setRequired(policy.data.required)
    setGraceText(String(policy.data.grace_days ?? DEFAULT_GRACE_DAYS))
  }, [policy.data])

  const graceDays = parseGraceDays(graceText)

  const save = useMutation({
    mutationFn: () => mfaApi.setOrgPolicy(required, graceDays ?? 0),
    onSuccess: (next) => {
      qc.setQueryData(orgMfaPolicyKey(clientId), next)
      // The admin's own requirement may have changed with it: the reminder
      // banner reads this.
      void qc.invalidateQueries({ queryKey: MFA_STATUS_KEY })
    },
  })

  if (!isAdminHere) {
    return (
      <Layout t={t}>
        <p role="alert" className="text-sm text-[hsl(var(--muted-foreground))]">{t('team.security_forbidden')}</p>
      </Layout>
    )
  }
  if (policy.isPending) {
    return (
      <Layout t={t}>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{t('common.loading')}</p>
      </Layout>
    )
  }
  if (policy.isError || !policy.data) {
    const forbidden = policy.error instanceof HTTPError && policy.error.response.status === 403
    return (
      <Layout t={t}>
        <p role="alert" className="text-sm text-[hsl(var(--destructive))]">
          {t(forbidden ? 'team.security_forbidden' : 'team.security_load_failed')}
        </p>
        {!forbidden && (
          <Button variant="outline" size="sm" onClick={() => void policy.refetch()}>
            {t('team.security_retry')}
          </Button>
        )}
      </Layout>
    )
  }

  const current = policy.data
  const dirty = required !== current.required || (required && graceDays !== current.grace_days)
  const deadline = required && graceDays !== null ? previewDeadline(current, graceDays, new Date()) : null
  const immediate = deadline !== null && deadline.getTime() <= Date.now()

  const submit = () => {
    save.reset()
    if (required && immediate) {
      setConfirming(true)
      return
    }
    save.mutate()
  }

  return (
    <Layout t={t}>
      {current.platform_required && (
        <p role="note" className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 py-2 text-sm">
          {t('team.security_platform_required')}
        </p>
      )}

      <div className="flex items-center justify-between gap-4 rounded-md border border-[hsl(var(--border))] px-3 py-2">
        <label htmlFor="org-mfa-required" className="text-sm font-medium text-[hsl(var(--foreground))]">
          {t('team.security_require')}
        </label>
        <Switch
          id="org-mfa-required"
          checked={required}
          onCheckedChange={(v) => {
            setRequired(v)
            save.reset()
          }}
        />
      </div>

      {required && (
        <div>
          <label htmlFor="org-mfa-grace" className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">
            {t('team.security_grace_label')}
          </label>
          <Input
            id="org-mfa-grace"
            type="number"
            inputMode="numeric"
            min={0}
            max={ORG_MFA_MAX_GRACE_DAYS}
            value={graceText}
            onChange={(e) => {
              setGraceText(e.target.value)
              save.reset()
            }}
            aria-invalid={graceDays === null}
            aria-describedby="org-mfa-grace-help"
            className="w-24"
          />
          <p
            id="org-mfa-grace-help"
            className={
              graceDays === null
                ? 'mt-1 text-[11px] text-[hsl(var(--destructive))]'
                : 'mt-1 text-[11px] text-[hsl(var(--muted-foreground))]'
            }
          >
            {graceDays === null
              ? t('team.security_grace_invalid', { max: ORG_MFA_MAX_GRACE_DAYS })
              : t('team.security_grace_help')}
          </p>
        </div>
      )}

      {deadline && (
        <p className="text-sm text-[hsl(var(--foreground))]">
          {immediate
            ? t('team.security_preview_now')
            : t('team.security_preview_by', { date: deadline.toLocaleDateString(locale) })}
        </p>
      )}

      {required && ownStatus.data && !ownStatus.data.enrolled && (
        <div role="note" className="flex flex-wrap items-center gap-2 text-sm text-[hsl(var(--foreground))]">
          <span>{t('team.security_self_not_enrolled')}</span>
          {onSetUpOwn && (
            <Button variant="link" size="sm" className="h-auto p-0" onClick={onSetUpOwn}>
              {t('team.security_set_up_yours')}
            </Button>
          )}
        </div>
      )}

      <p className="text-xs text-[hsl(var(--muted-foreground))]">{t('team.security_scope_note')}</p>

      <div className="flex items-center gap-3">
        <Button onClick={submit} disabled={!dirty || (required && graceDays === null) || save.isPending}>
          {t('common.save')}
        </Button>
        {save.isSuccess && !dirty && <span className="text-xs text-[hsl(var(--success))]">{t('common.saved')}</span>}
      </div>
      {save.isError && (
        <p role="alert" className="text-sm text-[hsl(var(--destructive))]">{t(saveErrorKey(save.error))}</p>
      )}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('team.security_confirm_now_title')}
        description={t('team.security_confirm_now_description')}
        confirmLabel={t('team.security_confirm_now_confirm')}
        loading={save.isPending}
        onConfirm={async () => {
          try {
            await save.mutateAsync()
          } catch {
            // Shown under the Save button by the isError branch above.
          } finally {
            setConfirming(false)
          }
        }}
      />
    </Layout>
  )
}

function Layout({ t, children }: { t: (key: string) => string; children: ReactNode }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-xl space-y-5 p-6">
        <div>
          <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">{t('team.security_two_step_title')}</h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{t('team.security_two_step_description')}</p>
        </div>
        {children}
      </div>
    </div>
  )
}

// Each refusal means something different to the admin, so each gets its own words.
function saveErrorKey(err: unknown): string {
  if (err instanceof HTTPError) {
    switch (err.response.status) {
      case 403:
        return 'team.security_forbidden'
      case 400:
        return 'team.security_grace_rejected'
    }
  }
  return 'team.security_save_failed'
}
