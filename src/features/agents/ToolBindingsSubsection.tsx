import { AlertTriangle, ShieldCheck, Trash2, Workflow } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { useAgentToolCatalog } from './tool-catalog'
import type { ToolBinding, ToolPolicy } from './types'
import { useTranslation } from '@/features/i18n/I18nProvider'

interface ToolBindingsSubsectionProps {
  agentId: string
  bindings: ToolBinding[]
  onChange: (bindings: ToolBinding[]) => void
  canWrite: boolean
}

export function ToolBindingsSubsection({ agentId, bindings, onChange, canWrite }: ToolBindingsSubsectionProps) {
  const t = useTranslation()
  const catalog = useAgentToolCatalog(agentId)
  const bindingByID = new Map(bindings.map((binding) => [binding.id, binding]))
  const availableIds = new Set(catalog.tools.map((tool) => tool.bindingId))
  const staleBindings = catalog.ready ? bindings.filter((binding) => !availableIds.has(binding.id)) : []

  const setPolicy = (tool: typeof catalog.tools[number], value: string) => {
    if (value === '__unbound__') {
      onChange(bindings.filter((binding) => binding.id !== tool.bindingId))
      return
    }
    const policy = value as ToolPolicy
    const next = bindings.filter((binding) => binding.id !== tool.bindingId)
    onChange([...next, { id: tool.bindingId, name: tool.modelFacingName, enabled: true, policy }])
  }

  const removeStaleBinding = (bindingId: string) => {
    onChange(bindings.filter((binding) => binding.id !== bindingId))
  }

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">{t('agents.tool_permissions')}</h3>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          {t('agents.tool_permissions_description')}
        </p>
      </div>

      {catalog.error ? (
        <p className="text-xs text-[hsl(var(--destructive))]">{t('agents.tools_load_error')}</p>
      ) : catalog.loading ? (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">{t('agents.loading_tools')}</p>
      ) : catalog.tools.length === 0 && staleBindings.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[hsl(var(--border))] p-4 text-center text-xs text-[hsl(var(--muted-foreground))]">
          {t('agents.enable_tool_first')}
        </p>
      ) : (
        <div className="space-y-2">
          {catalog.tools.map((tool) => {
            const binding = bindingByID.get(tool.bindingId)
            const sourceLabel = t(tool.source === 'MCP' ? 'agents.tool_source_mcp' : 'agents.tool_source_workflow')
            return (
              <div key={tool.bindingId} className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                  {tool.source === 'MCP' ? <ShieldCheck size={14} /> : <Workflow size={14} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs text-[hsl(var(--foreground))]">{tool.modelFacingName}</p>
                  <p className="truncate text-[11px] text-[hsl(var(--muted-foreground))]">
                    {[sourceLabel, tool.origin, tool.description].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <SelectMenu
                  value={binding?.policy ?? '__unbound__'}
                  onValueChange={(value) => setPolicy(tool, value)}
                  disabled={!canWrite}
                >
                  <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__unbound__" className="text-xs">{t('agents.tool_not_bound')}</SelectItem>
                    {(Object.keys({ allow: true, require_approval: true, deny: true }) as ToolPolicy[]).map((policy) => (
                      <SelectItem key={policy} value={policy} className="text-xs">{t(`agents.tool_policy_${policy}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </SelectMenu>
              </div>
            )
          })}
          {staleBindings.map((binding, index) => {
            const name = binding.name || binding.id
            return (
              <div key={`${binding.id}-${index}`} className="flex items-center gap-3 rounded-lg border border-[hsl(var(--destructive))] bg-[hsl(var(--destructive))]/5 p-3">
                <AlertTriangle size={16} aria-hidden="true" className="shrink-0 text-[hsl(var(--destructive))]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs text-[hsl(var(--foreground))]">{name}</p>
                  <p className="text-[11px] text-[hsl(var(--destructive))]">
                    {t('agents.stale_tool_binding', { name })}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={!canWrite}
                  onClick={() => removeStaleBinding(binding.id)}
                  aria-label={t('agents.remove_stale_tool_binding', { name })}
                  title={t('agents.remove_stale_tool_binding', { name })}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
