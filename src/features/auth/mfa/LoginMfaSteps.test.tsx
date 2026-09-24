// @vitest-environment jsdom
//
// The sign-in challenge used to show "That code was not accepted. Check your
// authenticator app and try again." for ANY failure. After a lockout that is
// actively misleading: the challenge is spent and no code can work for fifteen
// minutes. These pin what each engine status now produces on screen.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HTTPError } from 'ky'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import { en } from '@/features/i18n/locales/en'
import { MfaChallengeCard, MfaEnrollDuringLogin } from './LoginMfaSteps'

// The trust-device control is a Radix Checkbox, which measures itself with
// ResizeObserver; jsdom has none. Same stub the chart and combobox tests use.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
;(globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver = ResizeObserverStub

const verifyMock = vi.fn()
const startEnrollmentMock = vi.fn()
vi.mock('./api', () => ({
  mfaApi: {
    verify: (...args: unknown[]) => verifyMock(...args),
    startEnrollmentDuringLogin: (...args: unknown[]) => startEnrollmentMock(...args),
  },
}))

afterEach(() => {
  cleanup()
  verifyMock.mockReset()
  startEnrollmentMock.mockReset()
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

// Enrolling at a blocked sign-in is the one place a user sets up two-step
// verification without a session, so the verify response that finally issues
// one is the only time the new recovery codes exist in plaintext. Before this,
// the login page went straight on and nobody ever saw them.
describe('MfaEnrollDuringLogin recovery codes', () => {
  function renderEnrollment() {
    startEnrollmentMock.mockResolvedValue({
      secret: 'JBSWY3DPEHPK3PXP',
      otpauth_uri: 'otpauth://totp/Test:someone@example.test?secret=JBSWY3DPEHPK3PXP&issuer=Test',
      digits: 6,
      period_secs: 30,
    })
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    const onVerified = vi.fn()
    render(
      <QueryClientProvider client={client}>
        <I18nProvider>
          <MfaEnrollDuringLogin
            challenge={{ mfa_required: true, mfa_token: 'enroll-token', purpose: 'enroll', methods: [] }}
            onVerified={onVerified}
            onCancel={vi.fn()}
          />
        </I18nProvider>
      </QueryClientProvider>,
    )
    return { onVerified }
  }

  async function finishSetup() {
    const field = await screen.findByLabelText(en['mfa.enter_code_to_confirm'])
    fireEvent.change(field, { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: en['mfa.finish_setup'] }))
  }

  it('shows the codes the engine returns, and only goes on once they are saved', async () => {
    verifyMock.mockResolvedValue({ user: { id: 'u1' }, recovery_codes: ['AAAAA-BBBBB-CCCCC', 'DDDDD-EEEEE-FFFFF'] })
    const { onVerified } = renderEnrollment()

    await finishSetup()

    expect(await screen.findByText('AAAAA-BBBBB-CCCCC')).toBeTruthy()
    expect(screen.getByText('DDDDD-EEEEE-FFFFF')).toBeTruthy()
    // The session exists already, but going on now would lose the codes.
    expect(onVerified).not.toHaveBeenCalled()
    // Nothing to go "back" to: the sign-in this page was completing is done.
    expect(screen.queryByRole('button', { name: en['mfa.back_to_sign_in'] })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: en['mfa.saved_them'] }))
    expect(onVerified).toHaveBeenCalledTimes(1)
  })

  it('goes straight on when there are no codes to show', async () => {
    // What an engine from before this change answers: the session, nothing else.
    verifyMock.mockResolvedValue({ user: { id: 'u1' } })
    const { onVerified } = renderEnrollment()

    await finishSetup()

    await waitFor(() => expect(onVerified).toHaveBeenCalledTimes(1))
    expect(screen.queryByText(en['mfa.save_recovery_codes'])).toBeNull()
  })
})

// Recovery codes are shown as four groups of four; the field says so.
describe('MfaChallengeCard recovery-code field', () => {
  it('shows the recovery-code format the codes are actually issued in', () => {
    renderChallenge(['totp', 'recovery_code'])
    fireEvent.click(screen.getByRole('button', { name: en['mfa.use_recovery_code_instead'] }))
    expect(screen.getByLabelText(en['mfa.recovery_code']).getAttribute('placeholder')).toBe('XXXX-XXXX-XXXX-XXXX')
  })
})
