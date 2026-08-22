// Shared per-tab config body — Label, the tab type's own ConfigPanel,
// Visibility, and conditional-render sections. Extracted from the Form
// Builder's flat-list drawer (form-builder/config/DetailPageConfigSection.tsx)
// so the new Detail Page Builder canvas can open the exact same editing UI
// for a tab card instead of duplicating this logic — both surfaces patch the
// same DetailTabConfig shape through the same onPatch contract.
import { GitBranch, Users2 } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { RoleMultiSelect } from '@/features/form-builder/config/RoleMultiSelect'
import { UserMultiSelect } from '@/features/form-builder/config/UserMultiSelect'
import { ExpressionField } from '@/features/form-builder/config/ExpressionField'
import { getDetailTab } from './registry'
import type { DetailTabConfig, TabVisibilityConfig } from '@/features/form-builder/schema'
import type { VariableDecl } from '@/features/workflows/types'

export function DetailTabConfigForm({ formId, tab, onPatch }: {
  formId: string
  tab: DetailTabConfig
  onPatch: (patch: Partial<DetailTabConfig>) => void
}) {
  const def = getDetailTab(tab.type)
  if (!def) return null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Label</Label>
        <Input
          value={tab.label ?? ''}
          onChange={(e) => onPatch({ label: e.target.value })}
          placeholder={def.label}
          className="h-8 text-sm"
        />
      </div>

      {def.ConfigPanel && (
        <def.ConfigPanel
          config={def.parseConfig(tab.config)}
          onChange={(config) => onPatch({ config })}
          formId={formId}
        />
      )}

      <TabVisibilitySection
        visibility={tab.visibility}
        onChange={(visibility) => onPatch({ visibility })}
      />

      <TabRenderIfSection
        renderIf={tab.renderIf}
        onChange={(renderIf) => onPatch({ renderIf })}
      />
    </div>
  )
}

export function TabVisibilitySection({ visibility, onChange }: {
  visibility: TabVisibilityConfig | undefined
  onChange: (v: TabVisibilityConfig) => void
}) {
  const mode = visibility?.mode ?? 'everyone'
  const roleIds = visibility?.roleIds ?? []
  const userIds = visibility?.userIds ?? []

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 p-3">
      <div className="flex items-center gap-1.5">
        <Users2 size={12} className="text-[hsl(var(--muted-foreground))]" />
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Who can see this tab</p>
      </div>
      <SelectMenu value={mode} onValueChange={(v) => onChange({ mode: v as TabVisibilityConfig['mode'], roleIds, userIds })}>
        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="everyone" className="text-xs">Everyone</SelectItem>
          <SelectItem value="roles" className="text-xs">Specific roles</SelectItem>
          <SelectItem value="users" className="text-xs">Specific people</SelectItem>
          <SelectItem value="roles_or_users" className="text-xs">Specific roles or people</SelectItem>
        </SelectContent>
      </SelectMenu>
      {(mode === 'roles' || mode === 'roles_or_users') && (
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] font-medium text-[hsl(var(--muted-foreground))]">Roles</Label>
          <RoleMultiSelect value={roleIds} onChange={(ids) => onChange({ mode, roleIds: ids, userIds })} />
        </div>
      )}
      {(mode === 'users' || mode === 'roles_or_users') && (
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] font-medium text-[hsl(var(--muted-foreground))]">People</Label>
          <UserMultiSelect value={userIds} onChange={(ids) => onChange({ mode, roleIds, userIds: ids })} />
        </div>
      )}
    </div>
  )
}

export function TabRenderIfSection({ renderIf, onChange }: {
  renderIf: DetailTabConfig['renderIf']
  onChange: (r: NonNullable<DetailTabConfig['renderIf']>) => void
}) {
  const isConditional = renderIf?.mode === 'expression'
  // Tab-level renderIf reuses the exact Vars["fieldKey"] addressing field-
  // level visibleWhen already uses (expression-context.ts) — no per-form
  // variable declarations are threaded in here since this panel doesn't
  // have this form's own field list in scope the way ElementConfig's
  // RuleGroup does; the field-key hint below documents the same convention
  // without wiring live autocomplete for it.
  const emptyVariables: VariableDecl[] = []

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 p-3">
      <div className="flex items-center gap-1.5">
        <GitBranch size={12} className="text-[hsl(var(--muted-foreground))]" />
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">When this tab appears</p>
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
        <Checkbox
          checked={isConditional}
          onCheckedChange={(v) => onChange(v ? { mode: 'expression', expressionWhen: renderIf?.expressionWhen ?? '' } : { mode: 'always' })}
        />
        <Label className="cursor-pointer text-[12px] font-normal text-[hsl(var(--muted-foreground))]">Only show this tab conditionally</Label>
      </label>
      {isConditional && (
        <ExpressionField
          value={renderIf?.expressionWhen ?? ''}
          onChange={(v) => onChange({ mode: 'expression', expressionWhen: v })}
          variables={emptyVariables}
          placeholder='Vars["stage"] == "closed_won"'
          label="visible when"
        />
      )}
    </div>
  )
}
