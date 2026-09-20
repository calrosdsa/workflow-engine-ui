import { useMemo } from 'react'
import { ShieldCheck, Workflow } from 'lucide-react'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { useMCPServers } from '@/features/agent-mcp/hooks'
import { useExposedTools } from '@/features/workflows/hooks'
import type { ToolBinding, ToolPolicy } from './types'

interface ToolBindingsSubsectionProps {
  agentId: string
  bindings: ToolBinding[]
  onChange: (bindings: ToolBinding[]) => void
  canWrite: boolean
}

type AvailableTool = {
  id: string
  name: string
  description: string
  source: 'MCP' | 'Workflow'
}

const POLICY_LABELS: Record<ToolPolicy, string> = {
  allow: 'Allow automatically',
  require_approval: 'Ask for approval',
  deny: 'Deny',
}

function workflowToolName(name: string): string {
  const sanitized = name.trim().replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^[_-]+|[_-]+$/g, '')
  return sanitized || 'tool'
}

export function ToolBindingsSubsection({ agentId, bindings, onChange, canWrite }: ToolBindingsSubsectionProps) {
  const { data: servers, isLoading: mcpLoading } = useMCPServers(agentId)
  const { data: workflows, isLoading: workflowLoading } = useExposedTools()

  const available = useMemo<AvailableTool[]>(() => {
    const mcp = (servers ?? []).flatMap((server) =>
      server.tools.filter((tool) => tool.enabled).map((tool) => ({
        id: `mcp:${server.id}:${tool.name}`,
        name: tool.name,
        description: `${tool.description || 'MCP tool'} · ${server.name}`,
        source: 'MCP' as const,
      })),
    )
    const workflow = (workflows ?? []).map((tool) => ({
      id: `workflow:${tool.definition_id}:${workflowToolName(tool.tool_name)}`,
      name: workflowToolName(tool.tool_name),
      description: `${tool.description || 'Workflow tool'} · ${tool.workflow_name}`,
      source: 'Workflow' as const,
    }))
    return [...mcp, ...workflow]
  }, [servers, workflows])

  const bindingByID = new Map(bindings.map((binding) => [binding.id, binding]))
  const isLoading = mcpLoading || workflowLoading

  const setPolicy = (tool: AvailableTool, value: string) => {
    if (value === '__unbound__') {
      onChange(bindings.filter((binding) => binding.id !== tool.id))
      return
    }
    const policy = value as ToolPolicy
    const next = bindings.filter((binding) => binding.id !== tool.id)
    onChange([...next, { id: tool.id, name: tool.name, enabled: true, policy }])
  }

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Tool permissions</h3>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Choose what each enabled tool may do. Saving one binding turns this list into the Agent's explicit allowlist.
        </p>
      </div>

      {isLoading ? (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">Loading available tools…</p>
      ) : available.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[hsl(var(--border))] p-4 text-center text-xs text-[hsl(var(--muted-foreground))]">
          Enable an MCP tool or expose a workflow as a tool first.
        </p>
      ) : (
        <div className="space-y-2">
          {available.map((tool) => {
            const binding = bindingByID.get(tool.id)
            return (
              <div key={tool.id} className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                  {tool.source === 'MCP' ? <ShieldCheck size={14} /> : <Workflow size={14} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs text-[hsl(var(--foreground))]">{tool.name}</p>
                  <p className="truncate text-[11px] text-[hsl(var(--muted-foreground))]">{tool.description}</p>
                </div>
                <SelectMenu
                  value={binding?.policy ?? '__unbound__'}
                  onValueChange={(value) => setPolicy(tool, value)}
                  disabled={!canWrite}
                >
                  <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__unbound__" className="text-xs">Not bound</SelectItem>
                    {(Object.keys(POLICY_LABELS) as ToolPolicy[]).map((policy) => (
                      <SelectItem key={policy} value={policy} className="text-xs">{POLICY_LABELS[policy]}</SelectItem>
                    ))}
                  </SelectContent>
                </SelectMenu>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
