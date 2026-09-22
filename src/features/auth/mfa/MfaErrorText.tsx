import { mfaFailure } from './errors'
import { useTranslation } from '@/features/i18n/I18nProvider'

interface Props {
  error: unknown
  /** i18n key appended after the lockout message, naming a way through that
   *  works on this screen right now (a recovery code). Omit it when the user
   *  has none left, or cannot use one here. */
  lockedHintKey?: string
  /** Copy for a 409, which means "already on" or "not on" depending on the
   *  screen. */
  conflictKey?: string
  /** Copy for a 400 on this screen. */
  invalidKey?: string
}

/** The one place a failed MFA request becomes a sentence.
 *
 *  Before it, every MFA screen showed "That code was not accepted. Check your
 *  authenticator app and try again." for any failure at all -- including a
 *  lockout, where trying again cannot work for fifteen minutes, and a server
 *  fault, which was never the user's code. The engine now answers each case
 *  with its own status (internal/auth/mfa/errors.go); this reads it. */
export function MfaErrorText({
  error,
  lockedHintKey,
  conflictKey = 'mfa.invalid_code',
  invalidKey = 'mfa.invalid_code',
}: Props) {
  const t = useTranslation()

  let message: string
  switch (mfaFailure(error)) {
    case 'too_many_attempts':
      message = lockedHintKey ? `${t('mfa.too_many_attempts')} ${t(lockedHintKey)}` : t('mfa.too_many_attempts')
      break
    case 'conflict':
      message = t(conflictKey)
      break
    case 'server':
      message = t('mfa.server_error')
      break
    case 'network':
      message = t('mfa.network_error')
      break
    default:
      message = t(invalidKey)
  }

  // role="alert" so a screen reader announces the failure when it appears; the
  // sighted cue is a red line under the field, which is easy to miss.
  return (
    <p role="alert" className="text-xs text-destructive">
      {message}
    </p>
  )
}
