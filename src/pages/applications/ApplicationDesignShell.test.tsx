// @vitest-environment jsdom
//
// When the design shell could not load its application it rendered nothing at
// all -- `if (!app) return null`. The common way to get there was a role with
// "App design permissions" but not "View application settings": shown the Edit
// design button, then a blank page. These pin that the shell now says why, and
// that it only blames permissions when the server actually refused (403).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { HTTPError } from 'ky'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import { en } from '@/features/i18n/locales/en'
import { ApplicationDesignShell } from './ApplicationDesignShell'

const navigateMock = vi.fn()
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
  useRouterState: ({ select }: { select: (s: { location: { pathname: string } }) => unknown }) =>
    select({ location: { pathname: '/applications/app-1/design' } }),
  Outlet: () => null,
}))

let applicationQuery: { data?: unknown; isLoading: boolean; isError: boolean; error: unknown } = {
  isLoading: false, isError: false, error: null,
}
vi.mock('@/features/applications/hooks', () => ({
  useApplication: () => applicationQuery,
  useApplicationVersions: () => ({ data: [] }),
  usePublishApplication: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('@/features/environment/hooks', () => ({
  useEnvironmentLinkStatus: () => ({ data: undefined }),
}))
vi.mock('@/features/auth/permissions', () => ({
  usePermission: () => false,
  hasPermission: () => false,
}))

afterEach(() => {
  cleanup()
  navigateMock.mockReset()
})

function httpError(status: number): HTTPError {
  return new HTTPError(new Response('{}', { status }), new Request('http://t/api/application'), {} as never)
}

function renderShellWithError(error: unknown) {
  applicationQuery = { isLoading: false, isError: true, error }
  render(
    <I18nProvider>
      <ApplicationDesignShell appId="app-1" />
    </I18nProvider>,
  )
}

describe('ApplicationDesignShell when the application cannot be loaded', () => {
  it('explains a refusal instead of showing a blank page, and offers a way back', () => {
    renderShellWithError(httpError(403))

    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain(en['app_design.no_access_title'])
    expect(alert.textContent).toContain(en['app_design.no_access_description'])

    fireEvent.click(screen.getByRole('button', { name: en['app_design.back_to_apps'] }))
    expect(navigateMock).toHaveBeenCalledWith({ to: '/' })
  })

  it('does not blame permissions for a server failure', () => {
    renderShellWithError(httpError(500))

    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain(en['app_design.load_failed_title'])
    expect(alert.textContent).not.toContain(en['app_design.no_access_title'])
  })
})
