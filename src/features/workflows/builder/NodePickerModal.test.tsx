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

const tabNames = () =>
  screen
    .getAllByRole('button')
    .map((b) => b.textContent?.trim() ?? '')
    .filter((t) => ['All', 'Structure', 'Data', 'Logic', 'Integration', 'AI', 'Notify', 'Output', 'Utility'].includes(t))

describe('the node picker, against the live catalog', () => {
  it('renders one tab per OCCUPIED category, in the order the server gave', () => {
    open()
    // Ordering is the server's `order` field, not this file's opinion. A
    // category with no addable members never appears — trigger/exit/loop_end
    // are placed automatically, so Structure shows only because Iterator and
    // Merge are in the palette.
    expect(tabNames()).toEqual(['All', 'Structure', 'Data', 'Logic', 'Integration', 'AI', 'Notify', 'Output', 'Utility'])
  })

  it('lets the server re-group a node the frontend had classified differently', () => {
    open()
    // Iterator and Merge were 'logic' in this bundle's compiled-in fallback and
    // 'structure' in the engine's catalog. The served answer wins, which is
    // the entire point of the taxonomy endpoint — and the visible proof that
    // regrouping a node needs no frontend release.
    fireEvent.click(screen.getByRole('button', { name: 'Structure' }))
    expect(screen.getByText('Iterator')).toBeTruthy()
    expect(screen.getByText('Merge')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Logic' }))
    expect(screen.queryByText('Iterator')).toBeNull()
  })

  it('has no Connectors tab any more', () => {
    open()
    // The old layout grouped by provenance. Someone looking for "post to
    // Slack" scans for what a node does, not for which process implements it.
    // The new "Apps" tab below does NOT reintroduce this — it's an
    // additional browsing mode, not a replacement: a package node still
    // also appears under its own functional-category tab exactly as
    // today, so nothing is removed from the tabs this test guards, unlike
    // the old Connectors tab, which fragmented the SAME entries across two
    // competing grouping axes.
    expect(screen.queryByRole('button', { name: 'Connectors' })).toBeNull()
  })

  it('puts a package node in the same group as the built-in it resembles', () => {
    open()
    // The whole point of the two-axis model, end to end: slack_post_message
    // is a package node, and it belongs next to http_request under
    // Integration.
    fireEvent.click(screen.getByRole('button', { name: 'Integration' }))
    const slack = screen.getByText('Slack — Post Message').closest('button')!
    expect(within(slack).getByText('package')).toBeTruthy()
  })

  it('lists built-ins ahead of package nodes within a shared group', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Integration' }))
    const labels = screen.getAllByRole('button').map((b) => b.textContent ?? '')
    const http = labels.findIndex((t) => t.includes('HTTP Request'))
    const slack = labels.findIndex((t) => t.includes('Slack'))
    expect(http).toBeGreaterThan(-1)
    expect(slack).toBeGreaterThan(http)
  })

  it('fills the Utility tab, which had no members before packages existed', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Utility' }))
    expect(screen.getByText('Format Reference Code')).toBeTruthy()
  })

  it('badges provenance only where it is not the default', () => {
    open()
    // A core node carries no badge — every node wearing one would be noise.
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

  it('has an Apps tab that renders the app-grouped picker', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Apps' }))
    expect(screen.getByText('WhatsApp')).toBeTruthy()
    expect(screen.getByText('Slack')).toBeTruthy()
    // The flat node grid's own search box is gone — AppPickerPanel has its
    // own, and showing both would be confusing.
    expect(screen.queryByPlaceholderText('Search nodes…')).toBeNull()
    expect(screen.getByPlaceholderText('Search apps…')).toBeTruthy()
  })

  it('reports an action picked from the Apps tab as a node selection', () => {
    const onSelect = vi.fn()
    open(onSelect)
    fireEvent.click(screen.getByRole('button', { name: 'Apps' }))
    fireEvent.click(screen.getByText('WhatsApp'))
    fireEvent.click(screen.getByText('WhatsApp — Send Template Message'))
    expect(onSelect).toHaveBeenCalledWith({ kind: 'node', type: 'whatsapp_send' })
  })

  it('reports a trigger picked from the Apps tab as a trigger_preset selection, not a node', () => {
    // The whole point of the discriminated selection: picking a trigger
    // from THIS mid-workflow picker must not add a graph node — the
    // singleton Trigger node gets reconfigured instead, one layer up in
    // Layout.tsx's handlePickerSelect.
    const onSelect = vi.fn()
    open(onSelect)
    fireEvent.click(screen.getByRole('button', { name: 'Apps' }))
    fireEvent.click(screen.getByText('WhatsApp'))
    fireEvent.click(screen.getByText('WhatsApp — On Message'))
    expect(onSelect).toHaveBeenCalledWith({
      kind: 'trigger_preset',
      preset: expect.objectContaining({ name: 'whatsapp_on_message' }),
    })
  })

  it('returns to the flat category view when switching tabs away from Apps', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Apps' }))
    fireEvent.click(screen.getByRole('button', { name: 'Integration' }))
    expect(screen.getByPlaceholderText('Search nodes…')).toBeTruthy()
    expect(screen.getByText('Slack — Post Message')).toBeTruthy()
  })
})
