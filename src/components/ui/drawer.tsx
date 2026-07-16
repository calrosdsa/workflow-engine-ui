import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const Drawer = DialogPrimitive.Root
const DrawerTrigger = DialogPrimitive.Trigger
const DrawerPortal = DialogPrimitive.Portal
const DrawerClose = DialogPrimitive.Close

const DrawerOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className,
    )}
    {...props}
  />
))
DrawerOverlay.displayName = DialogPrimitive.Overlay.displayName

interface DrawerContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /** md = default record-detail width, lg = wider tabbed views. */
  size?: 'md' | 'lg'
  /** Portal target. Pass the themed scope element (e.g. #runtime-root) so
   *  the drawer inherits that subtree's CSS variables and `dark` class
   *  instead of escaping to document.body, which has neither. */
  container?: HTMLElement | null
}

const DrawerContent = React.forwardRef<React.ComponentRef<typeof DialogPrimitive.Content>, DrawerContentProps>(
  ({ className, children, size = 'md', container, ...props }, ref) => (
    <DrawerPortal container={container}>
      <DrawerOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'fixed right-0 top-0 z-50 flex h-full w-full flex-col border-l shadow-xl',
          size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-md',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200',
          className,
        )}
        style={{ backgroundColor: 'hsl(var(--background))', color: 'hsl(var(--foreground))', borderColor: 'hsl(var(--border))' }}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className="absolute right-4 top-4 rounded-lg p-1 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2"
          style={{ color: 'hsl(var(--muted-foreground))' }}
        >
          <X size={16} />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DrawerPortal>
  ),
)
DrawerContent.displayName = DialogPrimitive.Content.displayName

const DrawerHeader = ({ className, style, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-1.5 border-b px-6 py-4', className)} style={{ borderColor: 'hsl(var(--border))', ...style }} {...props} />
)

const DrawerFooter = ({ className, style, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex items-center justify-end gap-2 border-t px-6 py-4', className)} style={{ borderColor: 'hsl(var(--border))', ...style }} {...props} />
)

const DrawerTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, style, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn('text-[15px] font-semibold', className)} style={{ color: 'hsl(var(--foreground))', ...style }} {...props} />
))
DrawerTitle.displayName = DialogPrimitive.Title.displayName

const DrawerDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, style, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn('text-sm', className)} style={{ color: 'hsl(var(--muted-foreground))', ...style }} {...props} />
))
DrawerDescription.displayName = DialogPrimitive.Description.displayName

export {
  Drawer, DrawerPortal, DrawerOverlay, DrawerClose, DrawerTrigger,
  DrawerContent, DrawerHeader, DrawerFooter, DrawerTitle, DrawerDescription,
}
