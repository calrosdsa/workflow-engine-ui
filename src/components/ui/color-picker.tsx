import * as React from 'react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export interface ColorPickerProps {
  /** Hex color, e.g. "#3b82f6". */
  value: string
  onChange: (hex: string) => void
  className?: string
}

export const ColorPicker = React.forwardRef<HTMLButtonElement, ColorPickerProps>(
  ({ value, onChange, className }, ref) => (
    <Popover>
      <PopoverTrigger asChild>
        <button
          ref={ref}
          type="button"
          className={cn(
            'flex h-8 w-full items-center gap-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-left text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--background))]',
            className,
          )}
        >
          <span className="h-4 w-4 shrink-0 rounded border border-black/10" style={{ backgroundColor: value }} />
          <span className="font-mono text-xs text-[hsl(var(--muted-foreground))]">{value}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 space-y-2 p-3">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-24 w-full cursor-pointer rounded-md border border-[hsl(var(--border))]"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-[hsl(var(--border))] px-2 py-1 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
          placeholder="#3b82f6"
        />
      </PopoverContent>
    </Popover>
  ),
)
ColorPicker.displayName = 'ColorPicker'
