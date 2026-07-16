import { useState } from 'react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { Spinner } from '@/components/ui/spinner'
import { useCreateRole, useUpdateRole } from '@/features/roles/hooks'
import { usePermissionsCatalog } from '@/features/permissions/hooks'
import type { Role } from '@/features/roles/types'
import type { PermissionDef } from '@/features/permissions/types'

// Pulled out of the resource-group tree below into its own standalone
// switch: unlike the rest of the catalog (CRUD-shaped resource permissions),
// this one is a single yes/no gate that also controls a runtime-app-facing
// button (see RuntimeAppShell.tsx) — the reference design shows it as a
// dedicated switch, not a checkbox buried inside "application"'s group.
const APP_DESIGN_KEY = 'application:design'

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
 *  the same toggleOne/toggleGroup selection logic. */
export function RoleFormDrawer({ appId, role, onClose }: RoleFormDrawerProps) {
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
      setError('Name is required.')
      return
    }
    try {
      if (role) {
        await updateMutation.mutateAsync({ app_id: appId, name, permissions })
      } else {
        await createMutation.mutateAsync({ app_id: appId, name, permissions })
      }
      onClose()
    } catch {
      setError('Could not save role — a role with this name may already exist for this app.')
    }
  }

  return (
    <Drawer open onOpenChange={(o) => !o && onClose()}>
      <DrawerContent size="lg">
        <DrawerHeader>
          <DrawerTitle>Role Details</DrawerTitle>
          <DrawerDescription>Choose which permissions this role grants within this application.</DrawerDescription>
        </DrawerHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Name this Role *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Please name this Role..." />
          </div>

          <div>
            <label className="flex cursor-pointer items-center gap-2">
              <Switch checked={canDesign} onCheckedChange={toggleAppDesign} />
              <span className="text-xs text-gray-500">Switch off to disable App design permissions</span>
            </label>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-gray-600">What permissions should this role have?</p>
            <Accordion type="multiple" defaultValue={Object.keys(grouped)} className="rounded-md border border-gray-200">
              {Object.entries(grouped).map(([resource, defs]) => {
                const selectedCount = defs.filter((d) => permissions.includes(d.key)).length
                const allChecked = selectedCount === defs.length
                const someChecked = selectedCount > 0 && !allChecked

                return (
                  <AccordionItem key={resource} value={resource} className="border-b border-gray-100 px-3 last:border-b-0">
                    <div className="flex items-center gap-2 py-1">
                      <Checkbox
                        checked={allChecked ? true : someChecked ? 'indeterminate' : false}
                        onCheckedChange={(c) => toggleGroup(defs, c === true)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <AccordionTrigger className="py-2 normal-case tracking-normal text-sm font-medium text-gray-800">
                        {resource}
                      </AccordionTrigger>
                    </div>
                    <AccordionContent>
                      <div className="space-y-1.5 pl-6">
                        {defs.map((p) => (
                          <label key={p.key} className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                            <Checkbox checked={permissions.includes(p.key)} onCheckedChange={(c) => toggleOne(p.key, c === true)} />
                            {p.label}
                          </label>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )
              })}

              {Object.keys(formsByForm).length > 0 && (
                <AccordionItem value="forms-records" className="border-b border-gray-100 px-3 last:border-b-0">
                  <div className="flex items-center gap-2 py-1">
                    <Checkbox
                      checked={
                        formDefs.every((d) => permissions.includes(d.key))
                          ? true
                          : formDefs.some((d) => permissions.includes(d.key))
                            ? 'indeterminate'
                            : false
                      }
                      onCheckedChange={(c) => toggleGroup(formDefs, c === true)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <AccordionTrigger className="py-2 normal-case tracking-normal text-sm font-medium text-gray-800">
                      Forms (records)
                    </AccordionTrigger>
                  </div>
                  <AccordionContent>
                    <Accordion type="multiple" defaultValue={Object.keys(formsByForm)} className="space-y-0.5 pl-4">
                      {Object.entries(formsByForm).map(([formId, defs]) => {
                        const selectedCount = defs.filter((d) => permissions.includes(d.key)).length
                        const allChecked = selectedCount === defs.length
                        const someChecked = selectedCount > 0 && !allChecked

                        return (
                          <AccordionItem key={formId} value={formId} className="border-b border-gray-100 px-2 last:border-b-0">
                            <div className="flex items-center gap-2 py-1">
                              <Checkbox
                                checked={allChecked ? true : someChecked ? 'indeterminate' : false}
                                onCheckedChange={(c) => toggleGroup(defs, c === true)}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <AccordionTrigger className="py-1.5 normal-case tracking-normal text-sm text-gray-700">
                                {formName(defs)}
                              </AccordionTrigger>
                            </div>
                            <AccordionContent>
                              <div className="space-y-1.5 pl-6">
                                {defs.map((p) => (
                                  <label key={p.key} className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                                    <Checkbox checked={permissions.includes(p.key)} onCheckedChange={(c) => toggleOne(p.key, c === true)} />
                                    {actionLabel(p)}
                                  </label>
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

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <DrawerFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-emerald-500 text-white hover:bg-emerald-600" onClick={handleSave} disabled={isPending}>
            {isPending && <Spinner className="h-4 w-4" />}
            Save
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
const ACTION_LABELS: Record<string, string> = {
  view: 'View records',
  create: 'Create records',
  edit: 'Edit records',
  delete: 'Delete records',
}

function actionLabel(def: PermissionDef): string {
  return ACTION_LABELS[def.action] ?? def.label
}
