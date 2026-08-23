// Renders a FormElement as a non-interactive preview matching how it will look
// in the published form. Uses shadcn/ui controls. This is presentation-only —
// the actual form runtime would wire these to React Hook Form.

import {
  Asterisk, ChevronDown, Calendar, Clock, Upload, Image as ImageIcon, Search,
  FileText, AlertTriangle,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useForms } from '@/features/forms/hooks'
import { iterLineItemElements } from './lineItemsSync'
import type { FormElement } from './schema'

export function ElementPreview({ element }: { element: FormElement }) {
  const required = element.behavior.required === 'always'

  // Presentational components render without the label wrapper.
  switch (element.component) {
    case 'divider':
      return <hr className="my-2 border-[hsl(var(--border))]" />
    case 'spacer':
      return <div style={{ height: element.height ?? 24 }} aria-hidden />
    case 'heading': {
      const sizes = { 1: 'text-xl', 2: 'text-lg', 3: 'text-base' }
      return <p className={cn('font-semibold text-[hsl(var(--foreground))]', sizes[element.level ?? 2])}>{element.content || 'Heading'}</p>
    }
    case 'paragraph':
      return <p className="text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{element.content || 'Paragraph text.'}</p>
    case 'hidden':
      return (
        <div className="flex items-center gap-2 rounded-md border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-2.5 py-1.5 text-[11px] text-[hsl(var(--muted-foreground))]">
          <span className="font-mono">{element.key}</span>
          <span className="rounded bg-[hsl(var(--border))] px-1.5 py-0.5 text-[9px] uppercase">hidden</span>
        </div>
      )
  }

  // Data-bearing components share a label + control layout.
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1">
        <Label className="text-[12px] font-medium text-[hsl(var(--foreground))]">{element.label}</Label>
        {required && <Asterisk size={9} className="text-[hsl(var(--destructive))]" />}
      </div>
      {element.description && <p className="-mt-0.5 text-[11px] text-[hsl(var(--muted-foreground))]">{element.description}</p>}

      <FieldControl element={element} />

      {element.helpText && <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{element.helpText}</p>}
    </div>
  )
}

function FieldControl({ element }: { element: FormElement }) {
  const ph = element.placeholder
  const disabled = element.behavior.disabled || element.behavior.readOnly === 'always'

  const withAffix = (node: React.ReactNode) => {
    if (!element.appearance.prefix && !element.appearance.suffix) return node
    return (
      <div className="flex items-stretch overflow-hidden rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] focus-within:border-[hsl(var(--ring))] focus-within:ring-2 focus-within:ring-[hsl(var(--ring))]/20">
        {element.appearance.prefix && <span className="flex items-center bg-[hsl(var(--muted))] px-2.5 text-[12px] text-[hsl(var(--muted-foreground))]">{element.appearance.prefix}</span>}
        <div className="flex-1 [&>*]:border-0 [&>*]:shadow-none [&>*]:focus-visible:ring-0">{node}</div>
        {element.appearance.suffix && <span className="flex items-center bg-[hsl(var(--muted))] px-2.5 text-[12px] text-[hsl(var(--muted-foreground))]">{element.appearance.suffix}</span>}
      </div>
    )
  }

  switch (element.component) {
    case 'text': case 'email': case 'url': case 'password': case 'phone':
      return withAffix(<Input type={element.component === 'password' ? 'password' : 'text'} placeholder={ph} disabled={disabled} className="h-8 text-sm" />)
    case 'number':
      return withAffix(<Input type="number" placeholder={ph} disabled={disabled} className="h-8 text-sm" />)
    case 'textarea': case 'richtext':
      return <Textarea placeholder={ph} disabled={disabled} className="text-sm" rows={element.component === 'richtext' ? 4 : 3} />

    case 'date':
      return <FakeInput icon={<Calendar size={13} />} text={ph || 'Select date'} />
    case 'time':
      return <FakeInput icon={<Clock size={13} />} text={ph || 'Select time'} />
    case 'datetime':
      return <FakeInput icon={<Calendar size={13} />} text={ph || 'Select date & time'} />

    case 'select': case 'autocomplete': case 'role':
      return (
        <FakeInput
          icon={element.component === 'autocomplete' ? <Search size={13} /> : undefined}
          trailing={<ChevronDown size={14} className="text-[hsl(var(--muted-foreground))]" />}
          text={ph || (element.component === 'role' ? 'Select a role…' : 'Select…')}
        />
      )
    case 'form':
      return <FormRefControl formRef={element.formRef} />
    case 'line_items':
      return <LineItemsControl element={element} />
    case 'multiselect':
      return (
        <div className="flex min-h-8 flex-wrap items-center gap-1 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1">
          {(element.options ?? []).slice(0, 2).map((o) => (
            <span key={o.value} className="rounded bg-[hsl(var(--primary))]/15 px-1.5 py-0.5 text-[11px] text-[hsl(var(--primary))]">{o.label}</span>
          ))}
          <span className="text-[12px] text-[hsl(var(--muted-foreground))]">{ph || 'Select…'}</span>
        </div>
      )

    case 'checkbox':
      return (
        <div className="flex items-center gap-2">
          <Checkbox disabled={disabled} />
          <span className="text-[12px] text-[hsl(var(--muted-foreground))]">{element.placeholder || 'Checkbox option'}</span>
        </div>
      )
    case 'switch':
      return (
        <div className="flex items-center gap-2">
          <Switch disabled={disabled} />
          <span className="text-[12px] text-[hsl(var(--muted-foreground))]">{element.placeholder || 'Toggle'}</span>
        </div>
      )
    case 'radio':
      return (
        <RadioGroup className="gap-1.5" disabled={disabled}>
          {(element.options ?? []).map((o) => (
            <div key={o.value} className="flex items-center gap-2">
              <RadioGroupItem value={o.value} id={`${element.id}-${o.value}`} />
              <Label htmlFor={`${element.id}-${o.value}`} className="text-[12px] font-normal text-[hsl(var(--muted-foreground))]">{o.label}</Label>
            </div>
          ))}
        </RadioGroup>
      )

    case 'file':
      return <DropArea icon={<Upload size={16} />} text="Click or drag a file to upload" />
    case 'image':
      return <DropArea icon={<ImageIcon size={16} />} text="Click or drag an image to upload" />

    default:
      return <Input placeholder={ph} disabled={disabled} className="h-8 text-sm" />
  }
}

// Renders a form-reference field, displaying the referenced form's NAME (never
// its id). Warns when the stored reference points at a missing/deleted form.
function FormRefControl({ formRef }: { formRef?: string }) {
  const { data: forms, isLoading } = useForms()
  const selected = (forms ?? []).find((f) => f.id === formRef)
  const isBroken = !!formRef && !isLoading && !selected

  if (!formRef) {
    return <FakeInput icon={<FileText size={13} />} trailing={<ChevronDown size={14} className="text-[hsl(var(--muted-foreground))]" />} text="No form referenced" />
  }
  if (isBroken) {
    return (
      <div className="flex h-8 items-center gap-2 rounded-md border border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/15 px-2.5 text-[12px] text-[hsl(var(--warning))]">
        <AlertTriangle size={13} className="shrink-0" />
        <span className="flex-1 truncate">Referenced form unavailable</span>
      </div>
    )
  }
  return (
    <div className="flex h-8 items-center gap-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 text-[12px] text-[hsl(var(--muted-foreground))]">
      <FileText size={13} className="shrink-0 text-[hsl(var(--primary))]" />
      <span className="flex-1 truncate">{isLoading ? 'Loading…' : selected?.name}</span>
      <ChevronDown size={14} className="text-[hsl(var(--muted-foreground))]" />
    </div>
  )
}

// Renders a small mock grid matching the configured columns — a preview
// only, not interactive (real editing happens in the runtime's LineItemsGrid).
// The grid's table view is always a flat column list (a table has no room
// for the row-editor's own sections/columns) — flatten them here the same
// way LineItemsGrid.tsx does for the real table.
function LineItemsControl({ element }: { element: FormElement }) {
  const columns = [...iterLineItemElements(element.lineItemColumns ?? [])]
  if (columns.length === 0) {
    return (
      <div className="flex h-16 items-center justify-center rounded-md border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50 text-[12px] text-[hsl(var(--muted-foreground))]">
        No columns configured yet
      </div>
    )
  }
  return (
    <div className="overflow-hidden rounded-md border border-[hsl(var(--border))]">
      <table className="w-full text-left text-[11px]">
        <thead className="bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
          <tr>
            {columns.map((c) => (
              <th key={c.id} className="border-b border-[hsl(var(--border))] px-2 py-1.5 font-medium">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="text-[hsl(var(--muted-foreground))]">
          <tr>
            {columns.map((c) => (
              <td key={c.id} className="border-b border-[hsl(var(--border))] px-2 py-1.5">—</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function FakeInput({ icon, text, trailing }: { icon?: React.ReactNode; text: string; trailing?: React.ReactNode }) {
  return (
    <div className="flex h-8 items-center gap-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 text-[12px] text-[hsl(var(--muted-foreground))]">
      {icon && <span className="text-[hsl(var(--muted-foreground))]">{icon}</span>}
      <span className="flex-1 truncate">{text}</span>
      {trailing}
    </div>
  )
}

function DropArea({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50 py-5 text-[hsl(var(--muted-foreground))]">
      {icon}
      <span className="text-[11px]">{text}</span>
    </div>
  )
}
