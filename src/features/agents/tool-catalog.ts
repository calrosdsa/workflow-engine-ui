import { useMCPServers } from '@/features/agent-mcp/hooks'
import type { MCPServer } from '@/features/agent-mcp/types'
import { useExposedTools } from '@/features/workflows/hooks'
import type { ExposedTool } from '@/features/workflows/types'

export interface AgentToolCatalogEntry {
  bindingId: string
  modelFacingName: string
  source: 'MCP' | 'Workflow'
  description: string
  origin: string
}

export function buildAgentToolCatalog(
  servers: MCPServer[],
  workflows: ExposedTool[],
): AgentToolCatalogEntry[] {
  const entries: AgentToolCatalogEntry[] = []
  const names = new Set<string>()

  for (const server of servers) {
    for (const tool of server.tools) {
      if (!tool.enabled || names.has(tool.name)) continue
      names.add(tool.name)
      entries.push({
        bindingId: `mcp:${server.id}:${tool.name}`,
        modelFacingName: tool.name,
        source: 'MCP',
        description: tool.description,
        origin: server.name,
      })
    }
  }

  for (const workflow of workflows) {
    if (names.has(workflow.tool_name_normalized)) continue
    names.add(workflow.tool_name_normalized)
    entries.push({
      bindingId: workflow.binding_id,
      modelFacingName: workflow.tool_name_normalized,
      source: 'Workflow',
      description: workflow.description,
      origin: workflow.workflow_name,
    })
  }

  return entries
}

export function useAgentToolCatalog(agentId: string) {
  const serversQuery = useMCPServers(agentId)
  const workflowsQuery = useExposedTools()
  const ready = serversQuery.isSuccess && workflowsQuery.isSuccess

  return {
    tools: buildAgentToolCatalog(serversQuery.data ?? [], workflowsQuery.data ?? []),
    ready,
    loading: !ready && (serversQuery.isPending || workflowsQuery.isPending),
    error: serversQuery.isError || workflowsQuery.isError,
  }
}
