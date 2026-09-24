// @vitest-environment jsdom
//
// The engine has always told the UI when someone's two-step deadline is coming
// (/mfa/status: required, enrollment_deadline, blocking), and nothing showed
// it: the first a builder heard of the requirement was a sign-in that would not
// finish until they enrolled. These pin who sees the reminder and what it says.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HTTPError } from 'ky'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import { en } from '@/features/i18n/locales/en'
import { MfaEnrollmentBanner } from './MfaEnrollmentBanner'
import type { MfaStatus } from './api'

const statusMock = vi.fn()
vi.mock('./api', () => ({
  mfaApi: { status: (...args: unknown[]) => statusMock(...args) },
}))

beforeEach(() => {
  sessionStorage.clear()
})

afterEach(() => {
  cleanup()
  statusMock.mockReset()
})

const DEADLINE = '2026-10-15T12:00:00Z'

function status(overrides: Partial<MfaStatus>): MfaStatus {
  return { enrolled: false, required: true, blocking: false, recovery_codes_remaining: 0, ...overrides }
}

function renderBanner() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const onSetUp = vi.fn()
  const utils = render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <MfaEnrollmentBanner onSetUp={onSetUp} />
      </I18nProvider>
    </QueryClientProvider>,
  )
  return { onSetUp, ...utils }
}

// The status request has settled once the mock has been called and React has
// had a turn; "nothing rendered" is only meaningful after that.
async function settled() {
  await waitFor(() => expect(statusMock).toHaveBeenCalled())
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe('MfaEnrollmentBanner', () => {
  it('before the deadline, names the date and offers to set it up now', async () => {
    statusMock.mockResolvedValue(status({ enrollment_deadline: DEADLINE }))
    const { onSetUp } = renderBanner()

    const banner = await screen.findByRole('status')
    const [before] = en['mfa.required_by'].split('{date}')
    expect(banner.textContent).toContain(before)
    expect(banner.textContent).toContain('2026')
    expect(banner.textContent).not.toContain('{date}')

    fireEvent.click(screen.getByRole('button', { name: en['mfa.banner_set_up'] }))
    expect(onSetUp).toHaveBeenCalledTimes(1)
  })

  it('after the deadline, says the next sign-in will insist', async () => {
    statusMock.mockResolvedValue(status({ blocking: true, enrollment_deadline: DEADLINE }))
    renderBanner()

    const banner = await screen.findByRole('status')
    expect(banner.textContent).toContain(en['mfa.required_now'])
    expect(banner.textContent).toContain(en['mfa.banner_next_signin'])
  })

  it('says nothing to someone already enrolled', async () => {
    statusMock.mockResolvedValue(status({ enrolled: true, enrollment_deadline: DEADLINE }))
    renderBanner()
    await settled()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('says nothing to someone no policy requires -- a portal user, or policy off', async () => {
    statusMock.mockResolvedValue(status({ required: false }))
    renderBanner()
    await settled()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('says nothing when the status cannot be read', async () => {
    // An engine without two-step verification answers 404.
    statusMock.mockRejectedValue(
      new HTTPError(new Response('{}', { status: 404 }), new Request('http://t/api/auth/mfa/status'), {} as never),
    )
    renderBanner()
    await settled()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('stays dismissed for this session, but comes back for a new deadline', async () => {
    statusMock.mockResolvedValue(status({ enrollment_deadline: DEADLINE }))
    const first = renderBanner()
    await screen.findByRole('status')

    fireEvent.click(screen.getByRole('button', { name: en['mfa.banner_dismiss'] }))
    expect(screen.queryByRole('status')).toBeNull()

    // A later page, same session, same deadline: still dismissed.
    first.unmount()
    renderBanner()
    await settled()
    expect(screen.queryByRole('status')).toBeNull()

    // An admin moves the deadline: that is news, so it shows again.
    cleanup()
    statusMock.mockResolvedValue(status({ enrollment_deadline: '2026-11-01T12:00:00Z' }))
    renderBanner()
    expect(await screen.findByRole('status')).toBeTruthy()
  })

  it('still works where session storage is unavailable', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    try {
      statusMock.mockResolvedValue(status({ enrollment_deadline: DEADLINE }))
      renderBanner()
      await screen.findByRole('status')
      fireEvent.click(screen.getByRole('button', { name: en['mfa.banner_dismiss'] }))
      expect(screen.queryByRole('status')).toBeNull()
    } finally {
      getItem.mockRestore()
      setItem.mockRestore()
    }
  })
})
