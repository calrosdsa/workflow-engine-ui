// @vitest-environment jsdom
//
// Account security (two-step verification) had a working page and no way to
// reach it: nothing linked to /account/security. The link belongs in the
// profile menu -- but this component is shared by the builder's AppShell and
// the published-app runtime, which runs under a separate router with no such
// route. So the item must appear only when the builder asks for it.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import { en } from '@/features/i18n/locales/en'
import type { Me } from '@/features/auth/types'
import { ProfileMenu } from './ProfileMenu'

// Radix's menu positions itself with ResizeObserver; jsdom has none.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
;(globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver = ResizeObserverStub

afterEach(cleanup)

const SESSION: Me = {
  user_id: 'user-1',
  email: 'staff@example.test',
  first_name: 'Sam',
  last_name: 'Staff',
  memberships: [],
}

function renderMenu(onOpenAccountSecurity?: () => void) {
  const client = new QueryClient()
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <ProfileMenu session={SESSION} onOpenAccountSecurity={onOpenAccountSecurity} />
      </I18nProvider>
    </QueryClientProvider>,
  )
}

// Radix opens a DropdownMenu on pointerdown, which jsdom's click does not
// synthesize -- the same two-step the InsertDataMenu test established.
async function openMenu() {
  const trigger = screen.getByRole('button', { name: en['profile.account_menu'] })
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' })
  fireEvent.click(trigger)
  await screen.findByText(SESSION.email)
}

describe('ProfileMenu account security link', () => {
  it('offers Account security when the builder passes the callback, and calls it', async () => {
    const onOpenAccountSecurity = vi.fn()
    renderMenu(onOpenAccountSecurity)
    await openMenu()

    const item = screen.getByRole('menuitem', { name: en['profile.account_security'] })
    fireEvent.click(item)

    expect(onOpenAccountSecurity).toHaveBeenCalledTimes(1)
  })

  it('shows no Account security item in the runtime app, which passes no callback', async () => {
    renderMenu(undefined)
    await openMenu()

    expect(screen.queryByRole('menuitem', { name: en['profile.account_security'] })).toBeNull()
    // The menu itself still works there.
    expect(screen.getByRole('menuitem', { name: en['profile.log_out'] })).toBeTruthy()
  })
})
