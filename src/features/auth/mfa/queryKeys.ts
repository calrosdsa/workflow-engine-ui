/** The one cache entry for the signed-in user's two-step verification status.
 *  The shell's reminder banner and the security page share it, so enrolling on
 *  that page clears the banner at once instead of after a reload. Kept out of
 *  ./api so tests that mock the API module wholesale still get a real key. */
export const MFA_STATUS_KEY = ['mfa', 'status'] as const
