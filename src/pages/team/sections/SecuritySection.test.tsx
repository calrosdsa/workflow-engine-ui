// @vitest-environment jsdom
//
// The organisation's own two-step verification rule. These pin who sees it,
// what saving sends, and the one thing the page must never do quietly: put a
// deadline in the past, which makes everyone unenrolled set up two-step at
// their next sign-in.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HTTPError } from 'ky'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import { en } from '@/features/i18n/locales/en'
import { useAuthStore } from '@/stores/auth'
import type { Membership } from '@/features/auth/types'
import type { OrgMfaPolicy } from '@/features/auth/mfa/api'
import { parseGraceDays, previewDeadline } from '@/features/auth/mfa/orgPolicy'
import { SecuritySection } from './SecuritySection'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
;(globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver = ResizeObserverStub

const orgPolicyMock = vi.fn()
const setOrgPolicyMock = vi.fn()
const statusMock = vi.fn()
vi.mock('@/features/auth/mfa/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/auth/mfa/api')>()
  return {
    ...actual,
    mfaApi: {
      orgPolicy: (...args: unknown[]) => orgPolicyMock(...args),
      setOrgPolicy: (...args: unknown[]) => setOrgPolicyMock(...args),
      status: (...args: unknown[]) => statusMock(...args),
    },
  }
})

const DAY = 24 * 60 * 60 * 1000
const OFF: OrgMfaPolicy = { required: false, grace_days: null, required_since: null, deadline: null, platform_required: false }

function requiredFor(daysAgo: number, graceDays: number, extra: Partial<OrgMfaPolicy> = {}): OrgMfaPolicy {
  const since = new Date(Date.now() - daysAgo * DAY)
  return {
    required: true,
    grace_days: graceDays,
    required_since: since.toISOString(),
    deadline: new Date(since.getTime() + graceDays * DAY).toISOString(),
    platform_required: false,
    ...extra,
  }
}

// Super Admin of Globex always; of Acme only when adminOfAcme. The page is
// open on one of Acme's apps, so Acme is the organisation it is about.
function signIn({ adminOfAcme }: { adminOfAcme: boolean }) {
  const memberships: Membership[] = [
    { client_id: 'acme', role_id: 'sa', role: 'Super Admin', permissions: adminOfAcme ? ['*'] : ['forms:*'] },
    { client_id: 'acme', app_id: 'field', role_id: 'fu', role: 'Field User', permissions: ['forms:*'] },
    { client_id: 'globex', role_id: 'sa', role: 'Super Admin', permissions: ['*'] },
  ]
  useAuthStore.setState({
    session: { user_id: 'me', email: 'me@example.com', memberships },
    activeMembership: memberships[1],
  })
}

beforeEach(() => {
  signIn({ adminOfAcme: true })
  statusMock.mockResolvedValue({ enrolled: true, required: false, blocking: false, recovery_codes_remaining: 10 })
})

afterEach(() => {
  cleanup()
  orgPolicyMock.mockReset()
  setOrgPolicyMock.mockReset()
  statusMock.mockReset()
  useAuthStore.setState({ session: null, activeMembership: null })
})

function renderSection(onSetUpOwn?: () => void) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <SecuritySection onSetUpOwn={onSetUpOwn} />
      </I18nProvider>
    </QueryClientProvider>,
  )
}

function httpError(status: number): HTTPError {
  return new HTTPError(new Response('{}', { status }), new Request('http://t/api/client/mfa-policy'), {} as never)
}

const toggle = () => screen.findByRole('switch', { name: en['team.security_require'] })
const graceField = () => screen.getByLabelText(en['team.security_grace_label']) as HTMLInputElement
const saveButton = () => screen.getByRole('button', { name: en['common.save'] })

describe('SecuritySection', () => {
  it('is for a Super Admin of the organisation it is open on, not of some other one', async () => {
    signIn({ adminOfAcme: false })
    renderSection()

    expect((await screen.findByRole('alert')).textContent).toBe(en['team.security_forbidden'])
    expect(orgPolicyMock).not.toHaveBeenCalled()
    expect(screen.queryByRole('switch')).toBeNull()
  })

  it('shows the current requirement and when set-up is due', async () => {
    orgPolicyMock.mockResolvedValue(requiredFor(1, 7))
    renderSection()

    expect((await toggle()).getAttribute('aria-checked')).toBe('true')
    expect(graceField().value).toBe('7')
    expect(screen.getByText((text) => text.startsWith(en['team.security_preview_by'].split('{{date}}')[0]))).toBeTruthy()
    expect(saveButton()).toHaveProperty('disabled', true)
  })

  it('turns it on with the grace period, without asking when the deadline is still ahead', async () => {
    orgPolicyMock.mockResolvedValue(OFF)
    setOrgPolicyMock.mockResolvedValue(requiredFor(0, 7))
    renderSection()

    fireEvent.click(await toggle())
    expect(graceField().value).toBe('7')
    fireEvent.click(saveButton())

    await waitFor(() => expect(setOrgPolicyMock).toHaveBeenCalledWith(true, 7))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(await screen.findByText(en['common.saved'])).toBeTruthy()
  })

  it('asks before a requirement that starts at the next sign-in, and saves only if confirmed', async () => {
    orgPolicyMock.mockResolvedValue(OFF)
    setOrgPolicyMock.mockResolvedValue(requiredFor(0, 0))
    renderSection()

    fireEvent.click(await toggle())
    fireEvent.change(graceField(), { target: { value: '0' } })
    expect(screen.getByText(en['team.security_preview_now'])).toBeTruthy()
    fireEvent.click(saveButton())

    const dialog = await screen.findByRole('dialog')
    expect(dialog.textContent).toContain(en['team.security_confirm_now_description'])
    expect(setOrgPolicyMock).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole('button', { name: en['team.security_confirm_now_confirm'] }))
    await waitFor(() => expect(setOrgPolicyMock).toHaveBeenCalledWith(true, 0))
  })

  it('asks before shortening a grace period that has already run out', async () => {
    // Required ten days ago with fourteen days' grace: seven days would have
    // ended three days ago, so the deadline would already be past.
    orgPolicyMock.mockResolvedValue(requiredFor(10, 14))
    renderSection()

    await toggle()
    fireEvent.change(graceField(), { target: { value: '7' } })
    expect(screen.getByText(en['team.security_preview_now'])).toBeTruthy()
    fireEvent.click(saveButton())

    expect(await screen.findByRole('dialog')).toBeTruthy()
    expect(setOrgPolicyMock).not.toHaveBeenCalled()
  })

  it.each(['91', '-1', '2.5', ''])('will not save a grace period of %j', async (value) => {
    orgPolicyMock.mockResolvedValue(OFF)
    renderSection()

    fireEvent.click(await toggle())
    fireEvent.change(graceField(), { target: { value } })

    expect(screen.getByText(en['team.security_grace_invalid'].replace('{{max}}', '90'))).toBeTruthy()
    expect(saveButton()).toHaveProperty('disabled', true)
  })

  it('turns it off', async () => {
    orgPolicyMock.mockResolvedValue(requiredFor(1, 7))
    setOrgPolicyMock.mockResolvedValue(OFF)
    renderSection()

    fireEvent.click(await toggle())
    expect(screen.queryByLabelText(en['team.security_grace_label'])).toBeNull()
    fireEvent.click(saveButton())

    await waitFor(() => expect(setOrgPolicyMock).toHaveBeenCalledTimes(1))
    expect(setOrgPolicyMock.mock.calls[0][0]).toBe(false)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('says so when the platform already requires it', async () => {
    orgPolicyMock.mockResolvedValue({ ...OFF, platform_required: true })
    renderSection()

    expect(await screen.findByText(en['team.security_platform_required'])).toBeTruthy()
  })

  it('points an admin who has not set up two-step themselves to Account security', async () => {
    orgPolicyMock.mockResolvedValue(OFF)
    statusMock.mockResolvedValue({ enrolled: false, required: false, blocking: false, recovery_codes_remaining: 0 })
    const onSetUpOwn = vi.fn()
    renderSection(onSetUpOwn)

    fireEvent.click(await toggle())
    fireEvent.click(await screen.findByRole('button', { name: en['team.security_set_up_yours'] }))
    expect(onSetUpOwn).toHaveBeenCalled()
  })

  it.each<[number, keyof typeof en]>([
    [403, 'team.security_forbidden'],
    [400, 'team.security_grace_rejected'],
    [500, 'team.security_save_failed'],
  ])('explains a %i from saving in its own words', async (status, key) => {
    orgPolicyMock.mockResolvedValue(OFF)
    setOrgPolicyMock.mockRejectedValue(httpError(status))
    renderSection()

    fireEvent.click(await toggle())
    fireEvent.click(saveButton())

    expect((await screen.findByRole('alert')).textContent).toBe(en[key])
    expect(screen.queryByText(en['common.saved'])).toBeNull()
  })

  it('says why when the engine refuses to show the rule', async () => {
    orgPolicyMock.mockRejectedValue(httpError(403))
    renderSection()

    expect((await screen.findByRole('alert')).textContent).toBe(en['team.security_forbidden'])
  })
})

describe('previewDeadline', () => {
  const now = new Date('2026-09-25T12:00:00Z')

  it('counts a new requirement from now', () => {
    expect(previewDeadline(OFF, 7, now).toISOString()).toBe('2026-10-02T12:00:00.000Z')
  })

  it('counts an existing requirement from when it started, not from the edit', () => {
    const current: OrgMfaPolicy = { ...OFF, required: true, grace_days: 14, required_since: '2026-09-15T12:00:00Z' }
    expect(previewDeadline(current, 7, now).toISOString()).toBe('2026-09-22T12:00:00.000Z')
  })

  it('makes no grace period the start itself', () => {
    expect(previewDeadline(OFF, 0, now).getTime()).toBe(now.getTime())
  })
})

describe('parseGraceDays', () => {
  it.each<[string, number | null]>([
    ['0', 0], ['7', 7], [' 30 ', 30], ['90', 90], ['91', null], ['-1', null], ['2.5', null], ['', null], ['abc', null],
  ])('%j -> %j', (text, want) => {
    expect(parseGraceDays(text)).toBe(want)
  })
})
