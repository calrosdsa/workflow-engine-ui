import { MessageCircleQuestion } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { registerUiWorkflowNode, type UiWorkflowNodeConfigPanelProps } from '../node-registry'
import { Field } from './panel-kit'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { ALL_PLATFORMS } from '../types'
import type { DialogKind, DialogOption } from '../ask-store'

/** THE SUSPENDING NODE. Everything else in the vocabulary completes during the
 *  run; this one parks it until a person answers.
 *
 *  That needed no interpreter change — runUiWorkflow already awaits each
 *  executor, so returning a promise that settles on a button click is enough.
 *  What it does need is discipline about SETTLING: see ask-store.ts for every
 *  path that must resolve or reject, because a run parked forever is invisible
 *  and wedges its trigger's in-flight guard for the life of the page. */
export interface ShowDialogStepConfig {
  kind: DialogKind
  title: string
  message?: string
  confirm_label?: string
  cancel_label?: string
  /** prompt only. */
  placeholder?: string
  default_value?: string
  /** choose only. */
  options?: DialogOption[]
  /** Where the answer lands. `<name>` holds the typed/picked value, and
   *  `<name>_confirmed` a boolean — so a later condition can branch on either
   *  what they said or whether they said anything. */
  output_variable?: string
  /** What a dismissal does. Stopping is the default because the overwhelmingly
   *  common shape is "are you sure? … then do the thing", where continuing
   *  past a Cancel would do exactly what the viewer just declined. */
  on_cancel: 'stop' | 'continue'
}

export function emptyShowDialogConfig(): ShowDialogStepConfig {
  return { kind: 'confirm', title: '', on_cancel: 'stop' }
}

const KINDS = new Set<DialogKind>(['confirm', 'prompt', 'choose'])

export function parseShowDialogConfig(raw: unknown): ShowDialogStepConfig {
  const empty = emptyShowDialogConfig()
  if (!raw || typeof raw !== 'object') return empty
  const r = raw as Record<string, unknown>
  const options: DialogOption[] = []
  if (Array.isArray(r.options)) {
    for (const o of r.options) {
      if (!o || typeof o !== 'object') continue
      const e = o as Record<string, unknown>
      if (typeof e.value !== 'string' || !e.value) continue
      options.push({ value: e.value, label: typeof e.label === 'string' && e.label ? e.label : e.value })
    }
  }
  return {
    kind: typeof r.kind === 'string' && KINDS.has(r.kind as DialogKind) ? (r.kind as DialogKind) : empty.kind,
    title: typeof r.title === 'string' ? r.title : empty.title,
    message: typeof r.message === 'string' ? r.message : undefined,
    confirm_label: typeof r.confirm_label === 'string' ? r.confirm_label : undefined,
    cancel_label: typeof r.cancel_label === 'string' ? r.cancel_label : undefined,
    placeholder: typeof r.placeholder === 'string' ? r.placeholder : undefined,
    default_value: typeof r.default_value === 'string' ? r.default_value : undefined,
    options,
    output_variable: typeof r.output_variable === 'string' ? r.output_variable : undefined,
    on_cancel: r.on_cancel === 'continue' ? 'continue' : 'stop',
  }
}

function ShowDialogPanel({ config, onChange }: UiWorkflowNodeConfigPanelProps<ShowDialogStepConfig>) {
  const t = useTranslation()
  const setOption = (i: number, patch: Partial<DialogOption>) =>
    onChange({ ...config, options: (config.options ?? []).map((o, idx) => (idx === i ? { ...o, ...patch } : o)) })

  return (
    <div className="space-y-2">
      <Field label={t('ui_workflows.panel.show_dialog.ask_for_label')}>
        <SelectMenu value={config.kind} onValueChange={(v) => onChange({ ...config, kind: v as DialogKind })}>
          <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="confirm" className="text-[12px]">{t('ui_workflows.panel.show_dialog.kind_confirm')}</SelectItem>
            <SelectItem value="prompt" className="text-[12px]">{t('ui_workflows.panel.show_dialog.kind_prompt')}</SelectItem>
            <SelectItem value="choose" className="text-[12px]">{t('ui_workflows.panel.show_dialog.kind_choose')}</SelectItem>
          </SelectContent>
        </SelectMenu>
      </Field>

      <Field label={t('ui_workflows.panel.show_dialog.title_label')}>
        <Input
          value={config.title}
          onChange={(e) => onChange({ ...config, title: e.target.value })}
          placeholder={t('ui_workflows.panel.show_dialog.title_placeholder')}
          className="h-8 text-[12px]"
        />
      </Field>

      <Field label={t('ui_workflows.panel.message_label')}>
        <Textarea
          value={config.message ?? ''}
          onChange={(e) => onChange({ ...config, message: e.target.value })}
          rows={2}
          className="text-[12px]"
        />
      </Field>

      {config.kind === 'prompt' && (
        <Field label={t('ui_workflows.panel.show_dialog.placeholder_field_label')}>
          <Input
            value={config.placeholder ?? ''}
            onChange={(e) => onChange({ ...config, placeholder: e.target.value })}
            className="h-8 text-[12px]"
          />
        </Field>
      )}

      {config.kind === 'choose' && (
        <Field label={t('ui_workflows.panel.show_dialog.options_label')}>
          <div className="space-y-1">
            {(config.options ?? []).map((o, i) => (
              <div key={i} className="flex gap-1.5">
                <Input
                  value={o.label}
                  onChange={(e) => setOption(i, { label: e.target.value })}
                  placeholder={t('ui_workflows.panel.show_dialog.option_label_placeholder')}
                  className="h-8 flex-1 text-[11px]"
                />
                <Input
                  value={o.value}
                  onChange={(e) => setOption(i, { value: e.target.value })}
                  placeholder={t('ui_workflows.panel.show_dialog.option_value_placeholder')}
                  className="h-8 w-24 font-mono text-[11px]"
                />
              </div>
            ))}
            <button
              type="button"
              className="text-[11px] text-[hsl(var(--primary))]"
              onClick={() => onChange({ ...config, options: [...(config.options ?? []), { value: '', label: '' }] })}
            >
              {t('ui_workflows.panel.show_dialog.add_option')}
            </button>
          </div>
        </Field>
      )}

      <Field
        label={t('ui_workflows.panel.show_dialog.store_answer_label')}
        hint={t('ui_workflows.panel.show_dialog.store_answer_hint')}
      >
        <Input
          value={config.output_variable ?? ''}
          onChange={(e) => onChange({ ...config, output_variable: e.target.value })}
          placeholder={t('ui_workflows.panel.show_dialog.answer_placeholder')}
          className="h-8 font-mono text-[11px]"
        />
      </Field>

      <Field label={t('ui_workflows.panel.show_dialog.if_cancel_label')}>
        <SelectMenu
          value={config.on_cancel}
          onValueChange={(v) => onChange({ ...config, on_cancel: v as ShowDialogStepConfig['on_cancel'] })}
        >
          <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="stop" className="text-[12px]">{t('ui_workflows.panel.on_cancel.stop')}</SelectItem>
            <SelectItem value="continue" className="text-[12px]">{t('ui_workflows.panel.on_cancel.continue')}</SelectItem>
          </SelectContent>
        </SelectMenu>
      </Field>
    </div>
  )
}

registerUiWorkflowNode({
  ConfigPanel: ShowDialogPanel,
  type: 'show_dialog',
  label: 'Ask',
  icon: MessageCircleQuestion,
  description: 'Pauses and asks the viewer to confirm, type something, or pick from a list.',
  category: 'interface',
  // A modal question is a concept both runtimes have; nothing here assumes a
  // DOM. Compose has AlertDialog, and the answer crosses back the same way.
  platforms: ALL_PLATFORMS,
  configSchema: {
    type: 'object',
    description:
      'Suspends the run until the viewer answers. Stores the answer in a variable (plus “<name>_confirmed”), and by default stops the run if they dismiss — the usual "are you sure?" shape, where carrying on would do the thing they just declined.',
    required: ['kind', 'title', 'on_cancel'],
    properties: {
      kind: { type: 'string', enum: ['confirm', 'prompt', 'choose'], description: 'What to ask for.' },
      title: { type: 'string', description: 'Dialog heading.' },
      message: { type: 'string', description: 'Optional supporting text.' },
      confirm_label: { type: 'string', description: 'Text on the confirm button.' },
      cancel_label: { type: 'string', description: 'Text on the dismiss button.' },
      placeholder: { type: 'string', description: "Input placeholder, when kind is 'prompt'." },
      default_value: { type: 'string', description: "Prefilled text, when kind is 'prompt'." },
      options: { type: 'array', description: "Choices as {value, label}, when kind is 'choose'." },
      output_variable: { type: 'string', description: 'Run variable holding the answer.' },
      on_cancel: {
        type: 'string',
        enum: ['stop', 'continue'],
        description: 'Whether a dismissal ends the run or falls through to the next step.',
      },
    },
  },
  execute: async ({ config, ctx, host, signal }) => {
    if (!host.askUser) throw new Error('This app can’t show a dialog here.')
    if (!config.title) throw new Error('This step has no question configured.')

    const answer = await host.askUser(
      {
        kind: config.kind,
        title: config.title,
        message: config.message,
        confirmLabel: config.confirm_label,
        cancelLabel: config.cancel_label,
        placeholder: config.placeholder,
        defaultValue: config.default_value,
        options: config.options,
      },
      signal,
    )

    if (config.output_variable) {
      ctx.variables[config.output_variable] = answer.value
      // Separate from the value because a dismissed prompt has NO value, and
      // "they cancelled" has to stay distinguishable from "they typed
      // nothing" for a later condition to branch on honestly.
      ctx.variables[`${config.output_variable}_confirmed`] = answer.confirmed
    }

    if (!answer.confirmed && config.on_cancel === 'stop') return { kind: 'stop' }
    return { kind: 'next' }
  },
  parseConfig: parseShowDialogConfig,
  createDefaultConfig: emptyShowDialogConfig,
})
