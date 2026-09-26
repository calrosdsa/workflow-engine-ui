// The API the mocked suite runs against: every /api request the page makes
// goes to a handler here, never to a server. A request no handler claims is
// answered 501 and fails the test, so the fixtures can't silently drift
// behind what the UI actually calls.
import { test as base, expect, type Page, type Route } from '@playwright/test'

export interface ApiRequest {
  method: string
  path: string // without the /api prefix, e.g. /forms/f-1
  params: Record<string, string>
  query: URLSearchParams
  body: unknown
}

const REPLY = Symbol('reply')

export interface ApiResponse {
  [REPLY]: true
  status: number
  body?: unknown
  headers?: Record<string, string>
}

/** A response other than 200 JSON. A handler's plain return value is always a 200 body. */
export function reply(status: number, body?: unknown, headers?: Record<string, string>): ApiResponse {
  return { [REPLY]: true, status, body, headers }
}

type Handler = (req: ApiRequest) => ApiResponse | unknown

interface Entry {
  method: string
  pattern: RegExp
  names: string[]
  handler: Handler
}

export class FakeBackend {
  private entries: Entry[] = []
  readonly unhandled: string[] = []
  readonly requests: ApiRequest[] = []

  /**
   * Registers a handler; later registrations win, so a test can override a
   * default. `path` uses :name segments. A handler returns reply(...) for
   * anything but 200, or a plain value served as 200 JSON.
   */
  on(method: string, path: string, handler: Handler) {
    const names: string[] = []
    const source = path.replace(/:([a-zA-Z_]+)/g, (_, name: string) => {
      names.push(name)
      return '([^/]+)'
    })
    this.entries.unshift({ method: method.toUpperCase(), pattern: new RegExp(`^${source}$`), names, handler })
    return this
  }

  async attach(page: Page) {
    await page.route('**/api/**', (route) => this.dispatch(route))
  }

  private async dispatch(route: Route) {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.replace(/^\/api/, '') || '/'
    const method = request.method()
    let body: unknown
    try {
      body = request.postDataJSON()
    } catch {
      body = request.postData()
    }

    for (const entry of this.entries) {
      if (entry.method !== method) continue
      const match = entry.pattern.exec(path)
      if (!match) continue
      const params = Object.fromEntries(entry.names.map((n, i) => [n, decodeURIComponent(match[i + 1])]))
      const req: ApiRequest = { method, path, params, query: url.searchParams, body }
      this.requests.push(req)
      const out = entry.handler(req)
      const res = isReply(out) ? out : reply(200, out)
      const status = res.status
      return route.fulfill({
        status,
        headers: { 'content-type': 'application/json', ...res.headers },
        body: status === 204 || res.body === undefined ? '' : JSON.stringify(res.body),
      })
    }

    this.unhandled.push(`${method} ${path}${url.search}`)
    return route.fulfill({ status: 501, contentType: 'application/json', body: JSON.stringify({ error: `no fake for ${method} ${path}` }) })
  }
}

function isReply(value: unknown): value is ApiResponse {
  return !!value && typeof value === 'object' && REPLY in value
}

export type Theme = 'dark' | 'light'

/**
 * The suite's `test`: every test gets a strict FakeBackend (attached before
 * the page loads) and the project's theme and English locale in both apps'
 * storage. The light/dark projects are what make one test produce both
 * screenshots.
 */
export const test = base.extend<{ backend: FakeBackend; theme: Theme }>({
  theme: [async ({}, use, info) => use(info.project.name === 'light' ? 'light' : 'dark'), { option: false }],
  backend: async ({ page, theme }, use) => {
    await page.addInitScript((t) => {
      localStorage.setItem('builder-theme', t)
      localStorage.setItem('app-theme-mode', t)
      localStorage.setItem('system-locale', 'en')
      localStorage.setItem('app-locale', 'en')
    }, theme)
    // An uncaught exception in the page fails the test: a blank screen is
    // usually one, and it says why.
    const crashes: string[] = []
    page.on('pageerror', (e) => crashes.push(e.stack ?? e.message))
    const backend = new FakeBackend()
    await backend.attach(page)
    await use(backend)
    expect(backend.unhandled, 'API calls with no fake; add handlers in e2e/mock/world.ts').toEqual([])
    expect(crashes, 'uncaught exceptions in the page').toEqual([])
  },
})

export { expect }
