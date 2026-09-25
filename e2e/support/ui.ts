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
 * Known, not-yet-fixed rules go in KNOWN_VIOLATIONS with a reason, never by
 * disabling axe.
 */
const KNOWN_VIOLATIONS: Record<string, string> = {}

export async function expectAccessible(page: Page, context: string) {
  // Measure the settled page: axe reads a toast still fading in as low
  // contrast. Endless animations (spinners) never settle, so they don't count.
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity),
  )
  const results = await new AxeBuilder({ page }).disableRules(Object.keys(KNOWN_VIOLATIONS)).analyze()
  const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
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
