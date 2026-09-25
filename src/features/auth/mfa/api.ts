import { api } from '@/lib/api'
import type { User } from '../types'

// Route paths match internal/auth/mfa/plugin.go's RegisterRoutes, mounted under
// Limen's /auth base path plus the plugin's own /mfa base path.
export const mfaApi = {
  /** Completes a pending challenge. On success the engine issues the session
   *  that sign-in withheld, delivered as the same HttpOnly cookie an ordinary
   *  login would have set.
   *
   *  When the challenge was an enrollment (a sign-in held because setup was
   *  overdue), the response also carries the new recovery codes: this is the
   *  only time they exist in plaintext, so the caller must show them. */
  verify: (mfaToken: string, code: string, trustDevice: boolean) =>
    api
      .post('auth/mfa/verify', { json: { mfa_token: mfaToken, code, trust_device: trustDevice } })
      .json<{ user: User; recovery_codes?: string[] }>(),

  /** Starts enrollment for a login that is blocked on it. Authenticated by the
   *  challenge token, because the user has no session yet. */
  startEnrollmentDuringLogin: (mfaToken: string) =>
    api.post('auth/mfa/challenge/enroll', { json: { mfa_token: mfaToken } }).json<EnrollmentSecret>(),

  status: () => api.get('auth/mfa/status').json<MfaStatus>(),

  /** Starts voluntary enrollment for a signed-in user. */
  startEnrollment: () => api.post('auth/mfa/enroll').json<EnrollmentSecret>(),

  /** Confirms enrollment and returns the recovery codes, which are shown once
   *  and never retrievable again. */
  confirmEnrollment: (code: string) =>
    api.post('auth/mfa/enroll/confirm', { json: { code } }).json<{ recovery_codes: string[] }>(),

  disable: (code: string) => api.post('auth/mfa/disable', { json: { code } }).json<{ enrolled: boolean }>(),

  regenerateRecoveryCodes: (code: string) =>
    api.post('auth/mfa/recovery-codes', { json: { code } }).json<{ recovery_codes: string[] }>(),

  listDevices: () => api.get('auth/mfa/devices').json<{ devices: TrustedDevice[] }>(),

  revokeDevice: (deviceId: string) =>
    api.post('auth/mfa/devices/revoke', { json: { device_id: deviceId } }).json<{ revoked: number }>(),

  revokeAllDevices: () => api.post('auth/mfa/devices/revoke', { json: { all: true } }).json<{ revoked: number }>(),

  /** The active organisation's own rule (Team > Security). Super Admin only;
   *  the organisation is whichever one the client's tenant headers name. */
  orgPolicy: () => api.get('client/mfa-policy').json<OrgMfaPolicy>(),

  /** Sets the active organisation's own rule. A grace period is sent only with
   *  a requirement: the engine keeps none when nothing is required. */
  setOrgPolicy: (required: boolean, graceDays: number) =>
    api
      .put('client/mfa-policy', { json: required ? { required, grace_days: graceDays } : { required } })
      .json<OrgMfaPolicy>(),
}

export interface EnrollmentSecret {
  secret: string
  otpauth_uri: string
  digits: number
  period_secs: number
}

export interface MfaStatus {
  enrolled: boolean
  required: boolean
  /** True once the enrollment grace period has passed: the next sign-in will
   *  be held until a factor exists. */
  blocking: boolean
  recovery_codes_remaining: number
  enrollment_deadline?: string
}

/** An organisation's own two-step verification rule. The grace period, start
 *  and deadline are null when it requires nothing. */
export interface OrgMfaPolicy {
  required: boolean
  grace_days: number | null
  /** When the requirement started: the grace period counts from here, and a
   *  grace-only change does not move it. */
  required_since: string | null
  deadline: string | null
  /** MFA_POLICY already requires two-step platform-wide, which this rule
   *  cannot lift. */
  platform_required: boolean
}

/** Matches internal/auth/mfa.MaxGraceDays. */
export const ORG_MFA_MAX_GRACE_DAYS = 90

export interface TrustedDevice {
  id: string
  label: string
  created_at: string
  last_seen_at: string
  expires_at: string
}

/** What sign-in returns when a second factor is owed. The engine answers 200
 *  with no session rather than a 401: the password was correct, and the client
 *  is expected to continue the flow rather than treat it as a failed login. */
export interface MfaChallenge {
  mfa_required: true
  mfa_token: string
  purpose: 'verify' | 'enroll'
  methods: string[]
}

/** Narrows a sign-in response. A plain login returns { user }. */
export function isMfaChallenge(response: unknown): response is MfaChallenge {
  return (
    typeof response === 'object' &&
    response !== null &&
    (response as { mfa_required?: unknown }).mfa_required === true &&
    typeof (response as { mfa_token?: unknown }).mfa_token === 'string'
  )
}
