import { Toaster as SonnerToaster, type ToasterProps } from 'sonner'
import { useThemeMode } from '@/features/theme/ThemeProvider'

/** Toast host — mount once per themed scope (currently: the runtime app's
 *  RuntimeAppRouteComponent, sibling to <Outlet> inside its ThemeProvider)
 *  so every toast() call anywhere in that subtree renders through this one
 *  instance and inherits the same CSS-variable theme. Sonner reads its own
 *  set of CSS vars (normal/success/error/warning/info, each with -bg/-text/
 *  -border) for toast surface colors; mapped here to the app's existing
 *  popover/border/destructive tokens (which ThemeProvider keeps in sync
 *  with the tenant's configured theme) instead of Tailwind dark: overrides,
 *  same reasoning as every other components/ui wrapper in this codebase.
 *  `theme` still needs the resolved light/dark mode directly — it's what
 *  picks the gray-scale/description-text fallbacks sonner's own CSS uses
 *  outside the vars overridden below. */
export function Toaster({ ...props }: ToasterProps) {
  const { resolvedMode } = useThemeMode()
  return (
    <SonnerToaster
      theme={resolvedMode}
      richColors
      closeButton
      style={{
        '--normal-bg': 'hsl(var(--popover))',
        '--normal-text': 'hsl(var(--popover-foreground))',
        '--normal-border': 'hsl(var(--border))',
        '--success-bg': 'hsl(var(--popover))',
        '--success-text': 'hsl(142 71% 35%)',
        '--success-border': 'hsl(142 71% 35%)',
        '--error-bg': 'hsl(var(--popover))',
        '--error-text': 'hsl(var(--destructive))',
        '--error-border': 'hsl(var(--destructive))',
        '--warning-bg': 'hsl(var(--popover))',
        '--warning-text': 'hsl(38 92% 40%)',
        '--warning-border': 'hsl(38 92% 40%)',
        '--info-bg': 'hsl(var(--popover))',
        '--info-text': 'hsl(var(--popover-foreground))',
        '--info-border': 'hsl(var(--border))',
      } as React.CSSProperties}
      {...props}
    />
  )
}
