import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ShieldAlert, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/features/i18n/I18nProvider'
import { mfaApi } from './api'
import { MFA_STATUS_KEY } from './queryKeys'

const DISMISS_STORAGE_KEY = 'mfa-enrollment-banner-dismissed'

interface Props {
  /** Opens the page where two-step verification is set up. */
  onSetUp: () => void
}

/** Warns someone, before their deadline, that their organisation requires
 *  two-step verification -- so the first they hear of it is not a sign-in that
 *  will not finish until they enroll. Who is required (builder staff only) and
 *  by when is entirely the engine's answer in /mfa/status; this only shows it.
 *
 *  Once the deadline has passed, a session that is still open gets the same
 *  reminder, worded for what happens next: the next sign-in will insist. */
export function MfaEnrollmentBanner({ onSetUp }: Props) {
  const { t, locale } = useI18n()
  const status = useQuery({
    queryKey: MFA_STATUS_KEY,
    queryFn: mfaApi.status,
    // Changes only when the user enrolls (which invalidates this key) or an
    // admin changes policy -- not worth a request on every navigation.
    staleTime: 5 * 60 * 1000,
    // An engine without two-step verification answers 404, which is an answer.
    retry: false,
  })
  const [dismissedFor, setDismissedFor] = useState(readDismissed)

  const s = status.data
  if (!s || s.enrolled || !s.required) return null

  // Remembered per deadline and for this browser session only: a new deadline,
  // or the next session, brings the reminder back.
  const dismissToken = s.enrollment_deadline ?? 'now'
  if (dismissedFor === dismissToken) return null

  const message =
    s.blocking || !s.enrollment_deadline
      ? `${t('mfa.required_now')} ${t('mfa.banner_next_signin')}`
      : t('mfa.required_by').replace('{date}', new Date(s.enrollment_deadline).toLocaleDateString(locale))

  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 border-b border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning))]/10 px-4 py-2 text-[12px] font-medium text-[hsl(var(--warning))]"
    >
      <span className="flex min-w-0 items-center gap-2">
        <ShieldAlert size={14} className="shrink-0" />
        {message}
      </span>
      <span className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost" size="sm" className="h-6 px-2 text-[11px] text-[hsl(var(--warning))] hover:bg-[hsl(var(--warning))]/10"
          onClick={onSetUp}
        >
          {t('mfa.banner_set_up')}
        </Button>
        <Button
          variant="ghost" size="icon" className="h-6 w-6 text-[hsl(var(--warning))] hover:bg-[hsl(var(--warning))]/10"
          aria-label={t('mfa.banner_dismiss')} title={t('mfa.banner_dismiss')}
          onClick={() => {
            writeDismissed(dismissToken)
            setDismissedFor(dismissToken)
          }}
        >
          <X size={12} />
        </Button>
      </span>
    </div>
  )
}

// sessionStorage can be missing or throw (private windows, blocked storage).
// The banner still works then; it just cannot remember being dismissed.
function readDismissed(): string | null {
  try {
    return sessionStorage.getItem(DISMISS_STORAGE_KEY)
  } catch {
    return null
  }
}

function writeDismissed(token: string) {
  try {
    sessionStorage.setItem(DISMISS_STORAGE_KEY, token)
  } catch {
    // Not remembered; dismissed for this render only.
  }
}
