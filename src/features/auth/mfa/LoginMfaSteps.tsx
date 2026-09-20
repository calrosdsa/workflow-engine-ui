import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { mfaApi, type MfaChallenge } from './api'
import { SecretKeyBlock } from './SecretKeyBlock'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useTranslation } from '@/features/i18n/I18nProvider'

interface Props {
  challenge: MfaChallenge
  /** Called once a session exists. */
  onVerified: () => void
  /** Abandons the challenge and returns to the password form. The challenge
   *  expires on its own; nothing needs revoking here. */
  onCancel: () => void
}

/** The second step of sign-in when the user already has a factor enrolled. */
export function MfaChallengeCard({ challenge, onVerified, onCancel }: Props) {
  const t = useTranslation()
  const [code, setCode] = useState('')
  const [trustDevice, setTrustDevice] = useState(false)
  const [useRecoveryCode, setUseRecoveryCode] = useState(false)

  const verify = useMutation({
    mutationFn: () => mfaApi.verify(challenge.mfa_token, code, trustDevice),
    onSuccess: onVerified,
  })

  const canUseRecoveryCode = challenge.methods.includes('recovery_code')

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{t('mfa.challenge_title')}</CardTitle>
        <CardDescription>
          {useRecoveryCode ? t('mfa.challenge_recovery_description') : t('mfa.challenge_description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (code.trim()) verify.mutate()
          }}
          className="space-y-4"
        >
          <div className="space-y-1">
            <Label htmlFor="mfa-code">
              {useRecoveryCode ? t('mfa.recovery_code') : t('mfa.code')}
            </Label>
            <Input
              id="mfa-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              // A 6-digit TOTP code is exactly what one-time-code autofill is
              // for: iOS and Android offer it straight from the clipboard or
              // the authenticator app.
              autoComplete={useRecoveryCode ? 'off' : 'one-time-code'}
              inputMode={useRecoveryCode ? 'text' : 'numeric'}
              placeholder={useRecoveryCode ? 'XXXXX-XXXXX-XXXXX' : '123456'}
            />
          </div>

          <div className="flex items-start gap-2">
            <Checkbox
              id="mfa-trust-device"
              checked={trustDevice}
              onCheckedChange={(checked) => setTrustDevice(checked === true)}
            />
            <div className="space-y-0.5">
              <Label htmlFor="mfa-trust-device" className="font-normal">
                {t('mfa.trust_device')}
              </Label>
              <p className="text-xs text-muted-foreground">{t('mfa.trust_device_hint')}</p>
            </div>
          </div>

          {verify.isError && <p className="text-xs text-destructive">{t('mfa.invalid_code')}</p>}

          <Button type="submit" className="w-full" disabled={verify.isPending || !code.trim()}>
            {verify.isPending ? t('mfa.verifying') : t('mfa.verify')}
          </Button>
        </form>

        <div className="flex items-center justify-between">
          {canUseRecoveryCode ? (
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 text-xs"
              onClick={() => {
                setUseRecoveryCode((v) => !v)
                setCode('')
                verify.reset()
              }}
            >
              {useRecoveryCode ? t('mfa.use_authenticator_instead') : t('mfa.use_recovery_code_instead')}
            </Button>
          ) : (
            <span />
          )}
          <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={onCancel}>
            {t('mfa.back_to_sign_in')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

/** The second step of sign-in when MFA is required and the user has nothing
 *  enrolled — the grace period has run out, so they enroll before they get in. */
export function MfaEnrollDuringLogin({ challenge, onVerified, onCancel }: Props) {
  const t = useTranslation()
  const [code, setCode] = useState('')

  const start = useMutation({ mutationFn: () => mfaApi.startEnrollmentDuringLogin(challenge.mfa_token) })
  const confirm = useMutation({
    mutationFn: () => mfaApi.verify(challenge.mfa_token, code, false),
    onSuccess: onVerified,
  })

  // Fetch the secret when this step mounts. In an effect rather than the render
  // body: mutate() sets state, and calling it during render is both a React
  // anti-pattern and a double-fire under StrictMode. React Query's mutate is
  // referentially stable, so depending on it runs this exactly once.
  const startEnrollment = start.mutate
  useEffect(() => {
    startEnrollment()
  }, [startEnrollment])

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{t('mfa.enroll_required_title')}</CardTitle>
        <CardDescription>{t('mfa.enroll_required_description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {start.isPending && <p className="text-sm text-muted-foreground">{t('mfa.loading_secret')}</p>}
        {start.isError && <p className="text-sm text-destructive">{t('mfa.enroll_start_failed')}</p>}

        {start.data && (
          <>
            <SecretKeyBlock secret={start.data.secret} otpauthUri={start.data.otpauth_uri} />

            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (code.trim()) confirm.mutate()
              }}
              className="space-y-4"
            >
              <div className="space-y-1">
                <Label htmlFor="mfa-enroll-code">{t('mfa.enter_code_to_confirm')}</Label>
                <Input
                  id="mfa-enroll-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  placeholder="123456"
                />
              </div>

              {confirm.isError && <p className="text-xs text-destructive">{t('mfa.invalid_code')}</p>}

              <Button type="submit" className="w-full" disabled={confirm.isPending || !code.trim()}>
                {confirm.isPending ? t('mfa.verifying') : t('mfa.finish_setup')}
              </Button>
            </form>
          </>
        )}

        <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={onCancel}>
          {t('mfa.back_to_sign_in')}
        </Button>
      </CardContent>
    </Card>
  )
}
