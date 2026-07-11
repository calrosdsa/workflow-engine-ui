import type { ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select-menu'
import { usePageBuilderStore, findComponent } from '../store'
import { PAGE_COMPONENT_REGISTRY } from '../component-registry'
import type { PageComponent } from '../schema'
import { MenuSlugSelect } from './MenuSlugSelect'

// Modeled on features/form-builder/config/ConfigPanel.tsx's per-element-type
// property switch (PresentationalGeneral) — one case per PageComponentType,
// homogeneous enough (a handful of text/select/number inputs) that a single
// panel with an internal switch is the right level of reuse, matching the
// registry-pattern decision (metadata + switch, not one component per type).
//
// Finds its own selection from usePageBuilderStore directly rather than
// taking it as a prop, matching ConfigPanel.tsx's own convention.

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-medium text-slate-600">{label}</Label>
      {children}
      {hint && <p className="text-[10px] text-slate-400">{hint}</p>}
    </div>
  )
}

interface PropertyFieldsProps {
  component: PageComponent
  onChange: (patch: Partial<PageComponent>) => void
  /** The Custom menu currently being edited — passed through so the button
   *  component's "target another menu" picker can exclude linking to itself. */
  currentMenuId?: string
}

function PropertyFields({ component, onChange, currentMenuId }: PropertyFieldsProps) {
  switch (component.component) {
    case 'heading':
      return (
        <>
          <Field label="Heading Text">
            <Input value={component.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} className="h-8 text-sm" />
          </Field>
          <Field label="Level">
            <SelectMenu value={String(component.level ?? 2)} onValueChange={(v) => onChange({ level: Number(v) as 1 | 2 | 3 })}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1" className="text-xs">Heading 1 (large)</SelectItem>
                <SelectItem value="2" className="text-xs">Heading 2 (medium)</SelectItem>
                <SelectItem value="3" className="text-xs">Heading 3 (small)</SelectItem>
              </SelectContent>
            </SelectMenu>
          </Field>
        </>
      )
    case 'paragraph':
      return (
        <Field label="Paragraph Text">
          <Textarea value={component.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} rows={4} className="text-sm" />
        </Field>
      )
    case 'image':
      return (
        <>
          <Field label="Image URL" hint="No file upload yet — paste a direct link to an image.">
            <Input value={component.src ?? ''} onChange={(e) => onChange({ src: e.target.value })} placeholder="https://…" className="h-8 text-sm" />
          </Field>
          <Field label="Alt Text">
            <Input value={component.alt ?? ''} onChange={(e) => onChange({ alt: e.target.value })} className="h-8 text-sm" />
          </Field>
          <Field label="Width">
            <SelectMenu value={component.width ?? 'full'} onValueChange={(v) => onChange({ width: v as PageComponent['width'] })}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="full" className="text-xs">Full width</SelectItem>
                <SelectItem value="half" className="text-xs">Half width</SelectItem>
                <SelectItem value="third" className="text-xs">A third</SelectItem>
                <SelectItem value="auto" className="text-xs">Auto (natural size)</SelectItem>
              </SelectContent>
            </SelectMenu>
          </Field>
        </>
      )
    case 'spacer':
      return (
        <Field label="Height (px)">
          <Input type="number" value={component.height ?? 24} onChange={(e) => onChange({ height: Number(e.target.value) })} className="h-8 text-sm" />
        </Field>
      )
    case 'divider':
      return <p className="text-xs text-slate-400">A horizontal divider line. No configuration needed.</p>
    case 'button':
      return (
        <>
          <Field label="Button Label">
            <Input value={component.label ?? ''} onChange={(e) => onChange({ label: e.target.value })} className="h-8 text-sm" />
          </Field>
          <Field label="Style">
            <SelectMenu value={component.variant ?? 'primary'} onValueChange={(v) => onChange({ variant: v as PageComponent['variant'] })}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="primary" className="text-xs">Primary</SelectItem>
                <SelectItem value="secondary" className="text-xs">Secondary</SelectItem>
                <SelectItem value="outline" className="text-xs">Outline</SelectItem>
              </SelectContent>
            </SelectMenu>
          </Field>
          <div>
            <Label className="mb-1.5 block text-[11px] font-medium text-slate-600">Links to</Label>
            <div className="flex gap-1 rounded-md bg-slate-100 p-0.5">
              {(['menu', 'external'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => onChange({ linkType: t })}
                  className={`flex-1 rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                    (component.linkType ?? 'external') === t ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400'
                  }`}
                >
                  {t === 'menu' ? 'Another menu' : 'External URL'}
                </button>
              ))}
            </div>
          </div>
          {(component.linkType ?? 'external') === 'menu' ? (
            <Field label="Target menu">
              <MenuSlugSelect value={component.menuSlug ?? ''} onChange={(slug) => onChange({ menuSlug: slug })} excludeMenuId={currentMenuId} />
            </Field>
          ) : (
            <Field label="URL">
              <Input value={component.url ?? ''} onChange={(e) => onChange({ url: e.target.value })} placeholder="https://…" className="h-8 text-sm" />
            </Field>
          )}
        </>
      )
    default:
      return null
  }
}

export function ComponentPropertiesPanel({ currentMenuId }: { currentMenuId?: string }) {
  const schema = usePageBuilderStore((s) => s.schema)
  const selectedComponentId = usePageBuilderStore((s) => s.selectedItemId)
  const updateComponent = usePageBuilderStore((s) => s.updateItem)

  if (!selectedComponentId) return null
  const found = findComponent(schema, selectedComponentId)
  if (!found) return null

  const reg = PAGE_COMPONENT_REGISTRY[found.item.component]
  const Icon = reg.icon

  return (
    <div className="space-y-4 border-t border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <Icon size={14} className="text-indigo-500" />
        <p className="text-xs font-semibold text-slate-700">{reg.label} properties</p>
      </div>
      <PropertyFields
        component={found.item}
        onChange={(patch) => updateComponent(selectedComponentId, patch)}
        currentMenuId={currentMenuId}
      />
    </div>
  )
}
