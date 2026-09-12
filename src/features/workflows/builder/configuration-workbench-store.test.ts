import { beforeEach, describe, expect, it } from 'vitest'
import { readNodeWorkbench } from './configuration-workbench'
import { useBuilderStore } from './store'

describe('configuration workbench store seam', () => {
  // seedNew() alone now leaves the canvas empty — create the trigger node
  // this test operates on the same way the onboarding modal does.
  beforeEach(() => {
    useBuilderStore.getState().seedNew()
    useBuilderStore.getState().applyTriggerConfig({ mode: 'on_demand', enabled: true })
  })

  it('saves mock/pinned workbench data as node metadata without changing the node configuration', () => {
    const node = useBuilderStore.getState().nodes.find((candidate) => candidate.data.type === 'trigger')!
    const originalConfiguration = structuredClone(node.data.configuration)

    useBuilderStore.getState().updateNodeWorkbench(node.id, {
      mockOutput: { order: { id: 'demo-1' } },
      pinnedOutput: { order: { id: 'captured-2' } },
    })

    const updated = useBuilderStore.getState().nodes.find((candidate) => candidate.id === node.id)!
    expect(updated.data.configuration).toEqual(originalConfiguration)
    expect(readNodeWorkbench(updated.data)).toMatchObject({
      mockOutput: { order: { id: 'demo-1' } },
      pinnedOutput: { order: { id: 'captured-2' } },
    })
  })
})
