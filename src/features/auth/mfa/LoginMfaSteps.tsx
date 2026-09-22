import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { mfaApi, type MfaChallenge } from './api'
import { mfaFailure } from './errors'
import { MfaErrorText } from './MfaErrorText'
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

  // A lockout ends this challenge. The engine caps a challenge at five
  // attempts and the lock lands on the fifth, so any further code here is
  // refused as invalid -- keeping the field open would only produce a more
  // confusing error. The way forward is a fresh sign-in, where a recovery code
  // works: using one clears the lock.
  const locked = verify.isError && mfaFailure(verify.error) === 'too_many_attempts'

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
              disabled={locked}
            />
          </div>

          <div className="flex items-start gap-2">
            <Checkbox
              id="mfa-trust-device"
              checked={trustDevice}
              onCheckedChange={(checked) => setTrustDevice(checked === true)}
              disabled={locked}
            />
            <div className="space-y-0.5">
              <Label htmlFor="mfa-trust-device" className="font-normal">
                {t('mfa.trust_device')}
              </Label>
              <p className="text-xs text-muted-foreground">{t('mfa.trust_device_hint')}</p>
            </div>
          </div>

          {verify.isError && (
            <MfaErrorText
              error={verify.error}
              // Only offer the recovery-code route when the engine says codes
              // remain -- the challenge lists 'recovery_code' only then.
              lockedHintKey={canUseRecoveryCode ? 'mfa.too_many_attempts_recovery_signin' : undefined}
            />
          )}

          {locked ? (
            // Once locked, going back is the only thing that can work, so it
            // becomes the primary action rather than a small link.
            <Button type="button" className="w-full" onClick={onCancel}>
              {t('mfa.back_to_sign_in')}
            </Button>
          ) : (
            <Button type="submit" className="w-full" disabled={verify.isPending || !code.trim()}>
              {verify.isPending ? t('mfa.verifying') : t('mfa.verify')}
            </Button>
          )}
        </form>

        {/* Hidden once locked: the recovery-code toggle cannot work on a spent
            challenge, and "back to sign in" is already the primary button. */}
        {!locked && (
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
        )}
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
        {start.isError && (
          // No code has been typed yet, so a 400 here can only mean the
          // sign-in challenge itself is dead (expired or spent): say that, not
          // "wrong code".
          <MfaErrorText error={start.error} invalidKey="mfa.signin_expired" conflictKey="mfa.already_enabled" />
        )}

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

              {/* No recovery-code hint: someone mid-enrollment has none yet. */}
              {confirm.isError && <MfaErrorText error={confirm.error} />}

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
