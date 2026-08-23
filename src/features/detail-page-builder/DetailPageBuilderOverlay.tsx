// Full-screen overlay for the Detail Page Builder — a real spatial canvas
// (layout picker + drag zones + per-tab config + live preview), replacing
// the flat-list Drawer for cases that actually need spatial arrangement.
// Deliberately an OVERLAY inside the already-loaded Form Builder, not a
// separate route: saving detailTabs/detailLayout requires the Form
// Builder's full in-memory state (name, slug, every field) already
// hydrated via useFormBuilderStore/useFormMetaStore — there's no backend
// endpoint to patch just the tab layout, so a standalone route would need
// to duplicate the Form Builder's own fetch+hydrate+save cycle for no
// benefit. This overlay reads/writes those same stores directly, exactly
// like the existing DetailPageConfigSection drawer already does via
// updateDetailTabs — no separate fetch, no separate save flow. The whole
// form's Save button (FormBuilderPage's own) is still what persists
// anything to the backend.
import { useState } from 'react'
import { Plus, Eye, Pencil } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { nanoid } from '@/features/workflows/builder/nanoid'
import { allDetailTabs, getDetailTab } from '@/features/forms/runtime/detail-tabs/registry'
import { DetailTabConfigForm } from '@/features/forms/runtime/detail-tabs/DetailTabConfigForm'
import { pickableFields } from '@/features/forms/runtime/detail-tabs/field-ref/pickable-fields'
import { DetailPageCanvas } from './canvas/DetailPageCanvas'
import { LayoutPicker } from './canvas/LayoutPicker'
import { DetailPagePreview } from './preview/DetailPagePreview'
import { DETAIL_PAGE_LAYOUTS, DEFAULT_DETAIL_PAGE_ZONE, type DetailTabConfig, type DetailPageLayoutId, type FormSchema } from '@/features/form-builder/schema'
import type { FieldDef } from '@/features/forms/types'

interface DetailPageBuilderOverlayProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  formId: string
  fields: FieldDef[]
  schema: FormSchema
  onChangeTabs: (next: DetailTabConfig[]) => void
  onChangeLayout: (next: DetailPageLayoutId) => void
}

export function DetailPageBuilderOverlay({
  open, onOpenChange, formId, fields, schema, onChangeTabs, onChangeLayout,
}: DetailPageBuilderOverlayProps) {
  const tabs = schema.settings?.detailTabs ?? []
  const layout = schema.settings?.detailLayout ?? 'single'
  const [selectedTabId, setSelectedTabId] = useState<string | null>(null)
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')

  const selectedTab = tabs.find((t) => t.id === selectedTabId) ?? null
  const zones = DETAIL_PAGE_LAYOUTS[layout]?.zones ?? DETAIL_PAGE_LAYOUTS.single.zones
  const nonMainZones = zones.filter((z) => z.id !== DEFAULT_DETAIL_PAGE_ZONE)
  const pickableFieldOptions = pickableFields(schema)

  const patchTab = (id: string, patch: Partial<DetailTabConfig>) =>
    onChangeTabs(tabs.map((t) => (t.id === id ? { ...t, ...patch } : t)))

  const addTab = (type: string) => {
    const def = getDetailTab(type)
    if (!def) return
    const newTab: DetailTabConfig = { id: nanoid(), type, config: def.createDefaultConfig() }
    onChangeTabs([...tabs, newTab])
    setSelectedTabId(newTab.id)
  }

  const addField = (fieldKey: string, zoneId: string) => {
    const def = getDetailTab('field_ref')
    if (!def) return
    const newTab: DetailTabConfig = { id: nanoid(), type: 'field_ref', config: { fieldKey }, zone: zoneId }
    onChangeTabs([...tabs, newTab])
    setSelectedTabId(newTab.id)
  }

  const handleLayoutChange = (next: DetailPageLayoutId) => {
    onChangeLayout(next)
    // If the selected tab's zone no longer exists in the new layout, the
    // store-level reconciliation (updateDetailLayout) already resets its
    // `zone` — but the selection itself stays valid either way since the
    // tab is never removed, only re-homed.
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="left-0 top-0 h-screen w-screen max-w-none translate-x-0 translate-y-0 rounded-none border-0 p-0 data-[state=closed]:slide-out-to-left-0 data-[state=closed]:slide-out-to-top-0 data-[state=open]:slide-in-from-left-0 data-[state=open]:slide-in-from-top-0"
      >
        <div className="flex h-full flex-col">
          <DialogHeader className="flex-row items-center justify-between gap-4 space-y-0">
            <div>
              <DialogTitle>Detail Page Builder</DialogTitle>
              <DialogDescription className="sr-only">
                Arrange this form's record-detail tabs and fields into main and sidebar zones, with a live preview.
              </DialogDescription>
            </div>
            <div className="mr-8 flex items-center gap-2">
              <div role="tablist" aria-label="Builder mode" className="flex items-center rounded-md border border-[hsl(var(--border))] p-0.5">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'edit'}
                  onClick={() => setMode('edit')}
                  className={cn(
                    'flex items-center gap-1.5 rounded px-2.5 py-1 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1 focus-visible:ring-offset-[hsl(var(--background))]',
                    mode === 'edit' ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))]',
                  )}
                >
                  <Pencil size={12} /> Edit
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'preview'}
                  onClick={() => setMode('preview')}
                  className={cn(
                    'flex items-center gap-1.5 rounded px-2.5 py-1 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-1 focus-visible:ring-offset-[hsl(var(--background))]',
                    mode === 'preview' ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))]',
                  )}
                >
                  <Eye size={12} /> Preview
                </button>
              </div>
              {mode === 'edit' && <LayoutPicker value={layout} onChange={handleLayoutChange} />}
            </div>
          </DialogHeader>

          {mode === 'edit' ? (
            <div className="flex min-h-0 flex-1">
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex items-center gap-2 border-b px-4 py-2.5" style={{ borderColor: 'hsl(var(--border))' }}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="outline" size="sm" className="gap-1.5">
                        <Plus size={13} /> Add Tab
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-72">
                      {allDetailTabs().filter((def) => def.type !== 'field_ref').map((def) => (
                        <DropdownMenuItem key={def.type} onClick={() => addTab(def.type)} className="items-start gap-2.5 py-2">
                          <def.icon size={15} className="mt-0.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
                          <span className="min-w-0">
                            <span className="block text-[12.5px] font-medium text-[hsl(var(--foreground))]">{def.label}</span>
                            <span className="block truncate text-[11px] text-[hsl(var(--muted-foreground))]">{def.description}</span>
                          </span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {nonMainZones.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="outline" size="sm" className="gap-1.5">
                          <Plus size={13} /> Add Field
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-64">
                        {pickableFieldOptions.length === 0 ? (
                          <p className="px-2 py-1.5 text-[12px] text-[hsl(var(--muted-foreground))]">This form has no fields yet.</p>
                        ) : (
                          pickableFieldOptions.map((el) => (
                            <DropdownMenuItem key={el.key} onClick={() => addField(el.key, nonMainZones[0].id)}>
                              {el.label}
                            </DropdownMenuItem>
                          ))
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                <DetailPageCanvas
                  tabs={tabs}
                  layout={layout}
                  selectedTabId={selectedTabId}
                  onSelectTab={setSelectedTabId}
                  onChange={onChangeTabs}
                />
              </div>

              <aside className="flex w-96 shrink-0 flex-col border-l" style={{ borderColor: 'hsl(var(--border))' }}>
                <ScrollArea className="flex-1">
                  <div className="p-4">
                    {selectedTab ? (
                      <DetailTabConfigForm
                        formId={formId}
                        tab={selectedTab}
                        onPatch={(patch) => patchTab(selectedTab.id, patch)}
                      />
                    ) : (
                      <p className="text-[12px] text-[hsl(var(--muted-foreground))]">Select a tab or field on the canvas to configure it.</p>
                    )}
                  </div>
                </ScrollArea>
              </aside>
            </div>
          ) : (
            <ScrollArea className="min-h-0 flex-1">
              <div className="mx-auto max-w-5xl p-6">
                <DetailPagePreview formId={formId} fields={fields} schema={schema} />
              </div>
            </ScrollArea>
          )}

          <DialogFooter className="items-center justify-between sm:justify-between">
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
              Changes apply instantly — use the builder's Save to persist them.
            </p>
            <Button type="button" onClick={() => onOpenChange(false)}>Done</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
