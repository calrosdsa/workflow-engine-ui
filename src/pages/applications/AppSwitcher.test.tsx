// @vitest-environment jsdom
//
// Pins the header app-icon/name dropdown added to jump back to Home or
// switch directly into another app's design shell (ApplicationDesignShell.tsx).
// The one behavior worth pinning beyond "it renders": switching apps must
// re-point activeMembership BEFORE navigating and BEFORE invalidating
// queries — lib/api.ts's beforeRequest hook reads activeMembership fresh at
// request time (see stores/auth.ts), so navigating first would fire the new
// route's queries under the PREVIOUS app's X-App-ID header.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement } from 'react'
import { AppSwitcher } from './ApplicationDesignShell'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import { useAuthStore } from '@/stores/auth'
import type { Membership } from '@/features/auth/types'

const navigateSpy = vi.fn()
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateSpy,
  useRouterState: () => '/',
  Outlet: () => null,
}))

// Radix DropdownMenu leans on browser APIs jsdom doesn't implement — same
// stub set InsertDataMenu.test.tsx already established for this Radix-in-
// jsdom gap, and the same fireEvent.pointerDown-then-click open sequence
// (Radix opens on pointerdown, not click; jsdom's fireEvent.click alone
// never synthesizes that intermediate pointer event).
Element.prototype.hasPointerCapture = () => false
Element.prototype.setPointerCapture = () => {}
Element.prototype.releasePointerCapture = () => {}
Element.prototype.scrollIntoView = () => {}

const CURRENT: Membership = { client_id: 'c-1', app_id: 'a-1', app_name: 'Current App', role_id: 'r-1', role: 'admin', permissions: ['application:design'] }
const OTHER_DESIGNABLE: Membership = { client_id: 'c-1', app_id: 'a-2', app_name: 'Other App', role_id: 'r-1', role: 'admin', permissions: ['application:design'] }
const OTHER_NO_DESIGN: Membership = { client_id: 'c-1', app_id: 'a-3', app_name: 'No Access App', role_id: 'r-2', role: 'viewer', permissions: ['forms:*:view'] }
const OTHER_CLIENT: Membership = { client_id: 'c-2', app_id: 'a-4', app_name: 'Different Client App', role_id: 'r-1', role: 'admin', permissions: ['application:design'] }

function seedSession() {
  useAuthStore.setState({
    session: { user_id: 'u-1', email: 'u@example.com', memberships: [CURRENT, OTHER_DESIGNABLE, OTHER_NO_DESIGN, OTHER_CLIENT] },
    activeClientId: 'c-1',
    activeMembership: CURRENT,
  })
}

function renderSwitcher(ui: ReactElement, client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return { client, ...render(<QueryClientProvider client={client}><I18nProvider>{ui}</I18nProvider></QueryClientProvider>) }
}

async function openMenu() {
  const trigger = screen.getByRole('button', { name: /switch application/i })
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' })
  fireEvent.click(trigger)
  await screen.findByText('Back to applications')
}

afterEach(() => {
  cleanup()
  navigateSpy.mockClear()
})

describe('AppSwitcher', () => {
  beforeEach(seedSession)

  it('opens on the header trigger and always offers Home, even with only one app', async () => {
    useAuthStore.setState({ session: { user_id: 'u-1', email: 'u@example.com', memberships: [CURRENT] } })
    renderSwitcher(<AppSwitcher appId="a-1" appName="Current App" appClientId="c-1" />)
    await openMenu()
    expect(screen.getByText('Back to applications')).toBeTruthy()
  })

  it('navigates to Home when the Home item is selected', async () => {
    renderSwitcher(<AppSwitcher appId="a-1" appName="Current App" appClientId="c-1" />)
    await openMenu()

    fireEvent.click(screen.getByText('Back to applications'))

    expect(navigateSpy).toHaveBeenCalledWith({ to: '/' })
  })

  it('lists only same-client apps this member can design, marking the current one', async () => {
    renderSwitcher(<AppSwitcher appId="a-1" appName="Current App" appClientId="c-1" />)
    await openMenu()

    expect(screen.getByText('Other App')).toBeTruthy()
    // Filtered out: no application:design permission on this app...
    expect(screen.queryByText('No Access App')).toBeNull()
    // ...and a membership under a DIFFERENT client (appClientId scopes the
    // list to the app actually open, not activeClientId from the store —
    // see the component's own doc comment on why those can diverge).
    expect(screen.queryByText('Different Client App')).toBeNull()
  })

  it('re-points activeMembership before navigating and invalidating, then switches app', async () => {
    const { client } = renderSwitcher(<AppSwitcher appId="a-1" appName="Current App" appClientId="c-1" />)
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    // Asserts ORDER, not just outcome: if the source called navigate() before
    // setActiveMembership(), activeMembership would still read CURRENT here.
    navigateSpy.mockImplementation(() => {
      expect(useAuthStore.getState().activeMembership).toEqual(OTHER_DESIGNABLE)
    })

    await openMenu()
    fireEvent.click(screen.getByText('Other App'))

    expect(useAuthStore.getState().activeMembership).toEqual(OTHER_DESIGNABLE)
    expect(invalidateSpy).toHaveBeenCalled()
    expect(navigateSpy).toHaveBeenCalledWith({ to: '/applications/$appId', params: { appId: 'a-2' } })
  })

  it('does nothing when the currently-open app is clicked again', async () => {
    const { client } = renderSwitcher(<AppSwitcher appId="a-1" appName="Current App" appClientId="c-1" />)
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')

    await openMenu()
    // "Current App" also appears in the trigger's own (always-rendered)
    // label, so disambiguate via the dropdown item role rather than text.
    const currentItem = screen.getAllByRole('menuitem').find((el) => el.textContent?.includes('Current App'))
    fireEvent.click(currentItem!)

    expect(navigateSpy).not.toHaveBeenCalled()
    expect(invalidateSpy).not.toHaveBeenCalled()
  })
})
