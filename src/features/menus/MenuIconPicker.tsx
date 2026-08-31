import { useMemo, useState } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { MENU_ICON_GROUPS, resolveMenuIcon, iconSearchText } from './menu-icons'

interface MenuIconPickerProps {
  /** The stored icon name, or undefined for "use the menu type's icon". */
  value: string | undefined
  onChange: (icon: string | undefined) => void
  /** The menu type's own icon — shown as the "Default" option's preview and
   *  as the trigger's preview when nothing is chosen, so the control always
   *  shows what will actually render rather than an empty box. */
  fallbackIcon: LucideIcon
  disabled?: boolean
}

/** Picks the icon a menu shows in the builder tree and the runtime sidebar.
 *
 *  "Default" is a real, selectable option rather than an implicit empty
 *  state: clearing an icon is something authors do on purpose, and a
 *  disabled-looking blank cell wouldn't say what clearing gets you. */
export function MenuIconPicker({ value, onChange, fallbackIcon: Fallback, disabled }: MenuIconPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const Selected = resolveMenuIcon(value)

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return MENU_ICON_GROUPS
    return MENU_ICON_GROUPS
      .map((g) => ({ ...g, icons: g.icons.filter((i) => iconSearchText(i.name).includes(q)) }))
      .filter((g) => g.icons.length > 0)
  }, [query])

  const choose = (name: string | undefined) => {
    onChange(name)
    setOpen(false)
    setQuery('')
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setQuery('')
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="flex h-9 w-full items-center gap-2 rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-2.5 text-sm text-[hsl(var(--foreground))] transition-colors hover:border-[hsl(var(--ring))]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {Selected ? (
            <Selected size={15} className="shrink-0 text-[hsl(var(--primary))]" />
          ) : (
            <Fallback size={15} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
          )}
          <span className={cn('min-w-0 flex-1 truncate text-left', !Selected && 'text-[hsl(var(--muted-foreground))]')}>
            {Selected ? value : 'Default'}
          </span>
          {Selected && !disabled && (
            // A span, not a nested button: this trigger is itself a button,
            // and nesting one inside it is invalid HTML that browsers
            // reparent, which breaks the popover trigger entirely.
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear icon"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onChange(undefined) }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onChange(undefined) }
              }}
              className="shrink-0 rounded p-0.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
            >
              <X size={13} />
            </span>
          )}
          <ChevronDown size={14} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-[320px] p-0">
        <div className="border-b border-[hsl(var(--border))] p-2">
          <div className="relative">
            <Search size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search icons…"
              className="h-8 pl-7 text-xs"
            />
          </div>
        </div>

        <div className="max-h-[260px] overflow-y-auto p-2">
          <button
            type="button"
            onClick={() => choose(undefined)}
            className={cn(
              'mb-2 flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-colors',
              value === undefined
                ? 'border-[hsl(var(--primary))]/50 bg-[hsl(var(--primary))]/10 text-[hsl(var(--foreground))]'
                : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]/50',
            )}
          >
            <Fallback size={14} className="shrink-0" />
            Default — this menu type&apos;s icon
          </button>

          {groups.length === 0 ? (
            <p className="py-6 text-center text-[11px] text-[hsl(var(--muted-foreground))]">
              No icon matches “{query}”.
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.label} className="mb-2 last:mb-0">
                <p className="mb-1 px-0.5 text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                  {group.label}
                </p>
                <div className="grid grid-cols-8 gap-1">
                  {group.icons.map(({ name, Icon }) => (
                    <button
                      key={name}
                      type="button"
                      title={name}
                      aria-label={name}
                      aria-pressed={value === name}
                      onClick={() => choose(name)}
                      className={cn(
                        'flex h-8 w-full items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]',
                        value === name
                          ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))]'
                          : 'border-transparent text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]/60 hover:text-[hsl(var(--foreground))]',
                      )}
                    >
                      <Icon size={15} />
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
