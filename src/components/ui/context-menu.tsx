import * as React from 'react'
import * as ContextMenuPrimitive from '@radix-ui/react-context-menu'
import { cn } from '@/lib/utils'

const ContextMenu = ContextMenuPrimitive.Root
const ContextMenuTrigger = ContextMenuPrimitive.Trigger
const ContextMenuGroup = ContextMenuPrimitive.Group

interface ContextMenuContentProps extends React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content> {
  /** Portal target — same reasoning as DropdownMenuContent's own `container`
   *  prop: pass the themed scope element so the menu inherits that
   *  subtree's CSS variables instead of escaping to document.body. */
  container?: HTMLElement | null
}

const ContextMenuContent = React.forwardRef<React.ComponentRef<typeof ContextMenuPrimitive.Content>, ContextMenuContentProps>(
  ({ className, container, ...props }, ref) => (
    <ContextMenuPrimitive.Portal container={container}>
      <ContextMenuPrimitive.Content
        ref={ref}
        className={cn(
          'z-50 min-w-[10rem] overflow-hidden rounded-lg border p-1 shadow-lg',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          className,
        )}
        style={{ backgroundColor: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))', borderColor: 'hsl(var(--border))' }}
        {...props}
      />
    </ContextMenuPrimitive.Portal>
  ),
)
ContextMenuContent.displayName = ContextMenuPrimitive.Content.displayName

const ContextMenuItem = React.forwardRef<
  React.ComponentRef<typeof ContextMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item> & { destructive?: boolean }
>(({ className, destructive, ...props }, ref) => (
  <ContextMenuPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-[13px] outline-none transition-colors',
      'focus:bg-[hsl(var(--accent))] focus:text-[hsl(var(--accent-foreground))] data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      destructive ? 'text-[hsl(var(--destructive))] focus:bg-[hsl(var(--destructive))]/10 focus:text-[hsl(var(--destructive))]' : '',
      className,
    )}
    {...props}
  />
))
ContextMenuItem.displayName = ContextMenuPrimitive.Item.displayName

const ContextMenuSeparator = React.forwardRef<
  React.ComponentRef<typeof ContextMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Separator ref={ref} className={cn('-mx-1 my-1 h-px bg-[hsl(var(--border))]', className)} {...props} />
))
ContextMenuSeparator.displayName = ContextMenuPrimitive.Separator.displayName

const ContextMenuLabel = React.forwardRef<
  React.ComponentRef<typeof ContextMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Label>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Label
    ref={ref}
    className={cn('px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]', className)}
    {...props}
  />
))
ContextMenuLabel.displayName = ContextMenuPrimitive.Label.displayName

export {
  ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem,
  ContextMenuGroup, ContextMenuSeparator, ContextMenuLabel,
}
