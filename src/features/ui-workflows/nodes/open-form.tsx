import { FilePlus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Trash2, Plus } from 'lucide-react'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { Label } from '@/components/ui/label'
import { FormReferenceSelect } from '@/features/form-builder/config/FormReferenceSelect'
import { registerUiWorkflowNode, type UiWorkflowNodeConfigPanelProps } from '../node-registry'
import { Field } from './panel-kit'
import { resolveValue } from '../values'
import { MAX_FORM_DEPTH } from '../host'
import { ALL_PLATFORMS } from '../types'

/** Opens a form for the viewer to fill in, and waits.
 *
 *  The second suspending node, and the only one that can start further
 *  workflow runs: the form it opens is a REAL form, so its own after-submit
 *  and field-change workflows run exactly as they would if the viewer had
 *  navigated to it. That is deliberate — an author who put an after-submit
 *  workflow on "Customer" expects it when a customer is created, however that
 *  happened — and it is why depth is bounded rather than nesting being banned.
 *
 *  Prefill is what makes this more than "go to the Add page": the step already
 *  knows the order it is attached to, so the customer form can open with the
 *  order's contact details already in it. */
export interface OpenFormPrefill {
  field: string
  source: 'static' | 'variable' | 'field'
  value?: unknown
  variable?: string
  from_field?: string
}

export interface OpenFormStepConfig {
  form_id: string
  title?: string
  prefill: OpenFormPrefill[]
  /** Run variable the new record's id lands in, when they save. */
  output_variable?: string
  /** What a dismissal does. Stopping is the default for the same reason
   *  show_dialog's is: the usual shape is "make one of these, then use it",
   *  and carrying on without it would act on a record that does not exist. */
  on_cancel: 'stop' | 'continue'
}

export function emptyOpenFormConfig(): OpenFormStepConfig {
  return { form_id: '', prefill: [], on_cancel: 'stop' }
}

export function parseOpenFormConfig(raw: unknown): OpenFormStepConfig {
  const empty = emptyOpenFormConfig()
  if (!raw || typeof raw !== 'object') return empty
  const r = raw as Record<string, unknown>
  const prefill: OpenFormPrefill[] = []
  if (Array.isArray(r.prefill)) {
    for (const entry of r.prefill) {
      if (!entry || typeof entry !== 'object') continue
      const e = entry as Record<string, unknown>
      if (typeof e.field !== 'string' || !e.field) continue
      prefill.push({
        field: e.field,
        source: e.source === 'variable' || e.source === 'field' ? e.source : 'static',
        value: 'value' in e ? e.value : undefined,
        variable: typeof e.variable === 'string' ? e.variable : undefined,
        from_field: typeof e.from_field === 'string' ? e.from_field : undefined,
      })
    }
  }
  return {
    form_id: typeof r.form_id === 'string' ? r.form_id : empty.form_id,
    title: typeof r.title === 'string' ? r.title : undefined,
    prefill,
    output_variable: typeof r.output_variable === 'string' ? r.output_variable : undefined,
    on_cancel: r.on_cancel === 'continue' ? 'continue' : 'stop',
  }
}

function OpenFormPanel({ config, onChange }: UiWorkflowNodeConfigPanelProps<OpenFormStepConfig>) {
  const setPrefill = (i: number, patch: Partial<OpenFormPrefill>) =>
    onChange({ ...config, prefill: config.prefill.map((p, idx) => (idx === i ? { ...p, ...patch } : p)) })

  return (
    <div className="space-y-2">
      <Field label="Form to open" hint="Opens in a dialog. Its own rules and workflows apply, exactly as if they had navigated to it.">
        <FormReferenceSelect
          value={config.form_id}
          onChange={(form_id) => onChange({ ...config, form_id: form_id ?? '' })}
        />
      </Field>

      <Field label="Dialog title">
        <Input
          value={config.title ?? ''}
          onChange={(e) => onChange({ ...config, title: e.target.value })}
          placeholder="New Customer"
          className="h-8 text-[12px]"
        />
      </Field>

      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Start with these values</Label>
        {config.prefill.length === 0 && (
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
            Nothing prefilled — the form opens empty.
          </p>
        )}
        {config.prefill.map((entry, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <Input
              value={entry.field}
              onChange={(e) => setPrefill(i, { field: e.target.value })}
              placeholder="field on that form"
              className="h-8 min-w-0 flex-1 font-mono text-[11px]"
            />
            <SelectMenu value={entry.source} onValueChange={(v) => setPrefill(i, { source: v as OpenFormPrefill['source'] })}>
              <SelectTrigger className="h-8 w-24 shrink-0 text-[11px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="static" className="text-[12px]">Value</SelectItem>
                <SelectItem value="variable" className="text-[12px]">Variable</SelectItem>
                <SelectItem value="field" className="text-[12px]">This record</SelectItem>
              </SelectContent>
            </SelectMenu>
            <Input
              value={
                entry.source === 'variable' ? (entry.variable ?? '')
                : entry.source === 'field' ? (entry.from_field ?? '')
                : String(entry.value ?? '')
              }
              onChange={(e) =>
                setPrefill(i,
                  entry.source === 'variable' ? { variable: e.target.value }
                  : entry.source === 'field' ? { from_field: e.target.value }
                  : { value: e.target.value },
                )
              }
              className="h-8 w-28 shrink-0 text-[11px]"
            />
            <Button
              type="button" variant="ghost" size="sm" className="h-7 w-7 shrink-0 p-0"
              aria-label="Remove prefill"
              onClick={() => onChange({ ...config, prefill: config.prefill.filter((_, idx) => idx !== i) })}
            >
              <Trash2 size={11} />
            </Button>
          </div>
        ))}
        <Button
          type="button" variant="outline" size="sm" className="h-7 w-full gap-1 text-[11px]"
          onClick={() => onChange({ ...config, prefill: [...config.prefill, { field: '', source: 'static', value: '' }] })}
        >
          <Plus size={11} /> Add value
        </Button>
      </div>

      <Field label="Store new record id in" hint="Lets a later step use what they just created.">
        <Input
          value={config.output_variable ?? ''}
          onChange={(e) => onChange({ ...config, output_variable: e.target.value })}
          placeholder="new_customer"
          className="h-8 font-mono text-[11px]"
        />
      </Field>

      <Field label="If they close it without saving">
        <SelectMenu
          value={config.on_cancel}
          onValueChange={(v) => onChange({ ...config, on_cancel: v as OpenFormStepConfig['on_cancel'] })}
        >
          <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="stop" className="text-[12px]">Stop here</SelectItem>
            <SelectItem value="continue" className="text-[12px]">Carry on to the next step</SelectItem>
          </SelectContent>
        </SelectMenu>
      </Field>
    </div>
  )
}

registerUiWorkflowNode({
  ConfigPanel: OpenFormPanel,
  type: 'open_form',
  label: 'Open a Form',
  icon: FilePlus,
  description: 'Pauses and lets the viewer fill in another form, then carries on with what they made.',
  category: 'interface',
  // WEB ONLY, and this is what the platforms field is for. A modal form is a
  // perfectly sensible thing on a phone, but nothing on mobile renders one
  // yet, so claiming both would make the builder promise something that
  // silently does nothing there. Widen it when the Compose side exists.
  platforms: ['web'],
  configSchema: {
    type: 'object',
    description:
      "Suspends the run while the viewer fills in another form, prefilled from the current one. The opened form is a REAL form — its own validation, permissions and workflows all apply — so nesting is bounded rather than banned: a form opened more than " +
      `${MAX_FORM_DEPTH} deep is refused.`,
    required: ['form_id', 'on_cancel'],
    properties: {
      form_id: { type: 'string', description: 'Form to open.' },
      title: { type: 'string', description: 'Heading on the dialog.' },
      prefill: {
        type: 'array',
        description: 'Values the form opens with: {field, source: static|variable|field, value, variable, from_field}.',
      },
      output_variable: { type: 'string', description: "Run variable the new record's id lands in." },
      on_cancel: {
        type: 'string',
        enum: ['stop', 'continue'],
        description: 'Whether closing without saving ends the run or falls through.',
      },
    },
  },
  execute: async ({ config, ctx, host, signal }) => {
    if (!host.openForm) throw new Error('This app can’t open a form here.')
    if (!config.form_id) throw new Error('This step has no form configured.')
    // Checked HERE rather than by the store, so the message names the real
    // problem — an author nesting too far — instead of surfacing as a modal
    // that silently declines to appear.
    if (ctx.depth >= MAX_FORM_DEPTH) {
      throw new Error(`Forms are already ${ctx.depth} deep — this step won’t open another.`)
    }

    const prefill: Record<string, unknown> = {}
    // Defensive: a config can reach the interpreter without passing through
    // parseConfig (a caller building a graph in memory, or a corpus case), so
    // the executor cannot assume a healed shape.
    for (const entry of config.prefill ?? []) {
      const value = resolveValue(
        { source: entry.source, value: entry.value, variable: entry.variable, field: entry.from_field },
        ctx,
      )
      if (value !== undefined) prefill[entry.field] = value
    }

    const result = await host.openForm(
      { formId: config.form_id, prefill, title: config.title, depth: ctx.depth + 1 },
      signal,
    )

    if (config.output_variable) {
      ctx.variables[config.output_variable] = result.recordId
      // Separate from the id for the same reason show_dialog splits its two:
      // "they closed it" has to stay distinguishable from "they saved
      // something with no id", which a later condition may need to branch on.
      ctx.variables[`${config.output_variable}_created`] = result.created
    }

    if (!result.created && config.on_cancel === 'stop') return { kind: 'stop' }
    return { kind: 'next' }
  },
  parseConfig: parseOpenFormConfig,
  createDefaultConfig: emptyOpenFormConfig,
})
