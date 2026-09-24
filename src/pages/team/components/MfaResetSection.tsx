import { useState } from 'react'
import { HTTPError } from 'ky'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useResetUserMfa } from '@/features/users/hooks'
import type { TeamUser } from '@/features/users/types'
import { useAuthStore } from '@/stores/auth'
import { useTranslation } from '@/features/i18n/I18nProvider'

interface Props {
  user: TeamUser
}

/** A member's two-step verification, and -- for a Super Admin looking at
 *  someone else -- the way back for a member who has lost both their
 *  authenticator and their recovery codes. Before this, that took a database
 *  edit.
 *
 *  The reset is its own action, confirmed on the spot, never part of the
 *  drawer's Save: it takes effect at once and cannot be undone from here. The
 *  engine decides whether it is allowed (the caller must run every organisation
 *  the member belongs to); this only maps its answer to words. */
export function MfaResetSection({ user }: Props) {
  const t = useTranslation()
  const currentUserId = useAuthStore((s) => s.session?.user_id)
  const reset = useResetUserMfa()
  const [confirming, setConfirming] = useState(false)
  // The drawer holds a snapshot of the member; after a reset this is the truth.
  const [wasReset, setWasReset] = useState(false)

  // An engine that does not report it: say nothing rather than guess "off".
  if (user.mfa_enabled === undefined) return null

  const enabled = user.mfa_enabled && !wasReset
  // Your own is changed from Account security, which asks for a code.
  const canReset = enabled && user.id !== currentUserId

  return (
    <div>
      <p className="mb-2 text-xs font-medium text-[hsl(var(--muted-foreground))]">{t('team.two_step')}</p>
      <div className="flex items-center justify-between gap-2 rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-sm">
        <Badge variant={enabled ? 'success' : 'secondary'}>
          {enabled ? t('team.two_step_on') : t('team.two_step_off')}
        </Badge>
        {canReset && (
          <Button
            variant="outline" size="sm" className="h-7 text-xs"
            onClick={() => {
              reset.reset()
              setConfirming(true)
            }}
          >
            {t('team.two_step_reset')}
          </Button>
        )}
      </div>

      {wasReset && (
        <p className="mt-1 text-xs text-[hsl(var(--success))]">{t('team.two_step_reset_done', { email: user.email })}</p>
      )}
      {reset.isError && (
        <p role="alert" className="mt-1 text-xs text-[hsl(var(--destructive))]">{t(resetErrorKey(reset.error))}</p>
      )}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('team.two_step_reset_title')}
        description={t('team.two_step_reset_description', { email: user.email })}
        confirmLabel={t('team.two_step_reset')}
        destructive
        loading={reset.isPending}
        onConfirm={async () => {
          try {
            await reset.mutateAsync(user.id)
            setWasReset(true)
          } catch {
            // Shown under the status by the isError branch above.
          } finally {
            setConfirming(false)
          }
        }}
      />
    </div>
  )
}

// Each refusal the engine can give means something different to the admin, so
// each gets its own words rather than one "failed".
function resetErrorKey(err: unknown): string {
  if (err instanceof HTTPError) {
    switch (err.response.status) {
      case 403:
        return 'team.two_step_reset_forbidden'
      case 404:
        return 'team.two_step_reset_not_found'
      case 409:
        return 'team.two_step_reset_already_off'
    }
  }
  return 'team.two_step_reset_failed'
}
