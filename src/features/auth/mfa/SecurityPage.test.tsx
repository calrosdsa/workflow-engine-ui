// @vitest-environment jsdom
//
// Account security was the other place a lockout read as "that code was not
// accepted". Unlike sign-in, a recovery code works in the same field straight
// away here -- the engine's recovery-code path ignores the lock and clears it --
// so the message should say so, but only when the user has codes left.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HTTPError } from 'ky'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import { en } from '@/features/i18n/locales/en'
import { SecurityPage } from './SecurityPage'

const statusMock = vi.fn()
const disableMock = vi.fn()
vi.mock('./api', () => ({
  mfaApi: {
    status: (...args: unknown[]) => statusMock(...args),
    disable: (...args: unknown[]) => disableMock(...args),
    listDevices: () => Promise.resolve({ devices: [] }),
    regenerateRecoveryCodes: vi.fn(),
    startEnrollment: vi.fn(),
    confirmEnrollment: vi.fn(),
    revokeDevice: vi.fn(),
    revokeAllDevices: vi.fn(),
  },
}))

afterEach(() => {
  cleanup()
  statusMock.mockReset()
  disableMock.mockReset()
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
