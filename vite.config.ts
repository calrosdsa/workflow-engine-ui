import { defineConfig, type Connect, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { cspMetaTag } from './src/lib/csp.js'
import { isRuntimePath } from './src/lib/runtime-paths.js'

// Every top-level path segment the BUILDER's router.tsx actually owns (Home
// '/', /applications/$appId/{workflows,forms,design,settings,executions},
// /knowledge-bases, /team, /dev, /test, /login, /account/security) — anything
// else 2-3 segments deep is assumed to be a runtime URL
// (/{clientId}/{appId}[/{menuSlug}]). This list must be kept in sync with
// router.tsx's top-level routes and nginx.conf's copy of it; a missing entry
// misroutes that builder page to the runtime bundle whenever it is loaded
// directly (confirmed by hand: this exact bug happened with /applications/
// {appId} before this list existed, and again with /account/security, which
// then asked the engine for client "account", app "security").
// src/router-hosting.test.ts now pins all three together.
const BUILDER_ROUTE_PREFIXES = [
  'workflows', 'executions', 'forms', 'applications', 'knowledge-bases',
  'team', 'portal', 'accept-invite', 'dev', 'test', 'login', 'account',
]

// Vite's servers only fall back to index.html for unmatched paths (the SPA
// middleware doesn't know about a second entry), so a direct load of a
// runtime URL would show the BUILDER's 404 page. This middleware runs first
// and serves runtime.html for every path isRuntimePath accepts
// (src/lib/runtime-paths.ts lists the shapes). Production hosting needs the
// same rule at the web-server layer: nginx.conf's runtime locations.
// src/router-hosting.test.ts checks every runtime route against both.
const serveRuntimeHtml: Connect.NextHandleFunction = (req, _res, next) => {
  if (isRuntimePath(req.url ?? '', BUILDER_ROUTE_PREFIXES)) {
    req.url = '/runtime.html'
  }
  next()
}

// Also on `vite preview`, which the mocked browser suite (e2e/mock) serves
// the production build with, so a direct load of a runtime URL works there
// the same way.
function runtimeDevFallback(): Plugin {
  return {
    name: 'runtime-dev-fallback',
    configureServer(server) {
      server.middlewares.use(serveRuntimeHtml)
    },
    configurePreviewServer(server) {
      server.middlewares.use(serveRuntimeHtml)
    },
  }
}


// Injects the app's Content-Security-Policy into BOTH entry documents
// (index.html and runtime.html) as the first thing in <head> — a meta CSP
// governs only what follows it, so position is load-bearing.
//
// A plugin rather than a literal <meta> in each .html file for two reasons:
// the policy differs between dev and production (Vite's dev transform needs
// 'unsafe-eval', HMR needs ws:), and duplicating it across two documents is
// exactly how they drift. See src/lib/csp.ts for what the policy does and
// does not cover.
function contentSecurityPolicy(): Plugin {
  return {
    name: 'app-content-security-policy',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        // ctx.server is the reliable dev signal: it is set only by the
        // dev server. ctx.bundle is NOT populated at order:'pre' during a
        // build, so keying on it silently shipped the dev policy —
        // 'unsafe-eval' and plain http:/ws: — into production output.
        const tag = cspMetaTag({ dev: !!ctx.server })
        return html.replace(/<head>/i, `<head>
    ${tag}`)
      },
    },
  }
}

export default defineConfig({
  plugins: [contentSecurityPolicy(), react(), tailwindcss(), runtimeDevFallback()],
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
    // Dev-server-only responsiveness, no effect on the production build.
    // Vite serves source as unbundled ES modules, so the first navigation
    // to a route each dev session pays for transforming its import graph
    // on demand. Pre-transforming these two heaviest, most-visited feature
    // trees at server startup (off the request path) shrinks that on-demand
    // fetch/transform window. It does NOT close the full gap to production
    // (measured ~600-850ms here vs ~200ms for the equivalent already-bundled
    // production chunk, see router.tsx's lazyRouteComponent commit) — most
    // of the remainder is React's dev-mode build itself (unminified,
    // StrictMode double-invoke, extra runtime checks), which is inherent to
    // `npm run dev` and isn't something to trade away for local speed.
    // Add another glob here if a different page's first visit feels slow.
    warmup: {
      clientFiles: [
        './src/pages/FormsPage.tsx',
        './src/pages/forms/FormBuilderPage.tsx',
        './src/features/forms/**/*.tsx',
        './src/features/form-builder/**/*.tsx',
      ],
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
