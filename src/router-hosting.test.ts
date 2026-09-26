// Loading /account/security directly (a refresh, a bookmark, a pasted link)
// served the published-app runtime instead of the builder: the dev server and
// nginx both send any 2-3 segment path whose first segment is not a known
// builder route to runtime.html, and "account" was missing from that list. The
// runtime then asked the engine for client "account", app "security", and hung
// on "Loading…". The list lives twice -- vite.config.ts for `npm run dev`,
// nginx.conf for the image staging serves -- and has to cover router.tsx's
// top-level routes. These pin the three together.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isRuntimePath } from './lib/runtime-paths'

const read = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')

// Paths of the routes hung directly off the root or the builder shell. Split per
// createRoute call rather than matching one exact layout, so the order of the
// options inside a route does not matter.
function topLevelRoutePaths(): string[] {
  return read('./router.tsx')
    .split('createRoute(')
    .slice(1)
    .flatMap((route) => {
      if (!/getParentRoute:\s*\(\)\s*=>\s*(rootRoute|shellRoute)\b/.test(route)) return []
      const path = route.match(/\bpath:\s*'([^']+)'/)?.[1]
      return path ? [path] : []
    })
}

function devServerPrefixes(): string[] {
  const list = read('../vite.config.ts').match(/const BUILDER_ROUTE_PREFIXES = \[([^\]]*)\]/)?.[1] ?? ''
  return [...list.matchAll(/'([^']+)'/g)].map((m) => m[1])
}

function nginxPrefixes(): string[] {
  const alternation = read('../nginx.conf').match(/location ~ \^\/\(([^)]+)\)\(\/\|\$\)/)?.[1] ?? ''
  return alternation.split('|').filter(Boolean)
}

describe('builder routes and the runtime fallback', () => {
  const routes = topLevelRoutePaths()

  it('finds what it compares', () => {
    // A formatting change should fail here, not leave the checks below with
    // nothing to check.
    expect(routes.length).toBeGreaterThanOrEqual(10)
    expect(routes).toContain('/account/security')
    expect(devServerPrefixes()).toContain('login')
    expect(nginxPrefixes()).toContain('login')
  })

  it('names every builder route that could pass for a runtime URL, in both places', () => {
    const firstSegments = new Set(
      routes.map((path) => path.split('/').filter(Boolean)).filter((s) => s.length >= 2).map((s) => s[0]),
    )
    for (const segment of firstSegments) {
      expect(devServerPrefixes(), `vite.config.ts BUILDER_ROUTE_PREFIXES lacks '${segment}'`).toContain(segment)
      expect(nginxPrefixes(), `nginx.conf's builder location lacks '${segment}'`).toContain(segment)
    }
  })

  it('keeps the dev server and nginx lists identical', () => {
    expect([...nginxPrefixes()].sort()).toEqual([...devServerPrefixes()].sort())
  })
})

// Runtime pages hit directly: a record opened from a menu lives at
// /{client}/{app}/{menu}/{record}, which both hosts once sent to the builder,
// so a reload of it showed the builder's 404. Each runtime route below is
// turned into a sample URL and must reach runtime.html in both places, and
// builder routes must not.

// Every route under the runtime app, as a full path ('/$clientId/$appId/...').
function runtimeRoutePaths(): string[] {
  const routes = read('./runtime-router.tsx').split('createRoute(').slice(1)
  const appPath = routes
    .find((r) => /getParentRoute:\s*\(\)\s*=>\s*runtimeRootRoute\b/.test(r) && /\bpath:\s*'\/\$clientId/.test(r))
    ?.match(/\bpath:\s*'([^']+)'/)?.[1]
  if (!appPath) return []
  return routes.flatMap((route) => {
    if (!/getParentRoute:\s*\(\)\s*=>\s*runtimeAppRoute\b/.test(route)) return []
    const path = route.match(/\bpath:\s*'([^']+)'/)?.[1]
    return path ? [path === '/' ? appPath : appPath + path] : []
  })
}

// '/$clientId/$appId/$menuSlug' -> '/clientId-1/appId-1/menuSlug-1'
const sampleOf = (path: string) => path.replace(/\$([A-Za-z]+)/g, (_, name: string) => `${name}-1`)

type Served = 'runtime' | 'builder'

// nginx's choice for a path: regex locations in file order, first match wins,
// then the `location /` fallback (index.html). The exact `location =` blocks
// only name the two HTML files themselves, which no sample is.
function nginxServes(path: string): Served {
  for (const [, regex, body] of read('../nginx.conf').matchAll(/location ~ (\S+) \{([^}]*)\}/g)) {
    if (new RegExp(regex).test(path)) return /\/runtime\.html;/.test(body) ? 'runtime' : 'builder'
  }
  return 'builder'
}

const viteServes = (path: string): Served => (isRuntimePath(path, devServerPrefixes()) ? 'runtime' : 'builder')

describe('direct loads reach the right app', () => {
  const runtime = runtimeRoutePaths().map(sampleOf)

  it('keeps nginx location patterns loadable', () => {
    // An unquoted { in a location regex ({0,2}) is read as a block opener:
    // nginx refuses the whole file and the container never starts.
    for (const [, regex] of read('../nginx.conf').matchAll(/location ~ (\S+) \{/g)) {
      expect(regex, 'quote the pattern or drop the {m,n} quantifier').not.toMatch(/[{}]/)
    }
  })

  it('finds the runtime routes', () => {
    expect(runtime).toContain('/clientId-1/appId-1/menuSlug-1/recordId-1')
    expect(runtime).toContain('/clientId-1/appId-1/forms/formId-1/recordId-1')
    expect(runtime.length).toBeGreaterThanOrEqual(6)
  })

  it.each(runtimeRoutePaths().map(sampleOf))('%s is served by the runtime', (path) => {
    expect(nginxServes(path), 'nginx.conf').toBe('runtime')
    expect(viteServes(path), 'vite (src/lib/runtime-paths.ts)').toBe('runtime')
  })

  const builder = [
    ...topLevelRoutePaths().map(sampleOf),
    '/applications/appId-1/forms/formId-1',
    '/applications/appId-1/forms/formId-1/records',
    '/applications/appId-1/workflows/workflowId-1/evaluations/datasetId-1',
  ]
  it.each(builder)('%s is served by the builder', (path) => {
    expect(nginxServes(path), 'nginx.conf').toBe('builder')
    expect(viteServes(path), 'vite (src/lib/runtime-paths.ts)').toBe('builder')
  })
})
