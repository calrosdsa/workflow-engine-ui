// The 5 presentational (non-data-bearing) form-builder types each get their
// own General-tab component here, referenced from component-registry.ts's
// configPanel field — the same form/normalise pattern node-registry.ts and
// menu-registry.ts use, scoped to just these 5 (the other 19 component types
// share ConfigPanel.tsx's ElementConfig tabs directly; that shared flow isn't
// shallow, so it isn't broken up into one-component-per-type).
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select-menu'
import { Field } from './ConfigPanel'
import { slugifyKey } from '../factory'
import type { FormElement } from '../schema'

export interface PresentationalFormProps {
  element: FormElement
  onChange: (patch: Partial<FormElement>) => void
}

export function HeadingForm({ element, onChange }: PresentationalFormProps) {
  return (
    <>
      <Field label="Heading Text">
        <Input value={element.content ?? ''} onChange={(e) => onChange({ content: e.target.value })} className="h-8 text-sm" />
      </Field>
      <Field label="Level">
        <SelectMenu value={String(element.level ?? 2)} onValueChange={(v) => onChange({ level: Number(v) as 1 | 2 | 3 })}>
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
}

export function ParagraphForm({ element, onChange }: PresentationalFormProps) {
  return (
    <Field label="Paragraph Text">
      <Textarea value={element.content ?? ''} onChange={(e) => onChange({ content: e.target.value })} rows={4} className="text-sm" />
    </Field>
  )
}

export function SpacerForm({ element, onChange }: PresentationalFormProps) {
  return (
    <Field label="Height (px)">
      <Input type="number" value={element.height ?? 24} onChange={(e) => onChange({ height: Number(e.target.value) })} className="h-8 text-sm" />
    </Field>
  )
}

export function DividerForm() {
  return <p className="text-xs text-slate-400">A horizontal divider line. No configuration needed.</p>
}

export function HiddenForm({ element, onChange }: PresentationalFormProps) {
  return (
    <>
      <Field label="Field Name / Key">
        <Input value={element.key} onChange={(e) => onChange({ key: slugifyKey(e.target.value) })} className="h-8 font-mono text-[12px]" />
      </Field>
      <Field label="Default Value">
        <Input value={element.defaultValue == null ? '' : String(element.defaultValue)} onChange={(e) => onChange({ defaultValue: e.target.value })} className="h-8 text-sm" />
      </Field>
    </>
  )
}
