// @vitest-environment jsdom
//
// knowledge_base_ids goes into the save only once the list was changed. An
// attached knowledge base the app can no longer read (deleted, or no longer
// shared) would otherwise make every save fail on the server's check, even a
// save that only renamed the Agent. The same omission keeps saves compatible
// with engines that predate episodic memory.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import type { Agent } from '@/features/agents/types'
import { AgentEditorDrawer } from './AgentEditorDrawer'

const mutateAsync = vi.hoisted(() => vi.fn())

vi.mock('@/features/agents/hooks', () => ({
  useUpdateAgent: () => ({ mutateAsync, isPending: false }),
}))
vi.mock('@/features/model-providers/ModelPicker', () => ({ ModelPicker: () => null }))
vi.mock('@/features/agent-mcp/MCPToolsSubsection', () => ({ MCPToolsSubsection: () => null }))
vi.mock('@/features/agent-mcp/WorkflowToolsSubsection', () => ({ WorkflowToolsSubsection: () => null }))
vi.mock('@/features/agents/ToolBindingsSubsection', () => ({ ToolBindingsSubsection: () => null }))
vi.mock('@/features/agents/SkillsSubsection', () => ({ SkillsSubsection: () => null }))
vi.mock('@/features/agents/KnowledgeBasesSubsection', () => ({
  KnowledgeBasesSubsection: ({ onChange }: { onChange: (ids: string[]) => void }) => (
    <button type="button" onClick={() => onChange(['kb-policies'])}>attach policies</button>
  ),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

afterEach(() => {
  cleanup()
  mutateAsync.mockReset()
})

const agent: Agent = {
  id: 'agent-1', app_id: 'app-1', name: 'Support', description: '', instructions: '',
  provider_id: 'p-1', model_id: 'm-1', skills: [], tools: [], enabled: true, session_ttl_days: null,
  knowledge_base_ids: ['kb-deleted'], episodic_memory_enabled: false, created_at: '', updated_at: '',
}

function renderDrawer(memoryEnabled = agent.episodic_memory_enabled, canWrite = true) {
  render(
    <I18nProvider>
      <AgentEditorDrawer
        agent={{ ...agent, episodic_memory_enabled: memoryEnabled }}
        canWrite={canWrite}
        onClose={() => {}}
      />
    </I18nProvider>,
  )
}

describe('AgentEditorDrawer knowledge bases', () => {
  it('leaves knowledge_base_ids out of a save that did not change them', async () => {
    renderDrawer()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1))
    // What goes on the wire: ky sends the payload through JSON.stringify.
    expect(JSON.stringify(mutateAsync.mock.calls[0][0])).not.toContain('knowledge_base_ids')
    expect(JSON.stringify(mutateAsync.mock.calls[0][0])).not.toContain('episodic_memory_enabled')
  })

  it('sends the new list once it was changed', async () => {
    renderDrawer()
    fireEvent.click(screen.getByRole('button', { name: 'attach policies' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1))
    expect(mutateAsync.mock.calls[0][0].knowledge_base_ids).toEqual(['kb-policies'])
  })
})

describe('AgentEditorDrawer memory', () => {
  it('renders the agent’s current memory setting', () => {
    renderDrawer(true)
    expect(screen.getByRole('switch', { name: 'Remember notes about users' }).getAttribute('aria-checked')).toBe('true')
  })

  it('sends the new setting after it is toggled', async () => {
    renderDrawer()
    const memorySwitch = screen.getByRole('switch', { name: 'Remember notes about users' })
    expect(memorySwitch.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(memorySwitch)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1))
    expect(mutateAsync.mock.calls[0][0].episodic_memory_enabled).toBe(true)
  })

  it('disables the switch without write access', () => {
    renderDrawer(false, false)
    expect(screen.getByRole('switch', { name: 'Remember notes about users' }).hasAttribute('disabled')).toBe(true)
  })
})
