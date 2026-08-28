import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'

const Tabs = TabsPrimitive.Root

// TabsList/TabsTrigger default to the classic horizontal underline style.
// A vertical bar (Detail Page Builder's tabOrientation setting) needs a
// different axis for both the flex direction and the active-state
// indicator (left border instead of bottom border, full-width instead of
// -mb-px) — Radix's own `orientation` prop only changes keyboard nav
// direction, not visual layout, so that's driven separately here off the
// same prop value already passed to <Tabs orientation="...">.
const TabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'flex items-center gap-1 border-b',
      'data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch data-[orientation=vertical]:border-b-0 data-[orientation=vertical]:border-r data-[orientation=vertical]:gap-0.5',
      className,
    )}
    style={{ borderColor: 'hsl(var(--border))' }}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'relative inline-flex items-center justify-center whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-colors',
      '-mb-px border-b-2 border-transparent',
      'data-[orientation=vertical]:mb-0 data-[orientation=vertical]:-mr-px data-[orientation=vertical]:justify-start data-[orientation=vertical]:border-b-0 data-[orientation=vertical]:border-r-2 data-[orientation=vertical]:px-3 data-[orientation=vertical]:py-2 data-[orientation=vertical]:text-left',
      'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:rounded-sm',
      'disabled:pointer-events-none disabled:opacity-50',
      'data-[state=active]:border-[hsl(var(--primary))] data-[state=active]:text-[hsl(var(--foreground))]',
      className,
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-4 focus-visible:outline-none',
      'data-[state=inactive]:hidden',
      className,
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
