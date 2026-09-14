// @vitest-environment jsdom
//
// NotFoundPage renders in two very different contexts: normally, deep
// inside I18nProvider (runtimeIndexRoute/runtimeMenuRoute/runtimeRecordRoute
// all render it from within RuntimeAppRouteComponent's subtree), but also
// from runtime-router.tsx's runtimeCatchAllRoute and runtimeRouter's
// defaultNotFoundComponent — both of which fire under runtime-main.tsx's
// bare RouterProvider, before I18nProvider ever mounts. The no-provider case
// is the one that used to crash (useTranslation() -> useI18n() throws with
// no ancestor); it's the regression this test file exists to cover.
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import { NotFoundPage } from './NotFoundPage'

afterEach(cleanup)

describe('NotFoundPage', () => {
  it('renders the base English copy with no I18nProvider ancestor', () => {
    render(<NotFoundPage />)

    expect(screen.getByText('Page not found')).toBeTruthy()
    expect(
      screen.getByText("The page you're looking for doesn't exist, or this application hasn't been published yet."),
    ).toBeTruthy()
  })

  it('renders an explicitly passed message as-is with no I18nProvider ancestor', () => {
    render(<NotFoundPage message="This application has no menus configured yet." />)

    expect(screen.getByText('This application has no menus configured yet.')).toBeTruthy()
  })

  it('renders the same base English copy through a real I18nProvider', () => {
    render(
      <I18nProvider>
        <NotFoundPage />
      </I18nProvider>,
    )

    expect(screen.getByText('Page not found')).toBeTruthy()
    expect(
      screen.getByText("The page you're looking for doesn't exist, or this application hasn't been published yet."),
    ).toBeTruthy()
  })
})
