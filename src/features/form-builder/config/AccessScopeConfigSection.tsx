// "Access Scope" section of the Form Builder's Form Settings panel — row-
// level security rules enforced server-side on every read and write (see
// field.AccessScopeRule). Each rule pairs an audience (everyone, or a set of
// roles) with a filter over this form's own fields; a viewer matched by more
// than one rule sees the union, and a viewer matched by NO rule is
// unrestricted — access_scope only narrows, it never grants. That fail-open
// default is exactly why the uncovered-roles warning below isn't optional
// polish: it's the author-facing mitigation for a viewer an author forgot to
// cover, per the plan's SEC-5.
import { useMemo, useState } from 'react'
import { Trash2, Plus, ShieldAlert } from 'lucide-react'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { RoleMultiSelect } from './RoleMultiSelect'
import { FilterBuilder, newGroup } from '@/features/workflows/builder/FilterBuilder'
import { useCurrentUserAttrs } from '@/features/workflows/builder/useCurrentUserAttrs'
import { useRoles } from '@/features/roles/hooks'
import { useAuthStore } from '@/stores/auth'
import { countAccessScopeConditions } from '../access-scope'
import type { AccessScopeRule } from '@/features/forms/types'
import type { FieldDef } from '@/features/forms/types'

interface AccessScopeConfigSectionProps {
  rules: AccessScopeRule[]
  onChange: (next: AccessScopeRule[]) => void
  fields: FieldDef[]
}

function emptyRule(): AccessScopeRule {
  return { audience: { type: 'everyone' }, filter: newGroup() }
}

export function AccessScopeConfigSection({ rules, onChange, fields }: AccessScopeConfigSectionProps) {
  const t = useTranslation()
  const activeAppId = useAuthStore((s) => s.activeMembership?.app_id) ?? ''
  const { data: roles } = useRoles(activeAppId)
  const currentUserModes = useCurrentUserAttrs()
  const [openIndex, setOpenIndex] = useState<string | undefined>(undefined)

  const patchRule = (i: number, patch: Partial<AccessScopeRule>) =>
    onChange(rules.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  const removeRule = (i: number) => onChange(rules.filter((_, j) => j !== i))

  const addRule = () => {
    const next = [...rules, emptyRule()]
    onChange(next)
    setOpenIndex(String(next.length - 1))
  }

  // Every role NOT covered by an "everyone" rule and NOT named in any
  // "role" rule's role_ids is unrestricted for that role — the fail-open
  // default. Only worth flagging once the form has at least one rule: a
  // form with zero rules is uniformly unrestricted for everyone, which is
  // an ordinary starting state, not a gap in a partial rule set.
  const uncoveredRoles = useMemo(() => {
    if (rules.length === 0 || !roles) return []
    if (rules.some((r) => r.audience.type === 'everyone')) return []
    const covered = new Set(rules.flatMap((r) => (r.audience.type === 'role' ? r.audience.role_ids ?? [] : [])))
    return roles.filter((r) => !covered.has(r.id))
  }, [rules, roles])

  return (
    <div className="space-y-3">
      {rules.length === 0 ? (
        <p className="rounded-md bg-[hsl(var(--muted))]/50 px-3 py-2 text-[11px] text-[hsl(var(--muted-foreground))]">
          {t('form_config.no_access_rules')}
        </p>
      ) : (
        <Accordion type="single" collapsible value={openIndex} onValueChange={setOpenIndex} className="space-y-2">
          {rules.map((rule, i) => (
            <AccordionItem key={i} value={String(i)} className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3">
              <div className="flex items-center gap-2">
                <AccordionTrigger className="flex-1 py-2.5 text-[12px] hover:no-underline">
                  <span className="flex items-center gap-2">
                    <span className="font-medium">
                      {rule.audience.type === 'everyone'
                        ? t('form_config.audience_everyone')
                        : t((rule.audience.role_ids ?? []).length === 1 ? 'form_config.role_count_one' : 'form_config.role_count_many', { count: (rule.audience.role_ids ?? []).length })}
                    </span>
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                      {t(countAccessScopeConditions([rule]) === 1 ? 'form_config.condition_count_one' : 'form_config.condition_count_many', { count: countAccessScopeConditions([rule]) })}
                    </span>
                  </span>
                </AccordionTrigger>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-[hsl(var(--muted-foreground))] hover:text-destructive"
                  onClick={() => removeRule(i)}
                >
                  <Trash2 size={13} />
                </Button>
              </div>
              <AccordionContent className="space-y-3 pb-3">
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('form_config.applies_to')}</p>
                  <SelectMenu
                    value={rule.audience.type}
                    onValueChange={(v) =>
                      patchRule(i, { audience: v === 'everyone' ? { type: 'everyone' } : { type: 'role', role_ids: rule.audience.role_ids ?? [] } })
                    }
                  >
                    <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="everyone">{t('form_config.audience_everyone')}</SelectItem>
                      <SelectItem value="role">{t('form_config.specific_roles_option')}</SelectItem>
                    </SelectContent>
                  </SelectMenu>
                  {rule.audience.type === 'role' && (
                    <RoleMultiSelect
                      value={rule.audience.role_ids ?? []}
                      onChange={(role_ids) => patchRule(i, { audience: { type: 'role', role_ids } })}
                      appId={activeAppId}
                    />
                  )}
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('form_config.may_only_see_edit')}</p>
                  <FilterBuilder
                    group={rule.filter}
                    fields={fields}
                    variables={[]}
                    onChange={(filter) => patchRule(i, { filter })}
                    hideExpressions
                    viewerModes={currentUserModes}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {uncoveredRoles.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-400">
          <ShieldAlert size={14} className="mt-0.5 shrink-0" />
          <span>
            {t(uncoveredRoles.length === 1 ? 'form_config.uncovered_roles_singular' : 'form_config.uncovered_roles_plural', { names: uncoveredRoles.map((r) => r.name).join(', ') })}
          </span>
        </div>
      )}

      <Button type="button" variant="outline" onClick={addRule} className="flex w-full items-center gap-2 text-[12px]">
        <Plus size={14} />
        {t('form_config.add_rule')}
      </Button>
    </div>
  )
}
