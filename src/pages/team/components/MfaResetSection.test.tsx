// @vitest-environment jsdom
//
// Before this there was no way back for a member who lost both their
// authenticator and their recovery codes short of editing the database. These
// pin who is offered the reset, what it asks first, and what each of the
// engine's refusals says.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HTTPError } from 'ky'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import { en } from '@/features/i18n/locales/en'
import { useAuthStore } from '@/stores/auth'
import type { TeamUser } from '@/features/users/types'
import { MfaResetSection } from './MfaResetSection'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
;(globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver = ResizeObserverStub

const resetMock = vi.fn()
vi.mock('@/features/users/api', () => ({
  usersApi: { resetMfa: (...args: unknown[]) => resetMock(...args) },
}))

const ME = 'user-me'

beforeEach(() => {
  useAuthStore.setState({ session: { user_id: ME, email: 'me@example.com', memberships: [] } })
})

afterEach(() => {
  cleanup()
  resetMock.mockReset()
  useAuthStore.setState({ session: null })
})

function member(overrides: Partial<TeamUser> = {}): TeamUser {
  return {
    id: 'user-them', email: 'them@example.com', first_name: 'Them', last_name: 'Person',
    status: 'active', is_super_admin: false, mfa_enabled: true, memberships: [], ...overrides,
  }
}

function renderSection(user: TeamUser) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <MfaResetSection user={user} />
      </I18nProvider>
    </QueryClientProvider>,
  )
}

function httpError(status: number): HTTPError {
  return new HTTPError(new Response('{}', { status }), new Request('http://t/api/users/x/mfa/reset'), {} as never)
}

async function confirmReset() {
  fireEvent.click(screen.getByRole('button', { name: en['team.two_step_reset'] }))
  const dialog = await screen.findByRole('dialog')
  // Asks before doing anything, and names who it is for.
  expect(dialog.textContent).toContain('them@example.com')
  expect(resetMock).not.toHaveBeenCalled()
  fireEvent.click(within(dialog).getByRole('button', { name: en['team.two_step_reset'] }))
}

describe('MfaResetSection', () => {
  it("resets someone else's two-step verification after confirming", async () => {
    resetMock.mockResolvedValue(new Response(null, { status: 204 }))
    renderSection(member())

    expect(screen.getByText(en['team.two_step_on'])).toBeTruthy()
    await confirmReset()

    expect(await screen.findByText(en['team.two_step_reset_done'].replace('{{email}}', 'them@example.com'))).toBeTruthy()
    expect(resetMock).toHaveBeenCalledWith('user-them')
    expect(screen.getByText(en['team.two_step_off'])).toBeTruthy()
    // Done is done: nothing left to reset.
    expect(screen.queryByRole('button', { name: en['team.two_step_reset'] })).toBeNull()
  })

  it('offers no reset for your own account -- Account security does that, with a code', () => {
    renderSection(member({ id: ME, email: 'me@example.com' }))
    expect(screen.getByText(en['team.two_step_on'])).toBeTruthy()
    expect(screen.queryByRole('button', { name: en['team.two_step_reset'] })).toBeNull()
  })

  it('offers no reset when it is already off', () => {
    renderSection(member({ mfa_enabled: false }))
    expect(screen.getByText(en['team.two_step_off'])).toBeTruthy()
    expect(screen.queryByRole('button', { name: en['team.two_step_reset'] })).toBeNull()
  })

  it('says nothing when the engine does not report it, rather than guessing "off"', () => {
    renderSection(member({ mfa_enabled: undefined }))
    expect(screen.queryByText(en['team.two_step'])).toBeNull()
  })

  it.each<[number, keyof typeof en]>([
    [403, 'team.two_step_reset_forbidden'],
    [404, 'team.two_step_reset_not_found'],
    [409, 'team.two_step_reset_already_off'],
    [500, 'team.two_step_reset_failed'],
  ])('explains a %i in its own words', async (status, key) => {
    resetMock.mockRejectedValue(httpError(status))
    renderSection(member())

    await confirmReset()

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe(en[key])
    // Nothing was reset, so it must not claim otherwise.
    expect(screen.queryByText(en['team.two_step_reset_done'].replace('{{email}}', 'them@example.com'))).toBeNull()
  })
})
