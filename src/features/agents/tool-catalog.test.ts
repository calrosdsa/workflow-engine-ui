import { describe, expect, it } from 'vitest'
import type { MCPServer } from '@/features/agent-mcp/types'
import type { ExposedTool } from '@/features/workflows/types'
import { buildAgentToolCatalog } from './tool-catalog'

function server(id: string, name: string, tools: MCPServer['tools']): MCPServer {
  return {
    id,
    agent_id: 'agent-1',
    name,
    url: 'https://example.test/mcp',
    has_token: false,
    tools,
    last_refreshed_at: '',
    created_at: '',
    updated_at: '',
  }
}

function workflow(overrides: Partial<ExposedTool> = {}): ExposedTool {
  return {
    definition_id: 'def-1',
    binding_id: 'workflow:def-1:Send_quote',
    tool_name_normalized: 'Send_quote',
    workflow_name: 'Send a quote',
    tool_name: 'Send quote!',
    description: 'Sends a quote',
    parameters: [],
    ...overrides,
  }
}

describe('buildAgentToolCatalog', () => {
  it('keeps a workflow when a same-name MCP tool is disabled', () => {
    const catalog = buildAgentToolCatalog(
      [server('mcp-1', 'Quotes MCP', [{ name: 'Send_quote', description: '', enabled: false }])],
      [workflow()],
    )

    expect(catalog).toEqual([expect.objectContaining({
      bindingId: 'workflow:def-1:Send_quote',
      modelFacingName: 'Send_quote',
      source: 'Workflow',
      origin: 'Send a quote',
    })])
  })

  it('lets an enabled MCP tool hide a same-name workflow tool', () => {
    const catalog = buildAgentToolCatalog(
      [server('mcp-1', 'Quotes MCP', [{ name: 'Send_quote', description: 'MCP quote', enabled: true }])],
      [workflow()],
    )

    expect(catalog).toHaveLength(1)
    expect(catalog[0]).toMatchObject({ bindingId: 'mcp:mcp-1:Send_quote', source: 'MCP' })
  })

  it('preserves server order and first-name-wins behavior across servers', () => {
    const catalog = buildAgentToolCatalog(
      [
        server('mcp-2', 'Second in response', [{ name: 'lookup', description: '', enabled: true }]),
        server('mcp-1', 'First in response', [
          { name: 'lookup', description: '', enabled: true },
          { name: 'create', description: '', enabled: true },
        ]),
      ],
      [],
    )

    expect(catalog.map((tool) => tool.modelFacingName)).toEqual(['lookup', 'create'])
    expect(catalog[0].origin).toBe('Second in response')
  })

  it('uses the server workflow binding id and normalized name', () => {
    const catalog = buildAgentToolCatalog([], [workflow({
      binding_id: 'workflow:def-9:Send_quote',
      tool_name_normalized: 'Send_quote',
      tool_name: 'Send quote!',
    })])

    expect(catalog[0]).toMatchObject({
      bindingId: 'workflow:def-9:Send_quote',
      modelFacingName: 'Send_quote',
    })
  })
})
