// Workflow Tools section within the Agent editor (FR-C8-004) — the read
// side of TriggerForm.tsx's "Expose as tool" authoring flag. Deliberately
// READ-ONLY: unlike MCPToolsSubsection.tsx (FR-C8-003), there is no
// enable/disable or register action here, because no ToolExecutor of any
// kind (MCP or workflow) exists anywhere in this codebase yet — an entry
// here is visible/selectable-in-principle, not yet actually callable by an
// Agent mid-conversation. This section exists so FR-C8-004's authoring flag
// has somewhere real to show up, per that document's own resolved
// "authoring only" scope; the day real tool-calling is built, this becomes
// the natural place to add enable/disable controls, matching MCP Tools'
// shape.
import { Workflow, Braces } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { useExposedTools } from '@/features/workflows/hooks'
import { useI18n } from '@/features/i18n/I18nProvider'

export function WorkflowToolsSubsection() {
  const { t } = useI18n()
  const { data: tools, isLoading } = useExposedTools()

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">{t('agent_tools.workflow')}</h3>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          {t('agent_tools.workflow_description')}
        </p>
      </div>

      {isLoading ? (
        <div className="flex h-16 items-center justify-center"><Spinner /></div>
      ) : !tools?.length ? (
        <div className="rounded-lg border border-dashed border-[hsl(var(--border))] p-4 text-center text-xs text-[hsl(var(--muted-foreground))]">
          {t('agent_tools.workflow_empty')}
        </div>
      ) : (
        <div className="space-y-2">
          {tools.map((t) => (
            <div key={t.definition_id} className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                  <Workflow size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[hsl(var(--foreground))]">{t.tool_name}</p>
                  <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                    {t.description} · from workflow "{t.workflow_name}"
                  </p>
                  {t.parameters.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {t.parameters.map((p) => (
                        <span
                          key={p.variable_name}
                          className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--border))] px-2 py-0.5 font-mono text-[10px] text-[hsl(var(--muted-foreground))]"
                          title={p.description}
                        >
                          <Braces size={9} />{p.variable_name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
