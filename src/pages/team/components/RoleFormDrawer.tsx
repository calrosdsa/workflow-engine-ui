import { useState } from 'react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { Spinner } from '@/components/ui/spinner'
import { useCreateRole, useUpdateRole } from '@/features/roles/hooks'
import { usePermissionsCatalog } from '@/features/permissions/hooks'
import type { Role } from '@/features/roles/types'
import type { PermissionDef } from '@/features/permissions/types'
import { useTranslation } from '@/features/i18n/I18nProvider'

// Pulled out of the resource-group tree below into its own standalone
// switch: unlike the rest of the catalog (CRUD-shaped resource permissions),
// this one is a single yes/no gate that also controls a runtime-app-facing
// button (see RuntimeAppShell.tsx) — the reference design shows it as a
// dedicated switch, not a checkbox buried inside "application"'s group.
const APP_DESIGN_KEY = 'application:design'

// The design shell cannot open without reading the application it edits
// (GET /application is gated on application:read). "App design permissions"
// alone used to be savable, and produced a user who was shown "Edit design"
// and then a blank screen -- so while design is on, read is part of the role,
// shown ticked and locked. Derived rather than written into state when the
// switch flips, so it also holds for roles saved before this existed and for
// unticking the whole "application" group while design stays on.
const APP_READ_KEY = 'application:read'

interface RoleFormDrawerProps {
  appId: string
  role: Role | null
  onClose: () => void
}

/** Drawer for creating/editing a role — the "Role Details" panel from the
 *  reference design. Above the permission tree, a standalone "App design
 *  permissions" switch toggles application:design on its own — the same
 *  permission key that gates entry to the builder shell (router.tsx) and the
 *  Workflows/Forms/Applications sidebar items (Sidebar.tsx), now also read
 *  by the runtime app's "Edit Design" button (RuntimeAppShell.tsx). The
 *  permission picker below it is a tree: every remaining static resource
 *  (workflows, executions, application, credentials, menus, users, roles,
 *  plus the two form-definition entries) renders as a 2-level
 *  resource → action group, same as before. "Forms (records)" is a 3-level
 *  group instead — one nested sub-group per real form in this app, each
 *  with its own View/Create/Edit/Delete leaf checkboxes and indeterminate
 *  rollup — reflecting the app's actual per-form permission catalog
 *  (GET /permissions?app_id=…, see features/permissions). Every level reuses
 *  the same toggleOne/toggleGroup selection logic.
 *
 *  Field-level read masking is configured per field now — a field's own
 *  Hide Rule (Advanced Settings, in the form builder) — not from this
 *  drawer; the older role-level field mask this drawer used to edit has
 *  been removed. */
export function RoleFormDrawer({ appId, role, onClose }: RoleFormDrawerProps) {
  const t = useTranslation()
  const { data: catalog } = usePermissionsCatalog(appId)
  const createMutation = useCreateRole(appId)
  const updateMutation = useUpdateRole(role?.id ?? '', appId)

  const [name, setName] = useState(role?.name ?? '')
  const [permissions, setPermissions] = useState<string[]>(role?.permissions ?? [])
  const [error, setError] = useState<string | null>(null)

  const isPending = createMutation.isPending || updateMutation.isPending
  const staticDefs = (catalog ?? []).filter((d) => !d.form_id && d.key !== APP_DESIGN_KEY)
  const formDefs = (catalog ?? []).filter((d) => d.form_id)
  const grouped = groupByResource(staticDefs)
  const formsByForm = groupByFormId(formDefs)
  const canDesign = permissions.includes(APP_DESIGN_KEY)
  // What the role actually grants, and what is saved: design brings read along.
  const effective = canDesign && !permissions.includes(APP_READ_KEY) ? [...permissions, APP_READ_KEY] : permissions
  const lockedByDesign = (key: string) => canDesign && key === APP_READ_KEY

  const toggleAppDesign = (checked: boolean) => {
    setPermissions((prev) => (checked ? [...new Set([...prev, APP_DESIGN_KEY])] : prev.filter((p) => p !== APP_DESIGN_KEY)))
  }

  const toggleOne = (key: string, checked: boolean) => {
    setPermissions((prev) => (checked ? [...new Set([...prev, key])] : prev.filter((p) => p !== key)))
  }

  const toggleGroup = (defs: PermissionDef[], checked: boolean) => {
    const keys = defs.map((d) => d.key)
    setPermissions((prev) => (checked ? [...new Set([...prev, ...keys])] : prev.filter((p) => !keys.includes(p))))
  }

  const handleSave = async () => {
    setError(null)
    if (!name.trim()) {
      setError(t('team.role_name_required'))
      return
    }
    try {
      if (role) {
        await updateMutation.mutateAsync({ app_id: appId, name, permissions: effective })
      } else {
        await createMutation.mutateAsync({ app_id: appId, name, permissions: effective })
      }
      onClose()
    } catch {
      setError(t('team.role_save_failed'))
    }
  }

  return (
    <Drawer open onOpenChange={(o) => !o && onClose()}>
      <DrawerContent size="lg">
        <DrawerHeader>
          <DrawerTitle>{t('team.role_details')}</DrawerTitle>
          <DrawerDescription>{t('team.role_details_description')}</DrawerDescription>
        </DrawerHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
          <div>
            <Label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">{t('team.role_name_label')}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('team.role_name_placeholder')} />
          </div>

          <div>
            <Label className="flex cursor-pointer items-center gap-2 font-normal">
              <Switch checked={canDesign} onCheckedChange={toggleAppDesign} />
              <span className="text-xs text-[hsl(var(--muted-foreground))]">{t('team.app_design_permissions')}</span>
            </Label>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-[hsl(var(--muted-foreground))]">{t('team.permissions_question')}</p>
            <Accordion type="multiple" defaultValue={Object.keys(grouped)} className="rounded-md border border-[hsl(var(--border))]">
              {Object.entries(grouped).map(([resource, defs]) => {
                const selectedCount = defs.filter((d) => effective.includes(d.key)).length
                const allChecked = selectedCount === defs.length
                const someChecked = selectedCount > 0 && !allChecked

                return (
                  <AccordionItem key={resource} value={resource} className="border-b border-[hsl(var(--border))] px-3 last:border-b-0">
                    <div className="flex items-center gap-2 py-1">
                      <Checkbox
                        checked={allChecked ? true : someChecked ? 'indeterminate' : false}
                        onCheckedChange={(c) => toggleGroup(defs, c === true)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <AccordionTrigger className="py-2 normal-case tracking-normal text-sm font-medium text-[hsl(var(--foreground))]">
                        {resource}
                      </AccordionTrigger>
                    </div>
                    <AccordionContent>
                      <div className="space-y-1.5 pl-6">
                        {defs.map((p) => (
                          <Label key={p.key} className="flex cursor-pointer items-center gap-2 text-sm font-normal text-[hsl(var(--foreground))]">
                            <Checkbox
                              checked={effective.includes(p.key)}
                              disabled={lockedByDesign(p.key)}
                              onCheckedChange={(c) => toggleOne(p.key, c === true)}
                            />
                            {p.label}
                            {lockedByDesign(p.key) && (
                              <span className="text-xs text-[hsl(var(--muted-foreground))]">{t('team.required_for_app_design')}</span>
                            )}
                          </Label>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )
              })}

              {Object.keys(formsByForm).length > 0 && (
                <AccordionItem value="forms-records" className="border-b border-[hsl(var(--border))] px-3 last:border-b-0">
                  <div className="flex items-center gap-2 py-1">
                    <Checkbox
                      checked={
                        formDefs.every((d) => effective.includes(d.key))
                          ? true
                          : formDefs.some((d) => effective.includes(d.key))
                            ? 'indeterminate'
                            : false
                      }
                      onCheckedChange={(c) => toggleGroup(formDefs, c === true)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <AccordionTrigger className="py-2 normal-case tracking-normal text-sm font-medium text-[hsl(var(--foreground))]">
                      {t('team.forms_records')}
                    </AccordionTrigger>
                  </div>
                  <AccordionContent>
                    <Accordion type="multiple" defaultValue={Object.keys(formsByForm)} className="space-y-0.5 pl-4">
                      {Object.entries(formsByForm).map(([formId, defs]) => {
                        const selectedCount = defs.filter((d) => effective.includes(d.key)).length
                        const allChecked = selectedCount === defs.length
                        const someChecked = selectedCount > 0 && !allChecked

                        return (
                          <AccordionItem key={formId} value={formId} className="border-b border-[hsl(var(--border))] px-2 last:border-b-0">
                            <div className="flex items-center gap-2 py-1">
                              <Checkbox
                                checked={allChecked ? true : someChecked ? 'indeterminate' : false}
                                onCheckedChange={(c) => toggleGroup(defs, c === true)}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <AccordionTrigger className="py-1.5 normal-case tracking-normal text-sm text-[hsl(var(--foreground))]">
                                {formName(defs)}
                              </AccordionTrigger>
                            </div>
                            <AccordionContent>
                              <div className="space-y-1.5 pl-6">
                                {defs.map((p) => (
                                  <Label key={p.key} className="flex cursor-pointer items-center gap-2 text-sm font-normal text-[hsl(var(--foreground))]">
                                    <Checkbox checked={effective.includes(p.key)} onCheckedChange={(c) => toggleOne(p.key, c === true)} />
                                    {actionLabel(p, t)}
                                  </Label>
                                ))}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        )
                      })}
                    </Accordion>
                  </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>
          </div>

          {error && <p className="text-xs text-[hsl(var(--destructive))]">{error}</p>}
        </div>

        <DrawerFooter>
          <Button variant="outline" onClick={onClose}>{t('team.cancel')}</Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending && <Spinner className="h-4 w-4" />}
            {t('team.save')}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

function groupByResource(defs: PermissionDef[]): Record<string, PermissionDef[]> {
  const out: Record<string, PermissionDef[]> = {}
  for (const def of defs) {
    ;(out[def.resource] ??= []).push(def)
  }
  return out
}

function groupByFormId(defs: PermissionDef[]): Record<string, PermissionDef[]> {
  const out: Record<string, PermissionDef[]> = {}
  for (const def of defs) {
    if (!def.form_id) continue
    ;(out[def.form_id] ??= []).push(def)
  }
  return out
}

// Per-form labels are "{form name}: {action label}" (e.g. "Items: View
// records") — every entry in a form's group shares the same form name
// prefix, so any one of them can supply it for the group header.
function formName(defs: PermissionDef[]): string {
  const [name] = defs[0].label.split(':')
  return name
}

// Action-only label for a leaf checkbox, once its form name is already
// shown by the parent group — maps off the stable `action` field rather
// than re-parsing `label` (a form named e.g. "Q1: Sales" would break a
// naive label split).
// Keep in step with auth.PerFormActions (Go) — an action missing here
// still renders, but falls through to def.label, which carries the form
// name prefix the group header already shows ("Invoices: Comment on
// records" sitting under an "Invoices" header, beside a bare "View
// records").
const ACTION_LABELS: Record<string, string> = {
  view: 'View records',
  create: 'Create records',
  edit: 'Edit records',
  delete: 'Delete records',
  comment: 'Comment on records',
}

function actionLabel(def: PermissionDef, t: (key: string, vars?: Record<string, string | number>) => string): string {
  const actionKey = def.action && `team.permission_${def.action}`
  return actionKey && ACTION_LABELS[def.action] ? t(actionKey) : def.label
}
