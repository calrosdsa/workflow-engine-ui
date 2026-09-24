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
