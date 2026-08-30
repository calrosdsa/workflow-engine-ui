import { cn } from '@/lib/utils'
import type { Capability } from './types'

const LABELS: Record<Capability, string> = { llm: 'LLM', embedding: 'Embedding' }

export function CapabilityBadge({ capability, className }: { capability: Capability; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none',
        capability === 'llm'
          ? 'border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]'
          : 'border-[hsl(var(--muted-foreground))]/30 bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]',
        className,
      )}
    >
      {LABELS[capability]}
    </span>
  )
}
