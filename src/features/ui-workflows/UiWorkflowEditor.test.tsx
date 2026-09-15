// @vitest-environment jsdom
//
// The step editor: adding, reordering, removing, and — the part worth testing
// hardest — nested branches, which are driven entirely off the registry's
// childStepLabels/setChildStepList rather than any knowledge of `condition`.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'
import type { ReactElement } from 'react'
import './nodes'
import { UiWorkflowEditor } from './UiWorkflowEditor'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import { getUiWorkflowNode } from './node-registry'
import { UI_WORKFLOW_VERSION, type ConditionStepConfig, type UiWorkflow } from './types'

// UiWorkflowEditor calls useTranslation, which throws outside an
// I18nProvider ancestor — real provider, no props, same as
// InsertDataMenu.test.tsx.
function renderEditor(ui: ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>)
}

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver

// Radix's menus drive themselves from Pointer Events, which jsdom implements
// only partially — without these the trigger's pointerdown throws and the menu
// never opens, so the palette can't be exercised at all.
Element.prototype.hasPointerCapture = () => false
Element.prototype.setPointerCapture = () => {}
Element.prototype.releasePointerCapture = () => {}
Element.prototype.scrollIntoView = () => {}

afterEach(cleanup)

/** Opens the "Add step" palette at `index` and picks a node by its label. */
function addStep(index: number, nodeLabel: string) {
  const triggers = screen.getAllByText('Add step')
  fireEvent.pointerDown(triggers[index], { button: 0, ctrlKey: false, pointerType: 'mouse' })
  fireEvent.click(screen.getByRole('menuitem', { name: new RegExp(nodeLabel, 'i') }))
}

const wf = (steps: UiWorkflow['steps']): UiWorkflow => ({ version: UI_WORKFLOW_VERSION, steps })
const step = (id: string, type: string, config?: unknown) => ({
  id,
  type,
  config: config ?? getUiWorkflowNode(type)!.createDefaultConfig(),
})

describe('the step list', () => {
  it('says so when there are no steps', () => {
    renderEditor(<UiWorkflowEditor value={wf([])} onChange={() => {}} />)
    expect(screen.getByText(/no steps yet/i)).toBeTruthy()
  })

  it('renders a card per step, labelled by the registry', () => {
    renderEditor(<UiWorkflowEditor value={wf([step('a', 'show_message'), step('b', 'navigate')])} onChange={() => {}} />)
    expect(screen.getByText('Show Message')).toBeTruthy()
    expect(screen.getByText('Go To')).toBeTruthy()
  })

  it('removes a step', () => {
    const onChange = vi.fn()
    renderEditor(<UiWorkflowEditor value={wf([step('a', 'show_message')])} onChange={onChange} />)
    fireEvent.click(screen.getAllByLabelText('Remove step')[0])
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ steps: [] }))
  })

  it('reorders with the up/down controls', () => {
    const onChange = vi.fn()
    renderEditor(<UiWorkflowEditor value={wf([step('a', 'show_message'), step('b', 'navigate')])} onChange={onChange} />)

    // The first step's "up" is disabled and the last step's "down" is too —
    // the ends of the list have nowhere to go.
    const ups = screen.getAllByLabelText('Move up')
    const downs = screen.getAllByLabelText('Move down')
    expect((ups[0] as HTMLButtonElement).disabled).toBe(true)
    expect((downs[1] as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(downs[0])
    expect(onChange.mock.calls[0][0].steps.map((s: { id: string }) => s.id)).toEqual(['b', 'a'])
  })
})

describe('a step type this build does not know', () => {
  const unknown = wf([{ id: 'x', type: 'from_the_future', config: { keep: 'me' } }])

  it('is shown rather than hidden, and explains itself', () => {
    renderEditor(<UiWorkflowEditor value={unknown} onChange={() => {}} />)
    // Announced twice on purpose: the card says it, and the problem list
    // below repeats it as a warning about the workflow as a whole.
    expect(screen.getAllByText(/unknown step/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/skipped when the workflow runs/i)).toBeTruthy()
  })

  it('offers no editing, so its config cannot be clobbered', () => {
    // Preserving it verbatim is the point: someone on an older client must be
    // able to save without silently dropping steps they cannot render.
    renderEditor(<UiWorkflowEditor value={unknown} onChange={() => {}} />)
    expect(screen.queryByLabelText('Move up')).toBeNull()
    expect(screen.getByText(/Delete/)).toBeTruthy()
  })
})

describe('nested branches', () => {
  const branching = wf([step('if', 'condition')])

  it('renders a list per branch, labelled from the registry', () => {
    renderEditor(<UiWorkflowEditor value={branching} onChange={() => {}} />)
    expect(screen.getByText('If true')).toBeTruthy()
    expect(screen.getByText('Otherwise')).toBeTruthy()
  })

  it('writes a nested edit back through setChildStepList', () => {
    // The editor knows nothing about `condition` — it reads the lists via
    // childStepLists and writes them via setChildStepList, so this is what
    // makes a future branching node editable for free.
    const onChange = vi.fn()
    renderEditor(<UiWorkflowEditor value={branching} onChange={onChange} />)

    // Three "Add step" buttons, in DOM order: the two branch lists (which are
    // nested inside the card) and then the top-level list's own, since
    // StepList renders its adder after its steps.
    expect(screen.getAllByText('Add step')).toHaveLength(3)
    addStep(0, 'Show Message')

    const next = onChange.mock.calls[0][0] as UiWorkflow
    const cfg = next.steps[0].config as ConditionStepConfig
    expect(cfg.then).toHaveLength(1)
    expect(cfg.then[0].type).toBe('show_message')
    // The other branch is untouched — setChildStepList wrote only index 0.
    expect(cfg.else).toHaveLength(0)
  })
})

describe('adding a step', () => {
  it('seeds it from the node type’s own default config', () => {
    const onChange = vi.fn()
    renderEditor(<UiWorkflowEditor value={wf([])} onChange={onChange} />)

    addStep(0, 'Show Message')

    const next = onChange.mock.calls[0][0] as UiWorkflow
    expect(next.steps).toHaveLength(1)
    expect(next.steps[0].config).toEqual({ message: '', message_type: 'info' })
    expect(next.steps[0].id).toBeTruthy()
  })

  it('groups the palette by what a step is allowed to touch', () => {
    renderEditor(<UiWorkflowEditor value={wf([])} onChange={() => {}} />)
    fireEvent.pointerDown(screen.getByText('Add step'), { button: 0, ctrlKey: false, pointerType: 'mouse' })
    for (const group of ['Interface', 'Data', 'Flow']) {
      expect(screen.getByText(group)).toBeTruthy()
    }
  })
})

describe('platform reporting', () => {
  it('names where the whole graph can run', () => {
    renderEditor(<UiWorkflowEditor value={wf([step('a', 'show_message')])} onChange={() => {}} />)
    expect(screen.getByText(/Runs on:/)).toBeTruthy()
  })
})
