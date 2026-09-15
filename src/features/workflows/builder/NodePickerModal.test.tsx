// @vitest-environment jsdom
// The palette, rendered against a payload captured from the RUNNING backend.
//
// The fixture in __fixtures__/ is a verbatim response from a live server
// (GET /meta/node-taxonomy), not a hand-written shape. That matters: a
// hand-written fixture tests this file's own assumptions about the wire
// format, which is exactly the drift that let the frontend maintain a
// category vocabulary the backend had never heard of. If the server's shape
// moves, re-capture it and this test tells you what broke.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, within, cleanup, fireEvent } from '@testing-library/react'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import { NodePickerModal } from './NodePickerModal'
import type { PickerSelection } from './AppPickerPanel'
import taxonomy from './__fixtures__/live-node-taxonomy.json'

// The one hook is this component's only I/O. Stubbed with the live payload
// rather than with a query client, so the test is about rendering, not about
// react-query.
vi.mock('./node-taxonomy', async () => {
  const actual = await vi.importActual<typeof import('./node-taxonomy')>('./node-taxonomy')
  return { ...actual, useNodeTaxonomy: () => ({ data: taxonomy }) }
})

afterEach(cleanup)

function open(onSelect: (s: PickerSelection) => void = () => {}) {
  render(
    <I18nProvider>
      <NodePickerModal onSelect={onSelect} onClose={() => {}} />
    </I18nProvider>,
  )
}

const categoryNames = ['AI', 'Data', 'Flow', 'Core', 'Output']

const visibleCategoryNames = () =>
  screen
    .getAllByRole('button')
    .map((b) => b.textContent?.trim() ?? '')
    .map((t) => categoryNames.find((name) => t.startsWith(name)) ?? '')
    .filter(Boolean)

describe('the node picker, against the live catalog', () => {
  it('renders one landing choice per OCCUPIED category, in the order the server gave', () => {
    open()
    // Ordering is the server's `order` field, not this file's opinion. A
    // category with no addable members never appears. The visible choices are
    // presentation buckets: Flow combines Structure + Logic, while Core
    // combines Integration + Notify + Utility.
    expect(visibleCategoryNames()).toEqual(categoryNames)
    expect(screen.getByText('Action in an app')).toBeTruthy()
  })

  it('lets the server re-group a node the frontend had classified differently', () => {
    open()
    // Iterator and Merge are served as Structure, and Set Variable is served
    // as Logic. The picker presents both as one Flow choice while the server
    // taxonomy remains unchanged.
    fireEvent.click(screen.getByRole('button', { name: /^Flow/ }))
    expect(screen.getByText('Iterator')).toBeTruthy()
    expect(screen.getByText('Merge')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /^Back to categories/ }))
    fireEvent.click(screen.getByRole('button', { name: /^Core/ }))
    expect(screen.queryByText('Iterator')).toBeNull()
  })

  it('has no Connectors tab any more', () => {
    open()
    // The old layout grouped by provenance. Someone looking for "post to
    // Slack" scans for what a node does, not for which process implements it.
    // The new app-browse choice does NOT reintroduce this — it is an
    // additional browsing mode, not a replacement: a package node still
    // also appears under its functional category, so the same action is not
    // fragmented across competing grouping axes.
    expect(screen.queryByRole('button', { name: 'Connectors' })).toBeNull()
  })

  it('keeps app actions out of the Core category', () => {
    open()
    // Core is for platform-owned steps. Provider actions are intentionally
    // reached through the separate Action in an app path.
    fireEvent.click(screen.getByRole('button', { name: /^Core/ }))
    expect(screen.getByText('HTTP Request')).toBeTruthy()
    expect(screen.getByText('Notification')).toBeTruthy()
    expect(screen.queryByText('Post Message')).toBeNull()
    expect(screen.queryByText('Send Template Message')).toBeNull()
    expect(screen.queryByText('Format Reference Code')).toBeNull()
    expect(screen.queryByText('Slack actions')).toBeNull()
  })

  it('keeps Core action cards full width', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: /^Core/ }))
    const http = screen.getByText('HTTP Request').closest('button')!
    expect(http.className).toContain('w-full')
  })

  it('keeps utility package actions available through app browsing', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: /^Core/ }))
    expect(screen.queryByText('Format Reference Code')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^Back to categories/ }))
    fireEvent.click(screen.getByRole('button', { name: /Action in an app/ }))
    fireEvent.click(screen.getByText('Examples'))
    expect(screen.getByText('Format Reference Code')).toBeTruthy()
  })

  it('keeps built-in provenance implicit in the section hierarchy', () => {
    open()
    // Provenance is communicated by the section label rather than a badge on
    // every card — the card itself can stay focused on the action.
    fireEvent.click(screen.getByRole('button', { name: /^Flow/ }))
    const setVar = screen.getByText('Set Variable').closest('button')!
    expect(within(setVar).queryByText('core')).toBeNull()
    expect(within(setVar).queryByText('package')).toBeNull()
  })

  it('finds a package node by searching what it does, not what it is called', () => {
    open()
    // Search spans descriptions as well as labels, so a package node is
    // discoverable by the problem it solves — which matters more for a
    // package node than a built-in, since nobody knows its name yet.
    fireEvent.change(screen.getByPlaceholderText('Search nodes…'), { target: { value: 'padded' } })
    expect(screen.getByText('Format Reference Code')).toBeTruthy()
    // And the search really filtered, rather than the match merely being
    // present in an unfiltered list.
    expect(screen.queryByText('Slack — Post Message')).toBeNull()
  })

  it('has an app-browse choice that renders the app-grouped picker', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: /Action in an app/ }))
    expect(screen.getByText('WhatsApp')).toBeTruthy()
    expect(screen.getByText('Slack')).toBeTruthy()
    // The flat node grid's own search box is gone — AppPickerPanel has its
    // own, and showing both would be confusing.
    expect(screen.queryByPlaceholderText('Search nodes…')).toBeNull()
    expect(screen.getByPlaceholderText('Search apps…')).toBeTruthy()
  })

  it('reports an action picked from app browsing as a node selection', () => {
    const onSelect = vi.fn()
    open(onSelect)
    fireEvent.click(screen.getByRole('button', { name: /Action in an app/ }))
    fireEvent.click(screen.getByText('WhatsApp'))
    fireEvent.click(screen.getByText('WhatsApp — Send Template Message'))
    expect(onSelect).toHaveBeenCalledWith({ kind: 'node', type: 'whatsapp_send' })
  })

  it('reports a trigger picked from app browsing as a trigger_preset selection, not a node', () => {
    // The whole point of the discriminated selection: picking a trigger
    // from THIS mid-workflow picker must not add a graph node — the
    // singleton Trigger node gets reconfigured instead, one layer up in
    // Layout.tsx's handlePickerSelect.
    const onSelect = vi.fn()
    open(onSelect)
    fireEvent.click(screen.getByRole('button', { name: /Action in an app/ }))
    fireEvent.click(screen.getByText('WhatsApp'))
    fireEvent.click(screen.getByText('WhatsApp — On Message'))
    expect(onSelect).toHaveBeenCalledWith({
      kind: 'trigger_preset',
      preset: expect.objectContaining({ name: 'whatsapp_on_message' }),
    })
  })

  it('returns to the category landing when leaving app browsing', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: /Action in an app/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Categories' }))
    expect(screen.getByText('What happens next?')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^Core/ }))
    expect(screen.getByPlaceholderText('Search nodes…')).toBeTruthy()
    expect(screen.getByText('HTTP Request')).toBeTruthy()
    expect(screen.queryByText('Post Message')).toBeNull()
  })
})
