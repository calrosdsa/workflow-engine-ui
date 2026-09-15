// debug — mirrors internal/graph/configs_debug.go
import { useState } from 'react'
import { Plus, Trash2, Braces, Code2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ExpressionEditor } from '../ExpressionEditor'
import { nanoid } from '../nanoid'
import type { NodeOutputSchema } from '../node-output-schema'
import type { VariableDecl, DebugConfig, DebugWatch } from '../../types'
import { useI18n } from '@/features/i18n/I18nProvider'

// debug — normalises the legacy shape (label only, no watches) forward;
// re-attaches a local id to any watch missing one, same convention every
// other list-of-rows config in this builder uses (e.g. SetVariableConfig's
// assignments, FetchRecordsConfig's sort rules).
export function normaliseDebugConfig(raw: unknown): DebugConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<DebugConfig>
  const watches = Array.isArray(r.watches)
    ? r.watches.map((w) => ({ id: (w as Partial<DebugWatch>).id || nanoid(), name: w.name ?? '', expression: w.expression ?? '' }))
    : []
  return { label: r.label ?? '', watches }
}

export interface DebugFormProps {
  config: DebugConfig
  variables: VariableDecl[]
  nodeContext: NodeOutputSchema[]
  onChange: (c: DebugConfig) => void
}

export function DebugForm({ config, variables, nodeContext, onChange }: DebugFormProps) {
  const { t } = useI18n()
  const [editorOpen, setEditorOpen] = useState<string | null>(null) // watch id

  const watches = config.watches ?? []

  const update = (id: string, patch: Partial<DebugWatch>) => {
    onChange({ ...config, watches: watches.map((w) => (w.id === id ? { ...w, ...patch } : w)) })
  }

  const add = () => {
    onChange({ ...config, watches: [...watches, { id: nanoid(), name: '', expression: '' }] })
  }

  const remove = (id: string) => {
    onChange({ ...config, watches: watches.filter((w) => w.id !== id) })
  }

  const openingWatch = editorOpen ? watches.find((w) => w.id === editorOpen) : null

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('workflows.node_forms.label_optional')}</Label>
        <Input
          value={config.label ?? ''}
          onChange={(e) => onChange({ ...config, label: e.target.value })}
          placeholder="e.g. after fetching records"
          className="h-8 text-[12px]"
        />
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
          {t('workflows.node_forms.debug_label_help')}
        </p>
      </div>

      <div className="h-px bg-[hsl(var(--border))]" />

      <div className="flex items-center justify-between">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('workflows.node_forms.watches_optional')}</Label>
        <span className="rounded-full bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[10px] font-medium text-[hsl(var(--muted-foreground))]">
          {watches.length}
        </span>
      </div>
      <p className="-mt-2 text-[10px] text-[hsl(var(--muted-foreground))]">
        {t('workflows.node_forms.debug_watch_help')}
      </p>

      {watches.length === 0 && (
        <div className="rounded-lg border border-dashed border-[hsl(var(--border))] p-4 text-center text-xs text-[hsl(var(--muted-foreground))]">
          {t('workflows.node_forms.no_watches')}
        </div>
      )}

      <div className="space-y-2">
        {watches.map((w, idx) => (
          <WatchRow
            key={w.id}
            index={idx}
            watch={w}
            onChange={(patch) => update(w.id, patch)}
            onDelete={() => remove(w.id)}
            onOpenEditor={() => setEditorOpen(w.id)}
          />
        ))}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={add}
        className="w-full gap-1.5 border-dashed text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
      >
        <Plus size={13} />
        {t('workflows.node_forms.add_watch')}
      </Button>

      {openingWatch && (
        <ExpressionEditor
          open={editorOpen !== null}
          onClose={() => setEditorOpen(null)}
          value={openingWatch.expression}
          onChange={(expr) => update(openingWatch.id, { expression: expr })}
          variables={variables}
          nodeContext={nodeContext}
          label={openingWatch.name || t('workflows.node_forms.watches_optional')}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Single watch row
// ---------------------------------------------------------------------------

interface WatchRowProps {
  index: number
  watch: DebugWatch
  onChange: (patch: Partial<DebugWatch>) => void
  onDelete: () => void
  onOpenEditor: () => void
}

function WatchRow({ index, watch, onChange, onDelete, onOpenEditor }: WatchRowProps) {
  const { t } = useI18n()
  return (
    <div className="group relative rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 p-3 transition-shadow hover:shadow-sm">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--muted))] text-[10px] font-bold text-[hsl(var(--muted-foreground))]">
          {index + 1}
        </span>
        <input
          value={watch.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={t('workflows.node_forms.name_example')}
          className="flex-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2.5 py-1.5 text-[12px] font-medium text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]/60 focus:border-[hsl(var(--primary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/15"
        />
        <button
          onClick={onDelete}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--destructive))]/10 hover:text-[hsl(var(--destructive))]"
          title={t('workflows.node_forms.remove_watch')}
        >
          <Trash2 size={12} />
        </button>
      </div>

      <div className="flex items-start gap-1.5">
        <div className="relative flex-1">
          <Braces size={11} className="absolute left-2.5 top-2 text-[hsl(var(--primary))]" />
          <textarea
            value={watch.expression}
            onChange={(e) => onChange({ expression: e.target.value })}
            placeholder='e.g. Vars["count"] + 1'
            rows={2}
            className="w-full resize-y rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] py-1.5 pl-7 pr-2 font-mono text-[11px] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]/60 focus:border-[hsl(var(--primary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/15"
          />
        </div>
        <button
          onClick={onOpenEditor}
          title={t('workflows.builder.open_expression')}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))] transition-colors hover:border-[hsl(var(--primary))]/50 hover:bg-[hsl(var(--primary))]/10 hover:text-[hsl(var(--primary))]"
        >
          <Code2 size={13} />
        </button>
      </div>
    </div>
  )
}
