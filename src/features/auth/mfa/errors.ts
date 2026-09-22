import { HTTPError } from 'ky'

/** How an MFA request failed, read from the HTTP status the engine answers
 *  with. The engine's own table is internal/auth/mfa/errors.go; this mirrors
 *  it. The UI keys its copy off the status rather than the server's message,
 *  which is English and written for logs, not for people. */
export type MfaFailure =
  /** 400. A wrong code, a spent recovery code, an expired or dead sign-in
   *  challenge. The engine makes these deliberately indistinguishable, so the
   *  UI cannot and should not tell them apart either. */
  | 'invalid_code'
  /** 429. The factor is locked after repeated wrong codes. The lock lasts
   *  LockWindow (15 minutes, internal/auth/mfa/store.go) -- keep the copy in
   *  step if that changes. Limen's own rate limiter also answers 429, with a
   *  shorter window; saying 15 minutes over-states that rare case rather than
   *  under-stating the common one. */
  | 'too_many_attempts'
  /** 409. "Already on" or "not on", depending on the screen. */
  | 'conflict'
  /** 5xx. Ours, not the user's -- never reported as a wrong code. */
  | 'server'
  /** No HTTP response at all: offline, DNS, an aborted request. */
  | 'network'

export function mfaFailure(error: unknown): MfaFailure {
  if (!(error instanceof HTTPError)) return 'network'
  const { status } = error.response
  if (status === 429) return 'too_many_attempts'
  if (status === 409) return 'conflict'
  if (status >= 500) return 'server'
  return 'invalid_code'
}
