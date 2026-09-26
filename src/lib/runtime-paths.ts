// Which request paths the published-app runtime (runtime.html) serves rather
// than the builder (index.html). Vite's dev and preview servers use this;
// nginx.conf makes the same decision in its location blocks, and
// src/router-hosting.test.ts checks every route in runtime-router.tsx
// against both, so a direct load (a reload, a bookmark, a new tab) of any
// runtime page reaches the runtime.
//
// A runtime URL starts with a client and an app id, never with one of the
// builder's own top-level segments (builderPrefixes), and has one of these
// shapes:
//   /{clientId}/{appId}                          app home
//   /{clientId}/{appId}/{menuSlug}               a menu (also /login)
//   /{clientId}/{appId}/{menuSlug}/{recordId}    a record opened from a menu
//   /{clientId}/{appId}/forms/{formId}/{recordId|new}
export function isRuntimePath(url: string, builderPrefixes: readonly string[]): boolean {
  const path = url.split('?')[0]
  if (path.startsWith('/api') || path.startsWith('/@') || path.startsWith('/node_modules') || path.includes('.')) {
    return false
  }
  const segments = path.split('/').filter(Boolean)
  if (builderPrefixes.includes(segments[0])) return false
  if (segments.length >= 2 && segments.length <= 4) return true
  return segments.length === 5 && segments[2] === 'forms'
}
