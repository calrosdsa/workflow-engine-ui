// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import type { MCPServer } from '@/features/agent-mcp/types'
import type { ExposedTool } from '@/features/workflows/types'
import type { Skill, ToolBinding } from './types'
import { SkillsSubsection } from './SkillsSubsection'

const queryState = vi.hoisted(() => ({
  servers: { data: undefined as MCPServer[] | undefined, isSuccess: true, isPending: false, isError: false },
  workflows: { data: undefined as ExposedTool[] | undefined, isSuccess: true, isPending: false, isError: false },
}))

vi.mock('@/features/agent-mcp/hooks', () => ({ useMCPServers: () => queryState.servers }))
vi.mock('@/features/workflows/hooks', () => ({ useExposedTools: () => queryState.workflows }))

afterEach(() => {
  cleanup()
  queryState.servers = { data: [], isSuccess: true, isPending: false, isError: false }
  queryState.workflows = { data: [], isSuccess: true, isPending: false, isError: false }
})

function server(tools: MCPServer['tools']): MCPServer {
  return {
    id: 'mcp-1', agent_id: 'agent-1', name: 'Billing MCP', url: '', has_token: false, tools,
    last_refreshed_at: '', created_at: '', updated_at: '',
  }
}

function workflow(name: string, overrides: Partial<ExposedTool> = {}): ExposedTool {
  return {
    definition_id: `def-${name}`,
    binding_id: `workflow:def-${name}:${name}`,
    tool_name_normalized: name,
    workflow_name: `${name} workflow`,
    tool_name: name,
    description: `Description for ${name}`,
    parameters: [],
    ...overrides,
  }
}

function renderSkills({
  skills = [],
  bindings = [],
  toolsConfigured,
}: {
  skills?: Skill[]
  bindings?: ToolBinding[]
  toolsConfigured?: boolean
} = {}) {
  const onChange = vi.fn()
  const view = render(
    <I18nProvider>
      <SkillsSubsection
        agentId="agent-1"
        skills={skills}
        bindings={bindings}
        toolsConfigured={toolsConfigured}
        onChange={onChange}
        canWrite
      />
    </I18nProvider>,
  )
  return { onChange, ...view }
}

function fillSkillForm() {
  fireEvent.change(screen.getByPlaceholderText('e.g. Refund Handling'), { target: { value: 'Quotes' } })
  fireEvent.change(screen.getByPlaceholderText('Shown to the model — describe when to use this skill'), { target: { value: 'Handle quote requests' } })
  fireEvent.change(screen.getByPlaceholderText('What should the Agent do when this skill applies?'), { target: { value: 'Send a quote' } })
}

describe('SkillsSubsection allowed tools', () => {
  it('offers workflow tools by normalized name and excludes disabled MCP tools', () => {
    queryState.servers.data = [server([{ name: 'Disabled_tool', description: '', enabled: false }])]
    queryState.workflows.data = [workflow('Send_quote', { tool_name: 'Send quote!' })]
    const { onChange } = renderSkills()

    fireEvent.click(screen.getByRole('button', { name: 'Add skill' }))
    expect(screen.getByRole('checkbox', { name: /Send_quote/ })).toBeTruthy()
    expect(screen.queryByText('Disabled_tool')).toBeNull()
    fireEvent.click(screen.getByRole('checkbox', { name: /Send_quote/ }))
    fillSkillForm()
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ allowed_tools: ['Send_quote'] })])
  })

  it('offers only bound, enabled, non-deny tools when bindings are configured', () => {
    queryState.servers.data = [server([{ name: 'search', description: '', enabled: true }])]
    queryState.workflows.data = [workflow('Send_quote'), workflow('Delete_account')]
    renderSkills({
      bindings: [
        { id: 'mcp:mcp-1:search', name: 'search', enabled: true, policy: 'allow' },
        { id: 'workflow:def-Send_quote:Send_quote', name: 'Send_quote', enabled: true, policy: 'require_approval' },
        { id: 'workflow:def-Delete_account:Delete_account', name: 'Delete_account', enabled: true, policy: 'deny' },
      ],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Add skill' }))
    expect(screen.getByRole('checkbox', { name: /search/ })).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: /Send_quote/ })).toBeTruthy()
    expect(screen.queryByText('Delete_account')).toBeNull()
  })

  it('points to Tool permissions when a configured binding set has no eligible tools', () => {
    queryState.servers.data = [server([{ name: 'search', description: '', enabled: true }])]
    renderSkills({
      bindings: [{ id: 'mcp:mcp-1:search', name: 'search', enabled: true, policy: 'deny' }],
      toolsConfigured: true,
    })

    fireEvent.click(screen.getByRole('button', { name: 'Add skill' }))
    expect(screen.getByText(/Review its bindings in Tool permissions/)).toBeTruthy()
    expect(screen.queryByRole('checkbox', { name: /search/ })).toBeNull()
  })

  it('flags stale skill names on the card and in the dialog, then removes an unchecked name', () => {
    queryState.servers.data = []
    queryState.workflows.data = [workflow('Current_tool')]
    const skill: Skill = {
      name: 'Estimate', description: 'Create estimates', instructions: 'Create one', allowed_tools: ['Removed_tool'],
    }
    const { onChange } = renderSkills({ skills: [skill] })

    expect(screen.getByLabelText(/Removed_tool: This tool is unavailable/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Edit Estimate' }))
    const staleCheckbox = screen.getByRole('checkbox', { name: /Removed_tool/ })
    expect(staleCheckbox.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(staleCheckbox)
    expect(screen.queryByRole('checkbox', { name: /Removed_tool/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ allowed_tools: [] })])
  })

  it('does not mark names stale until both queries succeed', () => {
    const skill: Skill = {
      name: 'Estimate', description: 'Create estimates', instructions: 'Create one', allowed_tools: ['Removed_tool'],
    }
    queryState.servers = { data: undefined, isSuccess: false, isPending: true, isError: false }
    queryState.workflows = { data: [], isSuccess: true, isPending: false, isError: false }
    const view = renderSkills({ skills: [skill] })
    expect(screen.queryByLabelText(/Removed_tool: This tool is unavailable/)).toBeNull()

    queryState.servers = { data: undefined, isSuccess: false, isPending: false, isError: true }
    view.rerender(
      <I18nProvider>
        <SkillsSubsection
          agentId="agent-1" skills={[skill]} bindings={[]} onChange={vi.fn()} canWrite
        />
      </I18nProvider>,
    )
    expect(screen.queryByLabelText(/Removed_tool: This tool is unavailable/)).toBeNull()
  })
})
