import { Plus, Trash2, X, Braces, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useBuilderStore } from './store'
import type { VariableDecl } from '../types'
import { useTranslation } from '@/features/i18n/I18nProvider'

const VAR_TYPES: VariableDecl['type'][] = ['string', 'integer', 'float', 'boolean', 'time', 'datetime', 'object', 'list']

export function VariablesPanel() {
  const t = useTranslation()
  const { variables, setVariables, varsPanelOpen, toggleVarsPanel } = useBuilderStore()

  const add = () =>
    setVariables([...variables, { name: `var_${variables.length + 1}`, type: 'string' }])

  const remove = (i: number) => setVariables(variables.filter((_, idx) => idx !== i))

  const update = (i: number, patch: Partial<VariableDecl>) =>
    setVariables(variables.map((v, idx) => (idx === i ? { ...v, ...patch } : v)))

  // A later duplicate silently overwrites an earlier declaration's default
  // in the runtime state map (keyed by name) — flag every name that isn't
  // unique so the collision is visible before it causes a silent data loss.
  const nameCounts = variables.reduce<Record<string, number>>((acc, v) => {
    if (v.name) acc[v.name] = (acc[v.name] ?? 0) + 1
    return acc
  }, {})
  const isDuplicate = (name: string) => name !== '' && nameCounts[name] > 1

  // Surfaced only through the header's "Variables" tab (WorkflowBuilderPage)
  // — no left-edge collapsed rail of its own, so there is never a thin
  // always-there strip cluttering the canvas edge while it's closed.
  if (!varsPanelOpen) return null

  return (
    <aside className="relative flex w-60 shrink-0 flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--card))]">
      <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-3.5 py-3">
        <div className="flex items-center gap-2">
          <Braces size={14} className="text-[hsl(var(--muted-foreground))]" />
          <span className="text-[13px] font-semibold text-[hsl(var(--foreground))]">{t('workflows.variables.title')}</span>
          {variables.length > 0 && (
            <span className="rounded-full bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[10px] font-bold text-[hsl(var(--muted-foreground))]">{variables.length}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={add} className="h-7 w-7 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
            <Plus size={15} />
          </Button>
          <button
            onClick={toggleVarsPanel}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
            title={t('workflows.variables.close')}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-2.5">
        {variables.length === 0 && (
          <div className="flex flex-col items-center gap-2 pt-8 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--muted))]">
              <Braces size={18} className="text-[hsl(var(--muted-foreground))]" />
            </div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">{t('workflows.variables.empty')}</p>
          </div>
        )}
        {variables.map((v, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 p-2.5 transition-colors hover:border-[hsl(var(--muted-foreground))]/40">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">#{i + 1}</span>
              <button
                onClick={() => remove(i)}
                className="flex h-5 w-5 items-center justify-center rounded text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--destructive))]/10 hover:text-[hsl(var(--destructive))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1"
              >
                <Trash2 size={11} />
              </button>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-[hsl(var(--muted-foreground))]">{t('workflows.variables.name')}</Label>
              <Input
                value={v.name}
                onChange={(e) => update(i, { name: e.target.value })}
                className={cn('h-7 text-xs', isDuplicate(v.name) && 'border-[hsl(var(--destructive))]/50 focus-visible:ring-[hsl(var(--destructive))]/40')}
              />
              {isDuplicate(v.name) && (
                <p className="flex items-center gap-1 text-[10px] text-[hsl(var(--destructive))]">
                  <AlertCircle size={10} className="shrink-0" />
                  {t('workflows.variables.duplicate')}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-[hsl(var(--muted-foreground))]">{t('workflows.variables.type')}</Label>
              <Select value={v.type} onChange={(e) => update(i, { type: e.target.value as VariableDecl['type'] })} className="h-7 text-xs">
                {VAR_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}
