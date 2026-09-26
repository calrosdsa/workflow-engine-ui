import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { runtimeRouter } from './runtime-router'
import './index.css'
// Runtime-only: the default typefaces and the "printed form" layer (DESIGN.md
// § Runtime default theme). Never imported by the builder bundle.
import '@fontsource-variable/atkinson-hyperlegible-next/wght.css'
import '@fontsource-variable/atkinson-hyperlegible-mono/wght.css'
import './features/runtime/runtime.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

createRoot(document.getElementById('runtime-root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={runtimeRouter} />
    </QueryClientProvider>
  </StrictMode>,
)
