import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/** The stored locale wins over the browser's, so pin both apps' keys. */
export async function pinEnglish(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('system-locale', 'en')
    localStorage.setItem('app-locale', 'en')
  })
}

/**
 * Fails on serious or critical accessibility violations on the current page.
 * A known problem that can't be fixed yet goes in KNOWN_VIOLATIONS: one rule,
 * the elements it applies to, and why. Never a whole rule, which would hide
 * every other element it catches.
 */
interface KnownViolation {
  rule: string
  /** Matched against the offending element's full opening tag. */
  element: RegExp
  reason: string
}

const KNOWN_VIOLATIONS: KnownViolation[] = [
  {
    rule: 'color-contrast',
    element: /bg-\[hsl\(var\(--destructive\)\)\] text-\[hsl\(var\(--destructive-foreground\)\)\]/,
    reason:
      'Filled destructive buttons: --destructive-foreground on --destructive measures 3.9:1 in both themes ' +
      '(WCAG AA wants 4.5:1). Darkening --destructive would also darken red text on dark surfaces, so it waits ' +
      'on a palette decision.',
  },
]

// axe shortens the HTML it reports, so read the element's own tag from the page.
async function isKnown(page: Page, rule: string, target: unknown[]): Promise<boolean> {
  const candidates = KNOWN_VIOLATIONS.filter((k) => k.rule === rule)
  if (!candidates.length || target.length !== 1 || typeof target[0] !== 'string') return false
  const tag = await page.evaluate((selector) => {
    const el = document.querySelector(selector)
    return el ? el.outerHTML.slice(0, el.outerHTML.indexOf('>') + 1) : ''
  }, target[0])
  return candidates.some((k) => k.element.test(tag))
}

export async function expectAccessible(page: Page, context: string) {
  // Measure the settled page: axe reads a toast still fading in as low
  // contrast. Endless animations (spinners) never settle, so they don't count.
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity),
  )
  const results = await new AxeBuilder({ page }).analyze()
  const blocking = []
  for (const v of results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')) {
    const nodes = []
    for (const n of v.nodes) if (!(await isKnown(page, v.id, n.target))) nodes.push(n)
    if (nodes.length) blocking.push({ ...v, nodes })
  }
  if (blocking.length) {
    // The offending elements and axe's fix hints, for the report.
    const detail = blocking.map((v) => ({
      rule: v.id, impact: v.impact, help: v.help, helpUrl: v.helpUrl,
      nodes: v.nodes.map((n) => ({ target: n.target, html: n.html, fix: n.failureSummary })),
    }))
    await test.info().attach(`accessibility: ${context}`, { body: JSON.stringify(detail, null, 2), contentType: 'application/json' })
  }
  const serious = blocking.map((v) => `${v.impact} ${v.id}: ${v.help} (${v.nodes.length}x, e.g. ${v.nodes[0]?.target.join(' ')})`)
  // Soft: the test's own steps still run, and it still fails at the end.
  expect.soft(serious, `accessibility violations on ${context}`).toEqual([])
}
