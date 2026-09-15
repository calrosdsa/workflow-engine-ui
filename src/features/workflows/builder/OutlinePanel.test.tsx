// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ReactElement } from 'react'
import { OutlinePanel } from './OutlinePanel'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import { useBuilderStore } from './store'
import type { WorkflowDefinitionGraph } from '../types'

// OutlinePanel calls useTranslation, which throws outside an I18nProvider
// ancestor — real provider, no props, same as InsertDataMenu.test.tsx.
function renderPanel(ui: ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>)
}

// Rendered against the REAL builder store: loadDefinition seeds the same
// state the canvas uses, so this pins the whole chain — store → outline
// derivation → rows — and the click-to-select wiring back into the store.

const branchDefinition = {
  id: 'wf-1',
  variables: [],
  metadata: { version: 1 },
  nodes: [
    { id: 't', type: 'trigger', label: 'Convert Lead (button)', position: { x: 0, y: 0 }, configuration: { mode: 'on_demand' }, inputs: [], outputs: [] },
    { id: 'cond', type: 'condition', label: 'Company exists?', position: { x: 0, y: 160 }, configuration: { expression: 'true' }, inputs: [], outputs: [] },
    { id: 'use', type: 'set_variable', label: 'Use existing Company', position: { x: 0, y: 320 }, configuration: {}, inputs: [], outputs: [] },
    { id: 'make', type: 'save_records', label: 'Create Company', position: { x: 240, y: 320 }, configuration: {}, inputs: [], outputs: [] },
    { id: 'join', type: 'merge', label: 'Merge', position: { x: 0, y: 480 }, configuration: {}, inputs: [], outputs: [] },
    { id: 'after', type: 'set_variable', label: 'Link the Lead', position: { x: 0, y: 640 }, configuration: {}, inputs: [], outputs: [] },
  ],
  edges: [
    { id: 'e1', source: 't', target: 'cond', source_handle: '', target_handle: '' },
    { id: 'e2', source: 'cond', target: 'use', source_handle: 'true', target_handle: '' },
    { id: 'e3', source: 'cond', target: 'make', source_handle: 'false', target_handle: '' },
    { id: 'e4', source: 'use', target: 'join', source_handle: '', target_handle: '' },
    { id: 'e5', source: 'make', target: 'join', source_handle: '', target_handle: '' },
    { id: 'e6', source: 'join', target: 'after', source_handle: '', target_handle: '' },
  ],
} as unknown as WorkflowDefinitionGraph

describe('OutlinePanel', () => {
  afterEach(cleanup)

  it('renders the loaded graph as a step tree and selects on click', () => {
    useBuilderStore.getState().loadDefinition('wf-1', 'Convert Lead', branchDefinition)
    renderPanel(<OutlinePanel open onToggle={() => {}} />)

    // Steps show; structural nodes don't.
    expect(screen.getByText('Convert Lead (button)')).toBeTruthy()
    expect(screen.getByText('Company exists?')).toBeTruthy()
    expect(screen.getByText('then')).toBeTruthy()
    expect(screen.getByText('else')).toBeTruthy()
    expect(screen.getByText('Link the Lead')).toBeTruthy()
    expect(screen.queryByText('Merge')).toBeNull()

    // No free-form fallback banner for a structured graph.
    expect(screen.queryByText(/Free-form graph/)).toBeNull()

    // Clicking a row selects that node in the shared store — the same
    // selection the canvas and config panel react to.
    fireEvent.click(screen.getByText('Create Company'))
    expect(useBuilderStore.getState().selectedNodeId).toBe('make')
  })

  it('shows the honest fallback for a free-form graph', () => {
    const freeForm = {
      ...branchDefinition,
      nodes: branchDefinition.nodes.filter((n) => ['t', 'use', 'make'].includes(n.id)),
      // A plain node fanning out: no flow form.
      edges: [
        { id: 'e1', source: 't', target: 'use', source_handle: '', target_handle: '' },
        { id: 'e2', source: 't', target: 'make', source_handle: '', target_handle: '' },
        { id: 'e3', source: 'use', target: 'make', source_handle: '', target_handle: '' },
      ],
    } as unknown as WorkflowDefinitionGraph
    useBuilderStore.getState().loadDefinition('wf-2', 'Tangle', freeForm)
    renderPanel(<OutlinePanel open onToggle={() => {}} />)

    expect(screen.getByText(/Free-form graph/)).toBeTruthy()
    expect(screen.getByText('Use existing Company')).toBeTruthy()
  })

  it('renders nothing while closed — no collapsed rail on the canvas edge', () => {
    useBuilderStore.getState().loadDefinition('wf-1', 'Convert Lead', branchDefinition)
    const { container } = renderPanel(<OutlinePanel open={false} onToggle={() => {}} />)
    expect(container.firstChild).toBeNull()
  })
})
