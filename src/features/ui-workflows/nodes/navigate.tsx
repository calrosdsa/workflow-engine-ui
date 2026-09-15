import { ArrowRightLeft } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { registerUiWorkflowNode, type UiWorkflowNodeConfigPanelProps } from '../node-registry'
import { Field } from './panel-kit'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { ALL_PLATFORMS } from '../types'

/** Navigation is by MENU SLUG, not URL. A slug is the one addressing scheme
 *  both runtimes share — the web runtime routes by it and MenuMapper resolves
 *  it on mobile — whereas a URL is web-only and would quietly make any
 *  workflow using it undeployable to the app. */
export interface NavigateStepConfig {
  target: 'menu' | 'record' | 'back'
  menu_slug?: string
  /** For target 'record': which form, and which record id to open. The id is
   *  read from a run variable rather than hardcoded, since the interesting
   *  case is "open the record the previous step just created". */
  form_id?: string
  record_id_variable?: string
}

export function emptyNavigateConfig(): NavigateStepConfig {
  return { target: 'menu', menu_slug: '' }
}

export function parseNavigateConfig(raw: unknown): NavigateStepConfig {
  const empty = emptyNavigateConfig()
  if (!raw || typeof raw !== 'object') return empty
  const r = raw as Record<string, unknown>
  const target = r.target === 'record' || r.target === 'back' ? r.target : 'menu'
  return {
    target,
    menu_slug: typeof r.menu_slug === 'string' ? r.menu_slug : undefined,
    form_id: typeof r.form_id === 'string' ? r.form_id : undefined,
    record_id_variable:
      typeof r.record_id_variable === 'string' ? r.record_id_variable : undefined,
  }
}

function NavigatePanel({ config, onChange }: UiWorkflowNodeConfigPanelProps<NavigateStepConfig>) {
  const t = useTranslation()
  return (
    <div className="space-y-2">
      <Field
        label={t('ui_workflows.panel.navigate.go_to_label')}
        hint={t('ui_workflows.panel.navigate.go_to_hint')}
      >
        <SelectMenu
          value={config.target}
          onValueChange={(v) => onChange({ ...config, target: v as NavigateStepConfig['target'] })}
        >
          <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="menu" className="text-[12px]">{t('ui_workflows.panel.navigate.target_menu')}</SelectItem>
            <SelectItem value="record" className="text-[12px]">{t('ui_workflows.panel.navigate.target_record')}</SelectItem>
            <SelectItem value="back" className="text-[12px]">{t('common.back')}</SelectItem>
          </SelectContent>
        </SelectMenu>
      </Field>

      {config.target === 'menu' && (
        <Field label={t('ui_workflows.panel.navigate.menu_slug_label')} hint={t('ui_workflows.panel.navigate.menu_slug_hint')}>
          <Input
            value={config.menu_slug ?? ''}
            onChange={(e) => onChange({ ...config, menu_slug: e.target.value })}
            placeholder={t('ui_workflows.panel.navigate.menu_slug_placeholder')}
            className="h-8 font-mono text-[11px]"
          />
        </Field>
      )}

      {config.target === 'record' && (
        <>
          <Field label={t('ui_workflows.panel.navigate.form_id_label')} hint={t('ui_workflows.panel.navigate.form_id_hint')}>
            <Input
              value={config.form_id ?? ''}
              onChange={(e) => onChange({ ...config, form_id: e.target.value })}
              className="h-8 font-mono text-[11px]"
            />
          </Field>
          <Field
            label={t('ui_workflows.panel.record_id_variable_label')}
            hint={t('ui_workflows.panel.navigate.record_id_variable_hint')}
          >
            <Input
              value={config.record_id_variable ?? ''}
              onChange={(e) => onChange({ ...config, record_id_variable: e.target.value })}
              placeholder={t('ui_workflows.panel.new_record_placeholder')}
              className="h-8 font-mono text-[11px]"
            />
          </Field>
        </>
      )}
    </div>
  )
}

registerUiWorkflowNode({
  ConfigPanel: NavigatePanel,
  type: 'navigate',
  label: 'Go To',
  icon: ArrowRightLeft,
  description: 'Sends the viewer to another menu, to a record, or back.',
  category: 'interface',
  platforms: ALL_PLATFORMS,
  configSchema: {
    type: 'object',
    description:
      'Navigates the runtime. Addresses menus by slug rather than URL so the same workflow works on web and mobile.',
    required: ['target'],
    properties: {
      target: {
        type: 'string',
        enum: ['menu', 'record', 'back'],
        description: 'Where to go.',
      },
      menu_slug: { type: 'string', description: "Menu slug, when target is 'menu'." },
      form_id: { type: 'string', description: "Form whose record to open, when target is 'record'." },
      record_id_variable: {
        type: 'string',
        description:
          "Run variable holding the record id to open, when target is 'record' — typically set by a preceding create_record step.",
      },
    },
  },
  execute: ({ config, ctx, host }) => {
    if (config.target === 'back') {
      host.navigate({ kind: 'back' })
      // Navigation ends the run: the surface the remaining steps would act on
      // is being torn down, so continuing would mean writing field state into
      // a screen nobody is looking at any more.
      return { kind: 'stop' }
    }

    if (config.target === 'record') {
      const formId = config.form_id || ctx.formId
      const recordId = config.record_id_variable
        ? String(ctx.variables[config.record_id_variable] ?? '')
        : ctx.recordId
      // Named but unresolved is an authoring error worth surfacing — most
      // often a create_record step that did not store its output_variable, or
      // a typo in the name. Failing beats navigating somewhere arbitrary.
      if (!formId || !recordId) {
        throw new Error(
          config.record_id_variable
            ? `Nothing to open: variable "${config.record_id_variable}" holds no record id.`
            : 'Nothing to open: no record is in context for this step.',
        )
      }
      host.navigate({ kind: 'record', formId, recordId })
      return { kind: 'stop' }
    }

    if (!config.menu_slug) throw new Error('This step has no destination configured.')
    host.navigate({ kind: 'menu', slug: config.menu_slug })
    return { kind: 'stop' }
  },
  parseConfig: parseNavigateConfig,
  createDefaultConfig: emptyNavigateConfig,
})
