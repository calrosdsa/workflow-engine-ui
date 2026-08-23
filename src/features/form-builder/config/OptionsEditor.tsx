import { Plus, Trash2, GripVertical } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { slugifyKey } from '../factory'
import type { SelectOption } from '../schema'

interface OptionsEditorProps {
  options: SelectOption[]
  onChange: (options: SelectOption[]) => void
}

export function OptionsEditor({ options, onChange }: OptionsEditorProps) {
  const update = (i: number, patch: Partial<SelectOption>) => {
    onChange(options.map((o, idx) => (idx === i ? { ...o, ...patch } : o)))
  }
  const add = () => {
    const n = options.length + 1
    onChange([...options, { label: `Option ${n}`, value: `option_${n}` }])
  }
  const remove = (i: number) => onChange(options.filter((_, idx) => idx !== i))

  return (
    <div className="space-y-1.5">
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <GripVertical size={13} className="shrink-0 text-[hsl(var(--muted-foreground))]/60" />
          <Input
            value={opt.label}
            onChange={(e) => {
              // Auto-sync value from label while they match the slug of the label.
              const newLabel = e.target.value
              const wasAuto = opt.value === slugifyKey(opt.label)
              update(i, wasAuto ? { label: newLabel, value: slugifyKey(newLabel) } : { label: newLabel })
            }}
            placeholder="Label"
            className="h-7 text-xs"
          />
          <Input
            value={opt.value}
            onChange={(e) => update(i, { value: e.target.value })}
            placeholder="value"
            className="h-7 w-28 font-mono text-[11px] text-[hsl(var(--muted-foreground))]"
          />
          <button
            onClick={() => remove(i)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--destructive))]/10 hover:text-[hsl(var(--destructive))]"
            title="Remove option"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add} className="w-full gap-1.5 border-dashed text-[hsl(var(--muted-foreground))]">
        <Plus size={12} /> Add Option
      </Button>
    </div>
  )
}
