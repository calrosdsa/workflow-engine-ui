import { ORG_MFA_MAX_GRACE_DAYS, type OrgMfaPolicy } from './api'

/** A whole number of days within the engine's bounds, or null. */
export function parseGraceDays(text: string): number | null {
  if (!/^\d+$/.test(text.trim())) return null
  const n = Number(text.trim())
  return n <= ORG_MFA_MAX_GRACE_DAYS ? n : null
}

/** When set-up stops being skippable if this is saved. The grace period counts
 *  from when the organisation first required it (required_since), or from now
 *  for a rule that is only now becoming required -- the same arithmetic as the
 *  engine's deadlineFrom. */
export function previewDeadline(current: OrgMfaPolicy, graceDays: number, now: Date): Date {
  const start = current.required && current.required_since ? new Date(current.required_since) : now
  const deadline = new Date(start.getTime())
  if (graceDays > 0) deadline.setUTCDate(deadline.getUTCDate() + graceDays)
  return deadline
}
