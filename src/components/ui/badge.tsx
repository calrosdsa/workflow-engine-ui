import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default:     'bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))]',
        secondary:   'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]',
        destructive: 'bg-[hsl(var(--destructive))]/15 text-[hsl(var(--destructive))]',
        success:     'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]',
        warning:     'bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]',
        outline:     'border border-[hsl(var(--border))] text-[hsl(var(--foreground))]',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}
