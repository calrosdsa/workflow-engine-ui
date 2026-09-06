import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Search, X, Upload, Loader2, Trash2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { contentApi, type ContentOwner } from '@/features/content/api'
import type { ContentObject } from '@/features/content/types'
import { MenuIcon } from './MenuIcon'
import {
  MENU_ICON_GROUPS, resolveMenuIcon, iconSearchText, toKebabIconName,
  customIconContentId, customIconValue,
  CUSTOM_ICON_MIME_TYPES, validateCustomIconFile,
} from './menu-icons'

// Uploaded icons are app-scoped, not menu-scoped: no resource id, so every
// menu in the app draws from one small shared library. Uploading an icon
// once makes it reusable, and pointing a second menu at it costs nothing.
//
// Its own owner kind, NOT app_asset: that bucket holds the Report Builder's
// image-block uploads, so listing it here would show report images as
// selectable icons and offer a delete on each — confirmed live against a
// real report image already in that bucket.
const ICON_OWNER: ContentOwner = { ownerKind: 'menu_icon', ownerResourceId: '' }
const ICON_LIBRARY_KEY = ['content', 'menu_icon', 'library'] as const

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
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()

  const Selected = resolveMenuIcon(value)
  const selectedContentId = customIconContentId(value)

  // Only fetched while the popover is open — an app's icon library is a
  // design-time concern, and every menu row would otherwise mount a picker
  // that fetched it.
  const { data: library } = useQuery({
    queryKey: ICON_LIBRARY_KEY,
    queryFn: () => contentApi.list(ICON_OWNER),
    enabled: open,
  })

  const uploadMutation = useMutation({
    mutationFn: (file: File) => contentApi.upload(ICON_OWNER, file),
    onSuccess: (obj: ContentObject) => {
      qc.invalidateQueries({ queryKey: ICON_LIBRARY_KEY })
      // Selecting the upload immediately is the whole point of the action —
      // nobody uploads an icon in order to then pick it out of a grid.
      choose(customIconValue(obj.id))
    },
    onError: () => setUploadError('Upload failed — try again.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => contentApi.delete(id),
    onSuccess: (_r, id) => {
      qc.invalidateQueries({ queryKey: ICON_LIBRARY_KEY })
      // A menu pointing at the deleted object would render its type icon
      // from here on; clear the reference so the stored value matches.
      if (customIconContentId(value) === id) onChange(undefined)
    },
  })

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

  const handleFile = (file: File | undefined) => {
    setUploadError(null)
    if (!file) return
    const problem = validateCustomIconFile(file)
    if (problem) {
      setUploadError(problem)
      return
    }
    uploadMutation.mutate(file)
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
          <MenuIcon
            icon={value}
            fallback={Fallback}
            size={15}
            className={value ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground))]'}
          />
          <span className={cn('min-w-0 flex-1 truncate text-left', !value && 'text-[hsl(var(--muted-foreground))]')}>
            {selectedContentId ? 'Uploaded icon' : Selected ? value : 'Default'}
          </span>
          {value && !disabled && (
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

          {/* Upload + the app's own icon library. Kept above the catalog so
              a custom icon is a first-class choice rather than something
              buried under 115 built-ins. */}
          <div className="mb-2 rounded-md border border-[hsl(var(--border))] p-2">
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                Custom
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadMutation.isPending}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]/60 disabled:opacity-50"
              >
                {uploadMutation.isPending ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
                {uploadMutation.isPending ? 'Uploading…' : 'Upload'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept={CUSTOM_ICON_MIME_TYPES.join(',')}
                className="hidden"
                onChange={(e) => {
                  handleFile(e.target.files?.[0])
                  // Reset so choosing the SAME file again still fires change.
                  e.target.value = ''
                }}
              />
            </div>

            {uploadError && (
              <p className="mb-1.5 text-[11px] text-[hsl(var(--destructive))]">{uploadError}</p>
            )}

            {library && library.length > 0 ? (
              <div className="grid grid-cols-8 gap-1">
                {library.map((obj) => (
                  <div key={obj.id} className="group relative">
                    <button
                      type="button"
                      title={obj.filename}
                      aria-label={obj.filename}
                      aria-pressed={selectedContentId === obj.id}
                      onClick={() => choose(customIconValue(obj.id))}
                      className={cn(
                        'flex h-8 w-full items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]',
                        selectedContentId === obj.id
                          ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/15'
                          : 'border-transparent hover:border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]/60',
                      )}
                    >
                      <MenuIcon icon={customIconValue(obj.id)} fallback={Fallback} size={16} />
                    </button>
                    <button
                      type="button"
                      title={`Delete ${obj.filename}`}
                      aria-label={`Delete ${obj.filename}`}
                      onClick={() => deleteMutation.mutate(obj.id)}
                      disabled={deleteMutation.isPending}
                      className="absolute -right-1 -top-1 hidden rounded-full bg-[hsl(var(--card))] p-0.5 text-[hsl(var(--muted-foreground))] shadow hover:text-[hsl(var(--destructive))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] group-focus-within:block group-hover:block"
                    >
                      <Trash2 size={9} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                Upload a PNG, SVG, WebP or JPEG. Transparency is preserved, and uploads are shared across
                this app&apos;s menus.
              </p>
            )}
          </div>

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
                  {group.icons.map(({ name, Icon }) => {
                    // Written and compared in lucide's own kebab spelling —
                    // matches what the app-builder API writes directly, and
                    // what resolveMenuIcon() normalizes any stored value to.
                    // See menu-icons.ts's module doc comment.
                    const kebab = toKebabIconName(name)
                    return (
                      <button
                        key={name}
                        type="button"
                        title={name}
                        aria-label={name}
                        aria-pressed={value === kebab}
                        onClick={() => choose(kebab)}
                        className={cn(
                          'flex h-8 w-full items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]',
                          value === kebab
                            ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))]'
                            : 'border-transparent text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]/60 hover:text-[hsl(var(--foreground))]',
                        )}
                      >
                        <Icon size={15} />
                      </button>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
