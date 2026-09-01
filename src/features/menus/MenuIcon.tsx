import { useQuery } from '@tanstack/react-query'
import type { LucideIcon } from 'lucide-react'
import { contentApi } from '@/features/content/api'
import { cn } from '@/lib/utils'
import { resolveMenuIcon, customIconContentId } from './menu-icons'

interface MenuIconProps {
  /** The stored `Menu.icon` — a catalog name, a "content:<id>" upload, or
   *  undefined. */
  icon: string | undefined | null
  /** Rendered when `icon` is unset, unrecognised, or an upload that can't be
   *  loaded. Always the menu type's own icon at every call site. */
  fallback: LucideIcon
  size?: number
  className?: string
}

/** The single place a menu's icon is turned into something on screen.
 *
 *  Both kinds of icon (catalog glyph, uploaded image) render at the same box
 *  size and take the same className, so the six call sites — builder tree,
 *  drag overlay, hidden tray, two Mobile Layout previews, runtime sidebar —
 *  don't each need their own branch. Colour classes only bite on the lucide
 *  path; an uploaded image carries its own colours and is deliberately left
 *  alone rather than being tinted or masked.
 *
 *  Every failure mode lands on `fallback`: no icon set, a catalog name this
 *  build doesn't carry, a deleted content object, a viewer without
 *  content:read. An icon is decoration — it must never be the reason a nav
 *  entry fails to render. */
export function MenuIcon({ icon, fallback: Fallback, size = 14, className }: MenuIconProps) {
  const contentId = customIconContentId(icon)

  // The fetching half lives in a child that only mounts for an actual
  // upload, so a menu using a catalog glyph — the overwhelmingly common
  // case, and every case before uploads existed — costs no query at all and
  // needs no QueryClientProvider above it. Calling useQuery here instead
  // (enabled:false for catalog icons) broke MenuTree's own tests, which
  // render the tree with no provider, and would have put an idle query on
  // every nav row in the runtime sidebar.
  if (contentId) {
    return <UploadedMenuIcon contentId={contentId} fallback={Fallback} size={size} className={className} />
  }

  const Icon = resolveMenuIcon(icon) ?? Fallback
  return <Icon size={size} className={cn('shrink-0', className)} />
}

function UploadedMenuIcon({ contentId, fallback: Fallback, size, className }: {
  contentId: string
  fallback: LucideIcon
  size: number
  className?: string
}) {
  // Presigned rather than a direct /content/{id} URL: that route needs
  // X-Client-ID/X-App-ID headers a native <img> load can never attach —
  // see features/content/api.ts, where the plain-URL helper was removed
  // after every real <img> load 401'd. Cached by React Query so a sidebar
  // showing the same icon on several menus mints one URL, not one per row.
  const { data, isError } = useQuery({
    queryKey: ['content', 'presigned', contentId],
    queryFn: () => contentApi.presignedUrl(contentId),
    // Presigned URLs expire; refetching on a long-lived runtime session is
    // cheaper than showing a silently broken image.
    staleTime: 10 * 60 * 1000,
    retry: 1,
  })

  // A deleted object, or a viewer without content:read, lands here — the
  // menu keeps its type icon rather than showing a broken image.
  if (isError) return <Fallback size={size} className={cn('shrink-0', className)} />

  // While the URL is in flight, hold the exact box the image will occupy so
  // the row doesn't reflow when it arrives.
  if (!data?.url) return <span className="shrink-0" style={{ width: size, height: size }} aria-hidden />

  return (
    <img
      src={data.url}
      alt=""
      aria-hidden
      width={size}
      height={size}
      className={cn('shrink-0 object-contain', className)}
      style={{ width: size, height: size }}
    />
  )
}
