import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster } from 'sonner'
import { UiWorkflowDialogHost } from '@/features/ui-workflows/UiWorkflowDialogHost'
import { UiWorkflowFormHost } from '@/features/ui-workflows/UiWorkflowFormHost'
import { router } from './router'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      {/* The builder shell's own toast host — a plain sonner Toaster, not
          components/ui/sonner.tsx's wrapper, since that one calls
          useThemeMode() and requires a ThemeProvider ancestor (the runtime's
          per-app-theme system, unrelated to the shell's own light/dark
          switch in features/theme/useBuilderTheme.ts). Reads the same
          index.css tokens the switch flips via .light on <html>, so no
          separate light/dark handling is needed here. */}
      <Toaster
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
        } as React.CSSProperties}
      />
      {/* Mounted beside the Toaster for the same reason: both are app-level
          overlays driven by a module-level call from outside the component
          tree. Needed in the BUILDER too, not only the runtime — a form
          preview runs the form's real field-change workflow, and a step in
          it can ask the viewer something. */}
      <UiWorkflowDialogHost />
      <UiWorkflowFormHost />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>,
)
