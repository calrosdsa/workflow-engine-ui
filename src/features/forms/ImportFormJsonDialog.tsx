import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { AlertTriangle, Braces, CheckCircle2, FileWarning } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { parseFormSpec, acceptedTypeNames } from '@/features/form-builder/form-spec'
import { stageNewForm } from '@/features/form-builder/store'

interface ImportFormJsonDialogProps {
  appId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Shown in the empty textarea as a starting point, and by "Insert example".
 *  Deliberately the COMPACT shape: it's what someone writing by hand (or
 *  prompting an agent) should reach for, and it demonstrates the three
 *  things that aren't guessable — sections, options, and field flags. */
const EXAMPLE_SPEC = `{
  "name": "Purchase Order",
  "description": "Tracks purchase orders and their approval state",
  "sections": [
    {
      "title": "Order",
      "layout": "2",
      "fields": [
        { "key": "po_number", "label": "PO Number", "type": "text", "required": true, "unique": true, "recordTitle": true },
        { "key": "vendor", "label": "Vendor", "type": "text", "searchable": true },
        { "key": "ordered_on", "label": "Ordered On", "type": "date" },
        { "key": "amount", "label": "Amount", "type": "number", "min": 0 }
      ]
    },
    {
      "title": "Approval",
      "fields": [
        { "key": "status", "label": "Status", "type": "select",
          "options": ["Draft", "Submitted", "Approved", "Rejected"] },
        { "key": "notes", "label": "Notes", "type": "longtext" }
      ]
    }
  ]
}`

/** "JSON specification" — creates a form from a JSON definition instead of
 *  from the canvas. This is the path an AI agent is expected to use.
 *
 *  It does NOT create the form itself. It parses, shows what it understood,
 *  then stages the result and hands off to the ordinary blank-builder route
 *  with the canvas pre-filled and unsaved. That's deliberate on two counts:
 *  an agent-authored spec is worth looking at before it becomes real
 *  Postgres columns, and the real create path (field projection, reference
 *  validation, Line Items child sync, slug-conflict handling, migration
 *  warnings) already lives in FormBuilderPage — duplicating any of it here
 *  would mean two implementations of "save a new form" drifting apart. */
export function ImportFormJsonDialog({ appId, open, onOpenChange }: ImportFormJsonDialogProps) {
  const navigate = useNavigate()
  const [raw, setRaw] = useState('')

  // Parsed on every keystroke: the spec is small, the parser never throws,
  // and live feedback is the whole point — an author pasting agent output
  // wants to see what was and wasn't understood before committing.
  const result = useMemo(() => (raw.trim() ? parseFormSpec(raw) : null), [raw])

  const preview = useMemo(() => {
    if (!result?.ok) return null
    const sections = result.form.schema.sections
    return {
      name: result.form.name,
      slug: result.form.slug,
      mode: result.mode,
      sectionCount: sections.length,
      fields: sections.flatMap((s) => s.columns.flatMap((c) => c.elements)),
    }
  }, [result])

  const close = () => {
    onOpenChange(false)
    // Cleared on close so reopening starts fresh rather than resurrecting a
    // spec the author walked away from.
    setRaw('')
  }

  const openInBuilder = () => {
    if (!result?.ok) return
    // The token, not the spec, travels in the URL — see stageNewForm.
    const seed = stageNewForm(result.form)
    close()
    navigate({ to: '/applications/$appId/forms/new', params: { appId }, search: { seed } })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="flex max-h-[85vh] w-full max-w-2xl flex-col">
        <DialogHeader>
          <DialogTitle>New form from a JSON specification</DialogTitle>
          <DialogDescription>
            Paste a form definition. Two shapes are accepted: a compact spec (a name and a list of fields)
            or the full native definition exported from an existing form. The form opens in the builder for
            review — nothing is created until you save it there.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-1 mt-1 flex-1 space-y-3 overflow-y-auto px-1">
          <Textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={EXAMPLE_SPEC}
            spellCheck={false}
            className="min-h-[220px] font-mono text-xs leading-relaxed"
          />

          {!raw.trim() && (
            <div className="flex items-center justify-between rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 px-3 py-2">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Field types accept builder names and the backend&apos;s own names — {acceptedTypeNames().length} in
                all, e.g. text, longtext, number, date, select, checkbox, reference.
              </p>
              <Button size="sm" variant="ghost" className="shrink-0" onClick={() => setRaw(EXAMPLE_SPEC)}>
                Insert example
              </Button>
            </div>
          )}

          {result && !result.ok && (
            <div className="rounded-md border border-[hsl(var(--destructive))]/40 bg-[hsl(var(--destructive))]/5 px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--destructive))]">
                <FileWarning size={13} /> This spec can&apos;t be imported yet
              </p>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs text-[hsl(var(--destructive))]">
                {result.errors.map((e) => <li key={e}>{e}</li>)}
              </ul>
            </div>
          )}

          {preview && (
            <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="shrink-0 text-[hsl(var(--success))]" />
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-[hsl(var(--foreground))]">
                  {preview.name}
                </p>
                <Badge variant="secondary" className="shrink-0">
                  {preview.mode === 'native' ? 'Native definition' : 'Compact spec'}
                </Badge>
              </div>
              <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">
                <span className="font-mono">{preview.slug}</span>
                {' · '}{preview.sectionCount} section{preview.sectionCount === 1 ? '' : 's'}
                {' · '}{preview.fields.length} field{preview.fields.length === 1 ? '' : 's'}
              </p>
              {preview.fields.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {preview.fields.map((f) => (
                    <span
                      key={f.id}
                      className="inline-flex items-center gap-1 rounded border border-[hsl(var(--border))] px-1.5 py-0.5 text-[11px] text-[hsl(var(--muted-foreground))]"
                      title={`${f.key} — ${f.component}`}
                    >
                      <span className="text-[hsl(var(--foreground))]">{f.label}</span>
                      <span className="font-mono opacity-70">{f.component}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {result?.ok && result.warnings.length > 0 && (
            <div className="rounded-md border border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/5 px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--warning))]">
                <AlertTriangle size={13} /> Imported with changes
              </p>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                {result.warnings.map((wmsg) => <li key={wmsg}>{wmsg}</li>)}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="mt-2">
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button onClick={openInBuilder} disabled={!result?.ok}>
            <Braces size={15} />Open in builder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
