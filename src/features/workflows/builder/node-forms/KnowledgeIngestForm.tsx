// knowledge_ingest — mirrors internal/graph/configs_rag.go's KnowledgeIngestConfig
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { ExpressionField } from '@/features/form-builder/config/ExpressionField'
import { KnowledgeBaseSelect } from '@/features/knowledge/KnowledgeBaseSelect'
import { cn } from '@/lib/utils'
import type { NodeOutputSchema } from '../node-output-schema'
import type { VariableDecl, KnowledgeIngestConfig, ValueMode } from '../../types'

export function normaliseKnowledgeIngestConfig(raw: unknown): KnowledgeIngestConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<KnowledgeIngestConfig>
  return {
    kb_id:          r.kb_id ?? '',
    content_mode:   r.content_mode ?? 'static',
    content:        r.content ?? '',
    content_expr:   r.content_expr ?? '',
    file_name_mode: r.file_name_mode ?? 'static',
    file_name:      r.file_name ?? '',
    file_name_expr: r.file_name_expr ?? '',
    output_var:     r.output_var ?? '',
  }
}

function ModeToggle({ mode, onChange, accent }: { mode: ValueMode; onChange: (m: ValueMode) => void; accent: string }) {
  return (
    <div className="flex gap-1 rounded-lg bg-[hsl(var(--muted))] p-1">
      {(['static', 'expression'] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={cn(
            'flex-1 rounded-md py-1 text-[11px] font-medium transition-colors',
            mode === m ? `${accent} shadow-sm` : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
          )}
        >
          {m === 'static' ? 'Static' : 'Expression'}
        </button>
      ))}
    </div>
  )
}

export interface KnowledgeIngestFormProps {
  config: KnowledgeIngestConfig
  variables: VariableDecl[]
  nodeContext: NodeOutputSchema[]
  onChange: (c: KnowledgeIngestConfig) => void
}

export function KnowledgeIngestForm({ config, variables, nodeContext, onChange }: KnowledgeIngestFormProps) {
  const set = (patch: Partial<KnowledgeIngestConfig>) => onChange({ ...config, ...patch })

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Knowledge Base</Label>
        <KnowledgeBaseSelect value={config.kb_id || undefined} onChange={(id) => set({ kb_id: id ?? '' })} />
      </div>

      <div className="h-px bg-[hsl(var(--border))]" />

      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Content</Label>
        <ModeToggle mode={config.content_mode ?? 'static'} onChange={(m) => set({ content_mode: m })} accent="bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]" />
        {config.content_mode === 'expression' ? (
          <ExpressionField
            value={config.content_expr ?? ''}
            onChange={(v) => set({ content_expr: v })}
            variables={variables}
            nodeContext={nodeContext}
            placeholder="e.g. NodeOutputs.fetch1.records[0].body"
            label="Content"
          />
        ) : (
          <textarea
            value={config.content ?? ''}
            onChange={(e) => set({ content: e.target.value })}
            rows={5}
            placeholder="Document text to add to the knowledge base…"
            className="w-full resize-y rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 py-2 text-[12px] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]/60 focus:border-[hsl(var(--primary))] focus:bg-[hsl(var(--card))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/15"
          />
        )}
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
          Ingestion is asynchronous — this node returns immediately with a pending doc_id; the document is chunked and indexed in the background.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">File Name (optional)</Label>
        <ModeToggle mode={config.file_name_mode ?? 'static'} onChange={(m) => set({ file_name_mode: m })} accent="bg-[hsl(var(--foreground))]/70 text-[hsl(var(--background))]" />
        {config.file_name_mode === 'expression' ? (
          <ExpressionField
            value={config.file_name_expr ?? ''}
            onChange={(v) => set({ file_name_expr: v })}
            variables={variables}
            nodeContext={nodeContext}
            placeholder="e.g. Vars.record.title"
            label="File Name"
          />
        ) : (
          <Input
            value={config.file_name ?? ''}
            onChange={(e) => set({ file_name: e.target.value })}
            placeholder="e.g. support-ticket-482.txt"
            className="h-8 text-[12px]"
          />
        )}
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">A display/citation label — shown in query results and the documents list.</p>
      </div>

      <div className="h-px bg-[hsl(var(--border))]" />

      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Output Variable</Label>
        <Input
          value={config.output_var}
          onChange={(e) => set({ output_var: e.target.value })}
          placeholder="ingest_result"
          className="h-8 font-mono text-[12px]"
        />
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Result published as {'{doc_id, status}'} — both on this node's output and on the named variable.</p>
      </div>
    </div>
  )
}
