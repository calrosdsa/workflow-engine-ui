// The http_request node's auto-map feature: fires a real request (via
// POST /http-request/test — see lib/api.ts's testHttpRequest) and proposes
// a ResponseSchema from the actual response shape, reviewed and edited
// before being added — see schema-inference.ts for the pure inference
// logic this component drives.
import { useState } from 'react'
import { Play, Loader2, AlertTriangle, RefreshCw, Braces } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { testHttpRequest } from '@/lib/api'
import { inferSchemaFromResponse, inferredSchemaToResponseSchema } from './schema-inference'
import type { InferredField, InferredSchema } from './schema-inference'
import type { HttpRequestConfig, ResponseSchema, VariableDecl, ResponseFieldType } from '../../types'
import { useTranslation } from '@/features/i18n/I18nProvider'

type PanelState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'reviewing'; schemaName: string; statusLine: string; durationMs: number; fields: InferredField[]; inferred: InferredSchema }

const TYPE_BADGE_CLASS: Record<ResponseFieldType, string> = {
  string: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]',
  integer: 'bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]',
  float: 'bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]',
  boolean: 'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]',
  datetime: 'bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]',
  time: 'bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]',
  object: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]',
  list: 'bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]',
}

export function AutoMapPanel({ config, variables, onAddSchema }: {
  config: HttpRequestConfig
  variables: VariableDecl[]
  onAddSchema: (schema: ResponseSchema) => void
}) {
  const t = useTranslation()
  const [state, setState] = useState<PanelState>({ phase: 'idle' })

  const send = async () => {
    setState({ phase: 'loading' })
    try {
      const result = await testHttpRequest({ configuration: config, variables })
      if (result.error) {
        setState({ phase: 'error', message: result.error })
        return
      }
      const inferred = inferSchemaFromResponse(result.body)
      if (!inferred) {
        setState({
          phase: 'error',
          message: result.is_json
            ? t('workflows.auto_map.response_not_mappable')
            : t('workflows.auto_map.response_not_json'),
        })
        return
      }
      setState({
        phase: 'reviewing',
        schemaName: '',
        statusLine: `${result.status} · ${result.duration_ms}ms${inferred.kind === 'list' ? ` · ${describeCount(inferred.count, t)}` : ''}`,
        durationMs: result.duration_ms,
        fields: inferred.fields,
        inferred,
      })
    } catch (e) {
      setState({ phase: 'error', message: e instanceof Error ? e.message : t('workflows.auto_map.request_failed') })
    }
  }

  if (state.phase === 'idle' || state.phase === 'loading') {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={send}
        disabled={state.phase === 'loading'}
        className="h-8 w-full gap-1.5 border-dashed text-[11.5px] text-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]"
      >
        {state.phase === 'loading' ? <Loader2 size={13} className="animate-spin" /> : <Play size={12} />}
        {state.phase === 'loading' ? t('workflows.auto_map.sending') : t('workflows.auto_map.send_request')}
      </Button>
    )
  }

  if (state.phase === 'error') {
    return (
      <div className="rounded-xl border border-[hsl(var(--destructive))]/20 bg-[hsl(var(--destructive))]/10 p-3">
        <div className="flex items-start gap-2">
          <AlertTriangle size={13} className="mt-0.5 shrink-0 text-[hsl(var(--destructive))]" />
          <p className="text-[11.5px] text-[hsl(var(--destructive))]">{state.message}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={send}
          className="mt-2.5 h-7 gap-1.5 text-[11px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
        >
          <RefreshCw size={11} /> {t('workflows.auto_map.retry')}
        </Button>
      </div>
    )
  }

  // phase === 'reviewing'
  const selectedCount = state.fields.filter((f) => f.selected).length
  const update = (id: string, patch: Partial<InferredField>) =>
    setState({ ...state, fields: state.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) })
  const updateNested = (parentId: string, nestedId: string, patch: Partial<InferredField>) =>
    setState({
      ...state,
      fields: state.fields.map((f) =>
        f.id === parentId ? { ...f, fields: (f.fields ?? []).map((nf) => (nf.id === nestedId ? { ...nf, ...patch } : nf)) } : f,
      ),
    })

  const addToSchema = () => {
    const name = state.schemaName.trim() || 'Response'
    onAddSchema(inferredSchemaToResponseSchema(name, state.inferred, state.fields))
    setState({ phase: 'idle' })
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[hsl(var(--border))]">
      <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 py-2">
        <span className="rounded bg-[hsl(var(--success))]/15 px-1.5 py-0.5 text-[10.5px] font-semibold text-[hsl(var(--success))]">
          {state.statusLine.split(' · ')[0]}
        </span>
        <span className="text-[11px] text-[hsl(var(--muted-foreground))]">{state.statusLine.split(' · ').slice(1).join(' · ')}</span>
      </div>

      <div className="space-y-2.5 border-b border-[hsl(var(--border))] p-3">
        <Input
          value={state.schemaName}
          onChange={(e) => setState({ ...state, schemaName: e.target.value })}
          placeholder={t('workflows.auto_map.schema_name')}
          className="h-7 text-[12px] font-semibold"
        />
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{t('workflows.auto_map.review_fields')}</p>

        {state.fields.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[hsl(var(--border))] p-3 text-center text-[11px] text-[hsl(var(--muted-foreground))]">
            {t('workflows.auto_map.no_fields')}
          </p>
        ) : (
          <div className="space-y-1">
            {state.fields.map((f) => (
              <FieldReviewRow
                key={f.id}
                field={f}
                onChange={(patch) => update(f.id, patch)}
                onChangeNested={(nestedId, patch) => updateNested(f.id, nestedId, patch)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-3 py-2.5">
        <span className="text-[10.5px] text-[hsl(var(--muted-foreground))]">
          {t('workflows.auto_map.selected_summary', { selected: selectedCount, total: state.fields.length, suffix: state.fields.length === 1 ? '' : 's' })}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setState({ phase: 'idle' })} className="h-7 text-[11px]">
            {t('common.discard')}
          </Button>
          <Button
            size="sm"
            onClick={addToSchema}
            disabled={selectedCount === 0}
            className="h-7 text-[11px]"
          >
            {t('workflows.auto_map.add_to_schema')}
          </Button>
        </div>
      </div>
    </div>
  )
}

function describeCount(count: number | undefined, t: ReturnType<typeof useTranslation>): string {
  if (count === undefined) return ''
  return t('workflows.auto_map.array_summary', { count, suffix: count === 1 ? '' : 's' })
}

function FieldReviewRow({ field, depth = 0, onChange, onChangeNested }: {
  field: InferredField
  depth?: number
  onChange: (patch: Partial<InferredField>) => void
  onChangeNested: (nestedId: string, patch: Partial<InferredField>) => void
}) {
  const t = useTranslation()
  const isList = field.type === 'list'
  return (
    <div className={depth > 0 ? 'border-l-2 border-[hsl(var(--primary))]/20 pl-2.5' : undefined}>
      <div className="grid grid-cols-[1fr_60px_1fr_20px] items-center gap-2 py-1">
        <div className="flex items-center gap-1.5 overflow-hidden">
          {isList && <Braces size={10} className="shrink-0 text-[hsl(var(--primary))]" />}
          <code className="truncate font-mono text-[11px] text-[hsl(var(--muted-foreground))]" title={field.path}>{field.path}</code>
        </div>
        <span className={cn('w-fit rounded px-1.5 py-0.5 text-[10px] font-medium capitalize', TYPE_BADGE_CLASS[field.type])}>
          {field.type === 'list' ? 'list' : field.type}
        </span>
        <Input
          value={field.name}
          onChange={(e) => onChange({ name: e.target.value })}
          disabled={!field.selected}
          className={cn('h-6.5 text-[11px]', !field.selected && 'opacity-50')}
        />
        <input
          type="checkbox"
          checked={field.selected}
          onChange={(e) => onChange({ selected: e.target.checked })}
          className="justify-self-center"
        />
      </div>
      {!isList && field.sample !== undefined && field.selected && (
        <p className="truncate pb-1 pl-0.5 font-mono text-[10px] text-[hsl(var(--muted-foreground))]/70">= {formatSample(field.sample)}</p>
      )}
      {isList && (
        <div className="space-y-0.5 pb-1 pl-3">
          {(field.fields ?? []).length === 0 ? (
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]/70">{t('workflows.auto_map.no_list_fields')}</p>
          ) : (
            (field.fields ?? []).map((nf) => (
              <FieldReviewRow
                key={nf.id}
                field={nf}
                depth={depth + 1}
                onChange={(patch) => onChangeNested(nf.id, patch)}
                onChangeNested={() => {}}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

function formatSample(v: unknown): string {
  const s = typeof v === 'string' ? v : JSON.stringify(v)
  return s.length > 60 ? `${s.slice(0, 60)}…` : s
}
