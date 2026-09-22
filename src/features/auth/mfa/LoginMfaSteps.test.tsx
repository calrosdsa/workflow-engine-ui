// @vitest-environment jsdom
//
// The sign-in challenge used to show "That code was not accepted. Check your
// authenticator app and try again." for ANY failure. After a lockout that is
// actively misleading: the challenge is spent and no code can work for fifteen
// minutes. These pin what each engine status now produces on screen.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HTTPError } from 'ky'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import { en } from '@/features/i18n/locales/en'
import { MfaChallengeCard } from './LoginMfaSteps'

// The trust-device control is a Radix Checkbox, which measures itself with
// ResizeObserver; jsdom has none. Same stub the chart and combobox tests use.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
;(globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver = ResizeObserverStub

const verifyMock = vi.fn()
vi.mock('./api', () => ({
  mfaApi: { verify: (...args: unknown[]) => verifyMock(...args) },
}))

afterEach(() => {
  cleanup()
  verifyMock.mockReset()
})

function httpError(status: number): HTTPError {
  return new HTTPError(new Response('{}', { status }), new Request('http://t/api/auth/mfa/verify'), {} as never)
}

function renderChallenge(methods: string[] = ['totp', 'recovery_code']) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const onVerified = vi.fn()
  const onCancel = vi.fn()
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <MfaChallengeCard
          challenge={{ mfa_required: true, mfa_token: 'challenge-token', purpose: 'verify', methods }}
          onVerified={onVerified}
          onCancel={onCancel}
        />
      </I18nProvider>
    </QueryClientProvider>,
  )
  return { onVerified, onCancel }
}

async function submitCode(code = '123456') {
  fireEvent.change(screen.getByLabelText(en['mfa.code']), { target: { value: code } })
  fireEvent.click(screen.getByRole('button', { name: en['mfa.verify'] }))
  return screen.findByRole('alert')
}

describe('MfaChallengeCard error states', () => {
  it('on a lockout, says so instead of "check your app and try again"', async () => {
    verifyMock.mockRejectedValue(httpError(429))
    renderChallenge()

    const alert = await submitCode()

    expect(alert.textContent).toContain(en['mfa.too_many_attempts'])
    expect(alert.textContent).not.toContain(en['mfa.invalid_code'])
  })

  it('on a lockout, offers the recovery-code route when codes remain', async () => {
    verifyMock.mockRejectedValue(httpError(429))
    renderChallenge(['totp', 'recovery_code'])

    const alert = await submitCode()

    expect(alert.textContent).toContain(en['mfa.too_many_attempts_recovery_signin'])
  })

  it('on a lockout, does not suggest recovery codes the user no longer has', async () => {
    verifyMock.mockRejectedValue(httpError(429))
    // The engine lists 'recovery_code' only while unused codes remain.
    renderChallenge(['totp'])

    const alert = await submitCode()

    expect(alert.textContent).toContain(en['mfa.too_many_attempts'])
    expect(alert.textContent).not.toContain(en['mfa.too_many_attempts_recovery_signin'])
  })

  it('on a lockout, closes the spent challenge and makes going back the primary action', async () => {
    verifyMock.mockRejectedValue(httpError(429))
    const { onCancel } = renderChallenge()

    await submitCode()

    // The challenge's attempts are spent, so any further code would be refused
    // as invalid: the field closes rather than inviting a more confusing error.
    expect(screen.getByLabelText(en['mfa.code'])).toHaveProperty('disabled', true)
    expect(screen.queryByRole('button', { name: en['mfa.verify'] })).toBeNull()
    expect(screen.queryByRole('button', { name: en['mfa.use_recovery_code_instead'] })).toBeNull()

    const back = screen.getAllByRole('button', { name: en['mfa.back_to_sign_in'] })
    expect(back).toHaveLength(1)
    fireEvent.click(back[0])
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('on a wrong code, keeps the form open to try again', async () => {
    verifyMock.mockRejectedValue(httpError(400))
    renderChallenge()

    const alert = await submitCode()

    expect(alert.textContent).toBe(en['mfa.invalid_code'])
    expect(screen.getByLabelText(en['mfa.code'])).toHaveProperty('disabled', false)
    expect(screen.getByRole('button', { name: en['mfa.verify'] })).toBeTruthy()
  })

  it('on a server fault, does not blame the code', async () => {
    verifyMock.mockRejectedValue(httpError(500))
    renderChallenge()

    const alert = await submitCode()

    expect(alert.textContent).toBe(en['mfa.server_error'])
  })

  it('when the server cannot be reached, says so', async () => {
    verifyMock.mockRejectedValue(new TypeError('Failed to fetch'))
    renderChallenge()

    const alert = await submitCode()

    expect(alert.textContent).toBe(en['mfa.network_error'])
  })
})
