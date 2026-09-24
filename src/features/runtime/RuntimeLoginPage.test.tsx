// @vitest-environment jsdom
//
// The published-app sign-in used to navigate into the app the moment the
// password call returned 200 -- including when the engine answered with an
// MFA challenge and no session. An enrolled user arrived unauthenticated and
// was bounced straight back to this page with no explanation. These pin that
// a challenge now gets the same second step the builder's login shows.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import { en } from '@/features/i18n/locales/en'
import { RuntimeLoginPage } from './RuntimeLoginPage'

// The trust-device control is a Radix Checkbox, which measures itself with
// ResizeObserver; jsdom has none.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
;(globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver = ResizeObserverStub

const loginMock = vi.fn()
const meMock = vi.fn()
const verifyMock = vi.fn()
const startEnrollMock = vi.fn()
const navigateMock = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ clientId: 'client-1', appId: 'app-1' }),
  useSearch: () => ({}),
}))
// The real runtime router pulls in the whole runtime app; the page only needs
// its navigate.
vi.mock('@/runtime-router', () => ({
  runtimeRouter: { navigate: (...args: unknown[]) => navigateMock(...args) },
}))
vi.mock('@/features/auth/api', () => ({
  authApi: {
    login: (...args: unknown[]) => loginMock(...args),
    me: (...args: unknown[]) => meMock(...args),
  },
}))
// Keep isMfaChallenge real -- the page's decision is exactly what is under
// test -- and fake only the network calls.
vi.mock('@/features/auth/mfa/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/auth/mfa/api')>()),
  mfaApi: {
    verify: (...args: unknown[]) => verifyMock(...args),
    startEnrollmentDuringLogin: (...args: unknown[]) => startEnrollMock(...args),
  },
}))

afterEach(() => {
  cleanup()
  for (const m of [loginMock, meMock, verifyMock, startEnrollMock, navigateMock]) m.mockReset()
})

const ME = { user_id: 'user-1', email: 'staff@example.test', memberships: [] }

function challenge(purpose: 'verify' | 'enroll') {
  return { mfa_required: true, mfa_token: 'challenge-token', purpose, methods: ['totp'] }
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <RuntimeLoginPage />
      </I18nProvider>
    </QueryClientProvider>,
  )
}

function signIn() {
  fireEvent.change(screen.getByLabelText(en['auth.email']), { target: { value: 'staff@example.test' } })
  fireEvent.change(screen.getByLabelText(en['auth.password']), { target: { value: 'Correct-Horse-1' } })
  fireEvent.click(screen.getByRole('button', { name: en['auth.sign_in'] }))
}

describe('RuntimeLoginPage', () => {
  it('still goes straight into the app on an ordinary sign-in', async () => {
    loginMock.mockResolvedValue({ user: { id: 'user-1' } })
    meMock.mockResolvedValue(ME)
    renderPage()

    signIn()

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith({ to: '/client-1/app-1' }))
  })

  it('shows the code step on an MFA challenge instead of entering the app without a session', async () => {
    loginMock.mockResolvedValue(challenge('verify'))
    renderPage()

    signIn()

    expect(await screen.findByText(en['mfa.challenge_title'])).toBeTruthy()
    expect(navigateMock).not.toHaveBeenCalled()
    // No session exists yet, so it must not be looked up.
    expect(meMock).not.toHaveBeenCalled()
  })

  it('enters the app once the code is accepted, after loading the new session', async () => {
    loginMock.mockResolvedValue(challenge('verify'))
    verifyMock.mockResolvedValue({ user: { id: 'user-1' } })
    meMock.mockResolvedValue(ME)
    renderPage()

    signIn()
    fireEvent.change(await screen.findByLabelText(en['mfa.code']), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: en['mfa.verify'] }))

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith({ to: '/client-1/app-1' }))
    expect(verifyMock).toHaveBeenCalledWith('challenge-token', '123456', false)
    expect(meMock).toHaveBeenCalled()
  })

  it('shows the setup step when the policy requires enrolling first', async () => {
    loginMock.mockResolvedValue(challenge('enroll'))
    startEnrollMock.mockResolvedValue({
      secret: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',
      otpauth_uri: 'otpauth://totp/Test:staff@example.test?secret=GEZDGNBVGY3TQOJQ',
      digits: 6,
      period_secs: 30,
    })
    renderPage()

    signIn()

    expect(await screen.findByText(en['mfa.enroll_required_title'])).toBeTruthy()
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('goes back to the password form from the code step', async () => {
    loginMock.mockResolvedValue(challenge('verify'))
    renderPage()

    signIn()
    fireEvent.click(await screen.findByRole('button', { name: en['mfa.back_to_sign_in'] }))

    expect(await screen.findByLabelText(en['auth.password'])).toBeTruthy()
    expect(navigateMock).not.toHaveBeenCalled()
  })
})
