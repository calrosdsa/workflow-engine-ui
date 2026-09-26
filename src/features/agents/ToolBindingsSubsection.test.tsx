// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import type { MCPServer } from '@/features/agent-mcp/types'
import type { ExposedTool } from '@/features/workflows/types'
import type { ToolBinding } from './types'
import { ToolBindingsSubsection } from './ToolBindingsSubsection'

const queryState = vi.hoisted(() => ({
  servers: { data: undefined as MCPServer[] | undefined, isSuccess: true, isPending: false, isError: false },
  workflows: { data: undefined as ExposedTool[] | undefined, isSuccess: true, isPending: false, isError: false },
}))

vi.mock('@/features/agent-mcp/hooks', () => ({ useMCPServers: () => queryState.servers }))
vi.mock('@/features/workflows/hooks', () => ({ useExposedTools: () => queryState.workflows }))

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

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

function workflow(overrides: Partial<ExposedTool> = {}): ExposedTool {
  return {
    definition_id: 'def-1', binding_id: 'workflow:def-1:Send_quote', tool_name_normalized: 'Send_quote',
    workflow_name: 'Send a quote', tool_name: 'Send quote!', description: 'Sends a quote', parameters: [],
    ...overrides,
  }
}

function renderBindings(bindings: ToolBinding[] = [], canWrite = true) {
  const onChange = vi.fn()
  render(
    <I18nProvider>
      <ToolBindingsSubsection agentId="agent-1" bindings={bindings} onChange={onChange} canWrite={canWrite} />
    </I18nProvider>,
  )
  return onChange
}

describe('ToolBindingsSubsection', () => {
  it('creates a binding with the server binding id and normalized model name', async () => {
    queryState.workflows.data = [workflow()]
    const onChange = renderBindings()

    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(await screen.findByRole('option', { name: 'Allow automatically' }))

    await waitFor(() => expect(onChange).toHaveBeenCalledWith([{
      id: 'workflow:def-1:Send_quote', name: 'Send_quote', enabled: true, policy: 'allow',
    }]))
  })

  it('does not offer a workflow hidden by an enabled MCP tool with the same name', () => {
    queryState.servers.data = [server([{ name: 'Send_quote', description: 'MCP send', enabled: true }])]
    queryState.workflows.data = [workflow()]
    renderBindings()

    expect(screen.getAllByText('Send_quote')).toHaveLength(1)
    expect(screen.getByText(/Billing MCP/)).toBeTruthy()
    expect(screen.queryByText(/Send a quote/)).toBeNull()
  })

  it('flags a saved stale binding and removes it', () => {
    const stale: ToolBinding = { id: 'mcp:deleted:missing', name: 'missing', enabled: true, policy: 'allow' }
    const onChange = renderBindings([stale])

    expect(screen.getByText(/Every run of this Agent fails until this binding is removed/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Remove unavailable binding for missing' }))
    expect(onChange).toHaveBeenCalledWith([])
  })

  it('disables stale binding removal without write access', () => {
    const stale: ToolBinding = { id: 'mcp:deleted:missing', name: 'missing', enabled: true, policy: 'allow' }
    renderBindings([stale], false)

    expect(screen.getByRole('button', { name: 'Remove unavailable binding for missing' }).hasAttribute('disabled')).toBe(true)
  })

  it('does not flag a stale binding while loading or after a query error', () => {
    const stale: ToolBinding = { id: 'mcp:deleted:missing', name: 'missing', enabled: true, policy: 'allow' }
    queryState.servers = { data: undefined, isSuccess: false, isPending: true, isError: false }
    queryState.workflows = { data: [], isSuccess: true, isPending: false, isError: false }
    const onChange = vi.fn()
    const view = render(
      <I18nProvider>
        <ToolBindingsSubsection agentId="agent-1" bindings={[stale]} onChange={onChange} canWrite />
      </I18nProvider>,
    )
    expect(screen.queryByText(/Every run of this Agent fails/)).toBeNull()

    queryState.servers = { data: undefined, isSuccess: false, isPending: false, isError: true }
    view.rerender(
      <I18nProvider>
        <ToolBindingsSubsection agentId="agent-1" bindings={[stale]} onChange={vi.fn()} canWrite />
      </I18nProvider>,
    )
    expect(screen.getByText('Available tools could not be loaded.')).toBeTruthy()
    expect(screen.queryByText(/Every run of this Agent fails/)).toBeNull()
  })
})
