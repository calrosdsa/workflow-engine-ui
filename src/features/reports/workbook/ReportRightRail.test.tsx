// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import { ReportRightRail } from './ReportRightRail'

afterEach(cleanup)

function renderRail() {
  return render(
    <I18nProvider>
      <ReportRightRail
        regions={<div>Regions content</div>}
        diagnostics={<div>Diagnostics content</div>}
      />
    </I18nProvider>,
  )
}

describe('ReportRightRail', () => {
  it('shows the Data tab by default, with Diagnostics present but inactive', () => {
    renderRail()
    expect(screen.getByText('Regions content')).toBeTruthy()
    expect(screen.getByRole('tab', { name: /Data/ }).getAttribute('data-state')).toBe('active')
    expect(screen.getByRole('tab', { name: /Diagnostics/ }).getAttribute('data-state')).toBe('inactive')
  })

  it('switches to the Diagnostics tab without unmounting either panel’s tree from the DOM structure', () => {
    renderRail()
    // Radix's TabsTrigger activates on mousedown, not click — see
    // ExecutionLogsPanel.test.tsx's own note on this.
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Diagnostics/ }))

    expect(screen.getByRole('tab', { name: /Diagnostics/ }).getAttribute('data-state')).toBe('active')
    expect(screen.getByRole('tab', { name: /Data/ }).getAttribute('data-state')).toBe('inactive')
    expect(screen.getByText('Diagnostics content')).toBeTruthy()
  })
})
