import { cn } from '@/lib/utils'

interface AvatarProps {
  name: string
  className?: string
}

// Initials-based avatar — there is no photo/image field anywhere in the user
// data model, so a plain letters-on-a-circle avatar is the only option
// (no @radix-ui/react-avatar image-fallback machinery needed for that).
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

export function Avatar({ name, className }: AvatarProps) {
  return (
    <span
      className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
        className,
      )}
      style={{ backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
    >
      {initials(name)}
    </span>
  )
}
