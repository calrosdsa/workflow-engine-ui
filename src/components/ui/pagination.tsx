import { cn } from '@/lib/utils'

interface PaginationProps {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
}

/** Simple numbered pager for client-side paginated lists (no ellipsis
 *  collapsing — team lists are small enough this stays readable). */
export function Pagination({ page, pageCount, onPageChange }: PaginationProps) {
  if (pageCount <= 1) return null

  return (
    <div className="flex items-center justify-end gap-1 px-4 py-3">
      {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          onClick={() => onPageChange(n)}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--background))]',
            n === page
              ? 'bg-[hsl(var(--accent))] font-medium text-[hsl(var(--accent-foreground))]'
              : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]',
          )}
        >
          {n}
        </button>
      ))}
    </div>
  )
}
