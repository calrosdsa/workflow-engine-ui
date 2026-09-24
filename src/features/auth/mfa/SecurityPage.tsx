import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { mfaApi } from './api'
import { MfaErrorText } from './MfaErrorText'
import { SecretKeyBlock } from './SecretKeyBlock'
import { RecoveryCodesPanel } from './RecoveryCodesPanel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { MFA_STATUS_KEY } from './queryKeys'
import { describeDevice } from './deviceLabel'

// Shared with the shell's reminder banner: enrolling here must clear it.
const STATUS_KEY = MFA_STATUS_KEY
const DEVICES_KEY = ['mfa', 'devices']

/** Account security: enroll or remove a second factor, replace recovery codes,
 *  and review which devices are allowed to skip the challenge. */
export function SecurityPage() {
  const t = useTranslation()
  const status = useQuery({ queryKey: STATUS_KEY, queryFn: mfaApi.status })
  // Recovery codes from an enrollment that just finished. They live here, not
  // in EnrollCard: finishing setup refreshes the status, the fresh status says
  // "enrolled", and this page then swaps EnrollCard for EnrolledCard,
  // unmounting whatever EnrollCard held. Kept there, the codes -- the only
  // plaintext copy there will ever be -- vanished before anyone saw them.
  const [freshCodes, setFreshCodes] = useState<string[] | null>(null)

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('mfa.security_title')}</h1>
        <p className="text-sm text-muted-foreground">{t('mfa.security_description')}</p>
      </div>

      {status.isPending && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}
      {status.isError && <p className="text-sm text-destructive">{t('mfa.status_failed')}</p>}

      {freshCodes ? (
        <RecoveryCodesPanel codes={freshCodes} onDone={() => setFreshCodes(null)} />
      ) : (
        status.data && (
          <>
            {status.data.enrolled ? (
              <EnrolledCard remaining={status.data.recovery_codes_remaining} />
            ) : (
              <EnrollCard
                required={status.data.required}
                deadline={status.data.enrollment_deadline}
                onEnrolled={setFreshCodes}
              />
            )}
            {status.data.enrolled && <TrustedDevicesCard />}
          </>
        )
      )}
    </div>
  )
}

function EnrollCard({ required, deadline, onEnrolled }: {
  required: boolean
  deadline?: string
  /** Receives the new recovery codes; the page shows them (see freshCodes). */
  onEnrolled: (codes: string[]) => void
}) {
  const t = useTranslation()
  const qc = useQueryClient()
  const [code, setCode] = useState('')

  const start = useMutation({ mutationFn: mfaApi.startEnrollment })
  const confirm = useMutation({
    mutationFn: () => mfaApi.confirmEnrollment(code),
    onSuccess: (result) => {
      onEnrolled(result.recovery_codes)
      void qc.invalidateQueries({ queryKey: STATUS_KEY })
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('mfa.enroll_title')}</CardTitle>
        <CardDescription>{t('mfa.enroll_description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {required && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            {deadline
              ? t('mfa.required_by').replace('{date}', new Date(deadline).toLocaleDateString())
              : t('mfa.required_now')}
          </div>
        )}

        {!start.data && (
          <Button onClick={() => start.mutate()} disabled={start.isPending}>
            {start.isPending ? t('common.loading') : t('mfa.begin_setup')}
          </Button>
        )}
        {start.isError && (
          // A 409 here means MFA got turned on elsewhere (another tab) since
          // this page loaded.
          <MfaErrorText error={start.error} invalidKey="mfa.enroll_start_failed" conflictKey="mfa.already_enabled" />
        )}

        {start.data && (
          <>
            <SecretKeyBlock secret={start.data.secret} otpauthUri={start.data.otpauth_uri} />
            <Separator />
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (code.trim()) confirm.mutate()
              }}
              className="space-y-3"
            >
              <div className="space-y-1">
                <Label htmlFor="enroll-code">{t('mfa.enter_code_to_confirm')}</Label>
                <Input
                  id="enroll-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  placeholder="123456"
                />
              </div>
              {confirm.isError && <MfaErrorText error={confirm.error} conflictKey="mfa.already_enabled" />}
              <Button type="submit" disabled={confirm.isPending || !code.trim()}>
                {confirm.isPending ? t('mfa.verifying') : t('mfa.finish_setup')}
              </Button>
            </form>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function EnrolledCard({ remaining }: { remaining: number }) {
  const t = useTranslation()
  const qc = useQueryClient()
  const [disableCode, setDisableCode] = useState('')
  const [regenCode, setRegenCode] = useState('')
  const [codes, setCodes] = useState<string[] | null>(null)

  const disable = useMutation({
    mutationFn: () => mfaApi.disable(disableCode),
    onSuccess: () => {
      setDisableCode('')
      void qc.invalidateQueries({ queryKey: STATUS_KEY })
      void qc.invalidateQueries({ queryKey: DEVICES_KEY })
    },
  })
  const regenerate = useMutation({
    mutationFn: () => mfaApi.regenerateRecoveryCodes(regenCode),
    onSuccess: (result) => {
      setRegenCode('')
      setCodes(result.recovery_codes)
      void qc.invalidateQueries({ queryKey: STATUS_KEY })
    },
  })

  if (codes) {
    return <RecoveryCodesPanel codes={codes} onDone={() => setCodes(null)} />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {t('mfa.enrolled_title')}
          <Badge variant="secondary">{t('mfa.enabled')}</Badge>
        </CardTitle>
        <CardDescription>{t('mfa.enrolled_description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium">{t('mfa.recovery_codes')}</p>
          <p className="text-sm text-muted-foreground">
            {t('mfa.recovery_codes_remaining').replace('{count}', String(remaining))}
          </p>
          {remaining <= 2 && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              {t('mfa.recovery_codes_low')}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (regenCode.trim()) regenerate.mutate()
            }}
            className="flex items-end gap-2"
          >
            <div className="space-y-1">
              <Label htmlFor="regen-code">{t('mfa.code')}</Label>
              <Input
                id="regen-code"
                value={regenCode}
                onChange={(e) => setRegenCode(e.target.value)}
                autoComplete="one-time-code"
                inputMode="numeric"
                placeholder="123456"
                className="w-32"
              />
            </div>
            <Button type="submit" variant="outline" disabled={regenerate.isPending || !regenCode.trim()}>
              {t('mfa.regenerate_recovery_codes')}
            </Button>
          </form>
          {regenerate.isError && (
            <MfaErrorText
              error={regenerate.error}
              lockedHintKey={remaining > 0 ? 'mfa.too_many_attempts_recovery' : undefined}
              conflictKey="mfa.not_enabled"
            />
          )}
        </div>

        <Separator />

        <div className="space-y-2">
          <p className="text-sm font-medium">{t('mfa.disable_title')}</p>
          <p className="text-sm text-muted-foreground">{t('mfa.disable_description')}</p>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (disableCode.trim()) disable.mutate()
            }}
            className="flex items-end gap-2"
          >
            <div className="space-y-1">
              <Label htmlFor="disable-code">{t('mfa.code')}</Label>
              <Input
                id="disable-code"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value)}
                autoComplete="one-time-code"
                inputMode="numeric"
                placeholder="123456"
                className="w-32"
              />
            </div>
            <Button type="submit" variant="destructive" disabled={disable.isPending || !disableCode.trim()}>
              {t('mfa.disable')}
            </Button>
          </form>
          {disable.isError && (
            <MfaErrorText
              error={disable.error}
              // Here a recovery code works in this same field right away: the
              // engine's recovery-code path ignores the lock and clears it.
              lockedHintKey={remaining > 0 ? 'mfa.too_many_attempts_recovery' : undefined}
              conflictKey="mfa.not_enabled"
            />
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function TrustedDevicesCard() {
  const t = useTranslation()
  const qc = useQueryClient()
  const devices = useQuery({ queryKey: DEVICES_KEY, queryFn: mfaApi.listDevices })

  const revoke = useMutation({
    mutationFn: (deviceId: string) => mfaApi.revokeDevice(deviceId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: DEVICES_KEY }),
  })
  const revokeAll = useMutation({
    mutationFn: mfaApi.revokeAllDevices,
    onSuccess: () => void qc.invalidateQueries({ queryKey: DEVICES_KEY }),
  })

  const list = devices.data?.devices ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('mfa.devices_title')}</CardTitle>
        <CardDescription>{t('mfa.devices_description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {devices.isPending && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}
        {list.length === 0 && !devices.isPending && (
          <p className="text-sm text-muted-foreground">{t('mfa.no_trusted_devices')}</p>
        )}

        {list.map((device) => (
          <div key={device.id} className="flex items-start justify-between gap-4 rounded-md border p-3">
            <div className="min-w-0 space-y-0.5">
              {/* The engine stores the raw User-Agent; describe it in the reader's language,
                  keeping the raw value to hand for anyone who needs it. */}
              <p className="truncate text-sm font-medium" title={device.label}>{describeDevice(device.label, t)}</p>
              <p className="text-xs text-muted-foreground">
                {t('mfa.device_expires').replace('{date}', new Date(device.expires_at).toLocaleDateString())}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => revoke.mutate(device.id)}
              disabled={revoke.isPending}
            >
              {t('mfa.revoke')}
            </Button>
          </div>
        ))}

        {list.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => revokeAll.mutate()} disabled={revokeAll.isPending}>
            {t('mfa.revoke_all_devices')}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
