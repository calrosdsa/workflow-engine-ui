// @vitest-environment jsdom
//
// Account security was the other place a lockout read as "that code was not
// accepted". Unlike sign-in, a recovery code works in the same field straight
// away here -- the engine's recovery-code path ignores the lock and clears it --
// so the message should say so, but only when the user has codes left.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HTTPError } from 'ky'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import { en } from '@/features/i18n/locales/en'
import { SecurityPage } from './SecurityPage'

const statusMock = vi.fn()
const disableMock = vi.fn()
const startEnrollmentMock = vi.fn()
const confirmEnrollmentMock = vi.fn()
const listDevicesMock = vi.fn()
vi.mock('./api', () => ({
  mfaApi: {
    status: (...args: unknown[]) => statusMock(...args),
    disable: (...args: unknown[]) => disableMock(...args),
    listDevices: (...args: unknown[]) => listDevicesMock(...args),
    regenerateRecoveryCodes: vi.fn(),
    startEnrollment: (...args: unknown[]) => startEnrollmentMock(...args),
    confirmEnrollment: (...args: unknown[]) => confirmEnrollmentMock(...args),
    revokeDevice: vi.fn(),
    revokeAllDevices: vi.fn(),
  },
}))

beforeEach(() => {
  // Most tests here are about other cards; an empty device list keeps the
  // devices query resolving to a real value.
  listDevicesMock.mockResolvedValue({ devices: [] })
})

afterEach(() => {
  cleanup()
  statusMock.mockReset()
  disableMock.mockReset()
  startEnrollmentMock.mockReset()
  confirmEnrollmentMock.mockReset()
  listDevicesMock.mockReset()
})

function httpError(status: number): HTTPError {
  return new HTTPError(new Response('{}', { status }), new Request('http://t/api/auth/mfa/disable'), {} as never)
}

async function renderEnrolled(recoveryCodesRemaining: number) {
  statusMock.mockResolvedValue({
    enrolled: true,
    required: false,
    blocking: false,
    recovery_codes_remaining: recoveryCodesRemaining,
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <SecurityPage />
      </I18nProvider>
    </QueryClientProvider>,
  )
  await screen.findByRole('button', { name: en['mfa.disable'] })
}

// Both enrolled-card forms label their input "Code", so reach the disable one
// by id rather than by an ambiguous label.
async function submitDisable(code = '123456') {
  const input = document.getElementById('disable-code')
  if (!input) throw new Error('disable-code input not rendered')
  fireEvent.change(input, { target: { value: code } })
  fireEvent.click(screen.getByRole('button', { name: en['mfa.disable'] }))
  return screen.findByRole('alert')
}

describe('SecurityPage disable error states', () => {
  it('on a lockout, says so and points at the recovery codes the user still has', async () => {
    disableMock.mockRejectedValue(httpError(429))
    await renderEnrolled(5)

    const alert = await submitDisable()

    expect(alert.textContent).toContain(en['mfa.too_many_attempts'])
    expect(alert.textContent).toContain(en['mfa.too_many_attempts_recovery'])
    expect(alert.textContent).not.toContain(en['mfa.invalid_code'])
  })

  it('on a lockout with no recovery codes left, does not suggest using one', async () => {
    disableMock.mockRejectedValue(httpError(429))
    await renderEnrolled(0)

    const alert = await submitDisable()

    expect(alert.textContent).toContain(en['mfa.too_many_attempts'])
    expect(alert.textContent).not.toContain(en['mfa.too_many_attempts_recovery'])
  })

  it('keeps the field open after a lockout, because a recovery code works in it', async () => {
    disableMock.mockRejectedValue(httpError(429))
    await renderEnrolled(5)

    await submitDisable()

    expect(document.getElementById('disable-code')).toHaveProperty('disabled', false)
  })

  it('on a wrong code, shows the plain wrong-code message', async () => {
    disableMock.mockRejectedValue(httpError(400))
    await renderEnrolled(5)

    const alert = await submitDisable()

    expect(alert.textContent).toBe(en['mfa.invalid_code'])
  })

  it('on a 409, says MFA is not on rather than blaming the code', async () => {
    disableMock.mockRejectedValue(httpError(409))
    await renderEnrolled(5)

    const alert = await submitDisable()

    expect(alert.textContent).toBe(en['mfa.not_enabled'])
  })
})

// Finishing setup refreshes the status, and the refreshed status ("enrolled")
// swaps the setup card for the enrolled one. The new recovery codes used to
// live in the setup card, so they went with it: in a real browser nobody who
// enrolled on this page ever saw them, though they are the only plaintext copy.
// This drives exactly that sequence.
describe('SecurityPage enrollment', () => {
  it('keeps showing the new recovery codes after the status flips to enrolled', async () => {
    statusMock
      .mockResolvedValueOnce({ enrolled: false, required: false, blocking: false, recovery_codes_remaining: 0 })
      .mockResolvedValue({ enrolled: true, required: false, blocking: false, recovery_codes_remaining: 10 })
    startEnrollmentMock.mockResolvedValue({
      secret: 'JBSWY3DPEHPK3PXP',
      otpauth_uri: 'otpauth://totp/Test:someone@example.test?secret=JBSWY3DPEHPK3PXP&issuer=Test',
      digits: 6,
      period_secs: 30,
    })
    confirmEnrollmentMock.mockResolvedValue({ recovery_codes: ['AAAAA-BBBBB-CCCCC-D', 'EEEEE-FFFFF-GGGGG-H'] })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <I18nProvider>
          <SecurityPage />
        </I18nProvider>
      </QueryClientProvider>,
    )

    fireEvent.click(await screen.findByRole('button', { name: en['mfa.begin_setup'] }))
    fireEvent.change(await screen.findByLabelText(en['mfa.enter_code_to_confirm']), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: en['mfa.finish_setup'] }))

    // Let the status refetch that finishing setup triggers land and re-render.
    await waitFor(() => expect(statusMock).toHaveBeenCalledTimes(2))
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(screen.getByText('AAAAA-BBBBB-CCCCC-D')).toBeTruthy()
    expect(screen.getByText('EEEEE-FFFFF-GGGGG-H')).toBeTruthy()

    // Once saved, the page shows the enrolled state.
    fireEvent.click(screen.getByRole('button', { name: en['mfa.saved_them'] }))
    expect(await screen.findByRole('button', { name: en['mfa.disable'] })).toBeTruthy()
    expect(screen.queryByText('AAAAA-BBBBB-CCCCC-D')).toBeNull()
  })
})

// Trusted devices used to be listed by their raw User-Agent, cut at 120
// characters. The engine still stores the raw value; the page names it.
describe('SecurityPage trusted devices', () => {
  it('names a device by browser and system, keeping the raw User-Agent to hand', async () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    listDevicesMock.mockResolvedValue({
      devices: [{ id: 'd1', label: ua, created_at: '', last_seen_at: '', expires_at: '2026-10-24T00:00:00Z' }],
    })
    await renderEnrolled(10)

    const name = await screen.findByText('Chrome on Windows')
    expect(name.getAttribute('title')).toBe(ua)
    expect(screen.queryByText(ua)).toBeNull()
  })
})
