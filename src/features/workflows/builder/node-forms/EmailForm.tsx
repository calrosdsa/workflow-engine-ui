// email — mirrors internal/graph/configs_email.go
//
// Every field here is a TEMPLATE, not a static-or-expression pair: literal
// text with {{ }} holes holding ordinary Expr expressions. That is why this
// form has no mode toggle where NotificationForm has one — text with no holes
// IS the static case, so the toggle would be a choice with no consequence.
//
// The "Insert field" button is the whole authoring story: it opens the same
// expression editor every other node uses (autocomplete, live validation, the
// variable browser) and drops the result in as a hole at the cursor. An author
// never has to know the brace syntax to use it, and an author who does can
// type it directly.
import { useRef, useState } from 'react'
import { Braces, Mail } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ExpressionEditor } from '../ExpressionEditor'
import type { NodeOutputSchema } from '../node-output-schema'
import type { VariableDecl, EmailConfig } from '../../types'

export function normaliseEmailConfig(raw: unknown): EmailConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<EmailConfig>
  return {
    to: r.to ?? '',
    reply_to: r.reply_to ?? '',
    subject: r.subject ?? '',
    body: r.body ?? '',
  }
}

type FieldEl = HTMLInputElement | HTMLTextAreaElement

// insertHole splices `{{ expr }}` into value at the caret, replacing whatever
// is selected. Falls back to appending when the element never held focus, so
// the button always does something visible rather than silently no-op'ing.
function insertHole(el: FieldEl | null, value: string, expression: string): { next: string; caret: number } {
  const hole = `{{ ${expression} }}`
  if (!el) return { next: value + hole, caret: value.length + hole.length }
  const start = el.selectionStart ?? value.length
  const end = el.selectionEnd ?? start
  const next = value.slice(0, start) + hole + value.slice(end)
  return { next, caret: start + hole.length }
}

interface TemplateFieldProps {
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
  variables: VariableDecl[]
  nodeContext: NodeOutputSchema[]
  placeholder?: string
  multiline?: boolean
  rows?: number
  mono?: boolean
}

function TemplateField({
  label, hint, value, onChange, variables, nodeContext, placeholder, multiline, rows = 8, mono,
}: TemplateFieldProps) {
  const [editorOpen, setEditorOpen] = useState(false)
  const ref = useRef<FieldEl | null>(null)
  // Captured when the editor opens, because focus moves into the dialog and
  // the field's own selection is gone by the time a value comes back.
  const caret = useRef<{ start: number; end: number } | null>(null)

  const openEditor = () => {
    const el = ref.current
    caret.current = el ? { start: el.selectionStart ?? value.length, end: el.selectionEnd ?? value.length } : null
    setEditorOpen(true)
  }

  const applyExpression = (expression: string) => {
    if (!expression.trim()) return
    const el = ref.current
    if (el && caret.current) {
      el.selectionStart = caret.current.start
      el.selectionEnd = caret.current.end
    }
    const { next, caret: pos } = insertHole(el, value, expression.trim())
    onChange(next)
    // Restore the caret after React re-renders with the new value, so an
    // author can keep typing where they left off instead of at the end.
    requestAnimationFrame(() => {
      const target = ref.current
      if (!target) return
      target.focus()
      target.selectionStart = pos
      target.selectionEnd = pos
    })
  }

  const shared = {
    value,
    placeholder,
    onChange: (e: React.ChangeEvent<FieldEl>) => onChange(e.target.value),
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
          {label}
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={openEditor}
          className="h-6 gap-1 px-2 text-[10px] font-medium text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/10"
        >
          <Braces size={11} />
          Insert field
        </Button>
      </div>

      {multiline ? (
        <textarea
          {...shared}
          ref={(el) => { ref.current = el }}
          rows={rows}
          className={`w-full resize-y rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 py-2 text-[12px] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]/60 focus:border-[hsl(var(--primary))] focus:bg-[hsl(var(--card))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/15 ${mono ? 'font-mono' : ''}`}
        />
      ) : (
        <Input
          {...shared}
          ref={(el) => { ref.current = el }}
          className={`h-8 text-[12px] ${mono ? 'font-mono' : ''}`}
        />
      )}

      {hint && <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{hint}</p>}

      <ExpressionEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        value=""
        onChange={applyExpression}
        variables={variables}
        nodeContext={nodeContext}
        label={`${label} — field to insert`}
      />
    </div>
  )
}

export interface EmailFormProps {
  config: EmailConfig
  variables: VariableDecl[]
  nodeContext: NodeOutputSchema[]
  onChange: (c: EmailConfig) => void
}

export function EmailForm({ config, variables, nodeContext, onChange }: EmailFormProps) {
  const set = (patch: Partial<EmailConfig>) => onChange({ ...config, ...patch })
  const shared = { variables, nodeContext }

  return (
    <div className="space-y-4">
      <TemplateField
        {...shared}
        label="To"
        value={config.to}
        onChange={(v) => set({ to: v })}
        placeholder="ops@example.com"
        hint="One recipient. To email several people, put this node inside a loop over the addresses."
        mono
      />

      <TemplateField
        {...shared}
        label="Reply-To (optional)"
        value={config.reply_to ?? ''}
        onChange={(v) => set({ reply_to: v })}
        placeholder="support@example.com"
        hint="Every tenant's mail is sent from one platform-wide address, so this is how a reply reaches the right person."
        mono
      />

      <div className="h-px bg-[hsl(var(--border))]" />

      <TemplateField
        {...shared}
        label="Subject"
        value={config.subject}
        onChange={(v) => set({ subject: v })}
        placeholder="Your order has shipped"
      />

      <TemplateField
        {...shared}
        label="Body (HTML)"
        value={config.body}
        onChange={(v) => set({ body: v })}
        placeholder={'<p>Hi {{ Vars["customer_name"] }},</p>\n<p>Your order has shipped.</p>'}
        multiline
        mono
      />

      <div className="flex gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50 p-2.5">
        <Mail size={13} className="mt-0.5 shrink-0 text-[hsl(var(--primary))]" />
        <p className="text-[10px] leading-relaxed text-[hsl(var(--muted-foreground))]">
          Write the body as HTML. Inserted field values are escaped, so a record containing
          <span className="font-mono"> &lt;b&gt; </span>
          arrives as text rather than as markup — put the formatting in the template itself.
          Attachments and CC/BCC are not supported.
        </p>
      </div>
    </div>
  )
}
