import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// Every top-level path segment the BUILDER's router.tsx actually owns (Home
// '/', /applications/$appId/{workflows,forms,design,settings,executions},
// /knowledge-bases, /team, /dev, /test, /login) — anything else 2-3 segments
// deep is assumed to be a runtime URL (/{clientId}/{appId}[/{menuSlug}]).
// This list must be kept in sync with router.tsx's top-level routes; a
// missing entry here would silently misroute that builder page to the
// runtime bundle in dev only (confirmed by hand: this exact bug happened
// with /applications/{appId} before this list existed — the original
// version only excluded '/api', '/@', '/node_modules', and dotted asset
// paths, which doesn't cover builder routes with a param segment like
// /applications/{appId} at all).
const BUILDER_ROUTE_PREFIXES = [
  'workflows', 'executions', 'forms', 'applications', 'knowledge-bases',
  'team', 'portal', 'accept-invite', 'dev', 'test', 'login',
]

// Vite's dev server only auto-falls-back to index.html for unmatched paths
// (its built-in SPA middleware doesn't know about a second entry) — a
// direct hit on /{clientId}/{appId}/{menuSlug} in dev would otherwise 404
// or, worse, silently resolve to the BUILDER's index.html and show ITS
// router's 404 page. This middleware runs before Vite's own SPA fallback
// and rewrites any 2-3 segment path that ISN'T a known builder route to
// serve runtime.html instead. Production hosting needs the equivalent rule
// at the web-server/CDN layer (route /{clientId}/{appId}/* to runtime.html,
// everything else to index.html) — this only covers `npm run dev`.
//
// 4-5 segments deep, with a literal "forms" third segment, is ALSO a
// runtime URL: /{clientId}/{appId}/forms/{formId}/{recordId}
// (runtime-router.tsx's runtimeFormRecordRoute — the reference-field
// detail-link target, reachable regardless of whether a Search menu points
// at that form). This is intentionally checked as its own separate case
// rather than folded into looksLikeRuntimePath's segment-count range,
// since a bare "widen the range to 2-5" would also start swallowing any
// future *builder* route that happens to be 4-5 segments deep (e.g. a
// hypothetical /applications/{appId}/forms/{formId}/{x}/{y}) — segments[0]
// (the BUILDER_ROUTE_PREFIXES check) can't distinguish those from a runtime
// URL the way this shape-specific check can, since a runtime URL's first
// segment is a client/app UUID, never one of BUILDER_ROUTE_PREFIXES.
function runtimeDevFallback(): Plugin {
  return {
    name: 'runtime-dev-fallback',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url?.split('?')[0] ?? ''
        const segments = url.split('/').filter(Boolean)
        const isExcluded =
          url.startsWith('/api') ||
          url.startsWith('/@') ||
          url.startsWith('/node_modules') ||
          url.includes('.') ||
          BUILDER_ROUTE_PREFIXES.includes(segments[0])
        const looksLikeRuntimePath =
          !isExcluded &&
          ((segments.length === 2 || segments.length === 3) ||
            (segments.length === 5 && segments[2] === 'forms'))
        if (looksLikeRuntimePath) {
          req.url = '/runtime.html'
        }
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), runtimeDevFallback()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  define: {
    // react-draggable (react-grid-layout's drag/resize engine — see
    // features/dashboard/canvas/GridCanvas.tsx) unconditionally reads
    // process.env.DRAGGABLE_DEBUG at the top of every drag-start/drag/
    // drag-stop handler, assuming a Node-like environment. Vite's browser
    // bundle has no `process` global, so every drag or resize attempt threw
    // "ReferenceError: process is not defined" inside that handler before it
    // could do anything else — drag-and-drop and resize looked like they
    // silently did nothing. This is a compile-time text substitution (not a
    // runtime `process` polyfill), so it costs nothing and only satisfies
    // this one property access.
    'process.env.DRAGGABLE_DEBUG': JSON.stringify(false),
  },
  server: {
    // Honor a PORT override (e.g. from the preview tooling) but default to 5173
    // for a plain `npm run dev`.
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8090',
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    // Two entry points: index.html (the authenticated admin builder tool)
    // and runtime.html (the public runtime for published apps).
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        runtime: path.resolve(__dirname, 'runtime.html'),
      },
    },
  },
})
