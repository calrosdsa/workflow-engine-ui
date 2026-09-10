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
import { NodePickerModal } from './NodePickerModal'
import taxonomy from './__fixtures__/live-node-taxonomy.json'

// The one hook is this component's only I/O. Stubbed with the live payload
// rather than with a query client, so the test is about rendering, not about
// react-query.
vi.mock('./node-taxonomy', async () => {
  const actual = await vi.importActual<typeof import('./node-taxonomy')>('./node-taxonomy')
  return { ...actual, useNodeTaxonomy: () => ({ data: taxonomy }) }
})

afterEach(cleanup)

function open() {
  render(<NodePickerModal onSelect={() => {}} onClose={() => {}} />)
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
})
