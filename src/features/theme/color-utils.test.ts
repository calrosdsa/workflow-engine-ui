import { describe, it, expect } from 'vitest'
import { pickForeground, deriveMutedForeground, deriveOverlay } from './color-utils'

// WCAG relative luminance / contrast ratio, computed independently of
// color-utils' own (identical, but that's the point) implementation — a
// test that imported color-utils' internals to check color-utils' output
// wouldn't catch a shared mistake in the math itself.
function relativeLuminance(hslTriplet: string): number {
  const match = hslTriplet.trim().match(/^(-?[\d.]+)\s+(-?[\d.]+)%\s+(-?[\d.]+)%$/)!
  const [h, s, l] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const sNorm = s / 100
  const lNorm = l / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = sNorm * Math.min(lNorm, 1 - lNorm)
  const f = (n: number) => lNorm - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  const [r, g, b] = [f(0), f(8), f(4)]
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function contrast(a: string, b: string): number {
  const [l1, l2] = [relativeLuminance(a), relativeLuminance(b)]
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]
  return (hi + 0.05) / (lo + 0.05)
}

// A spread of backgrounds covering this codebase's real static palettes,
// the runtime's own DEFAULT_THEME (light AND dark), and a couple of
// arbitrary/saturated tenant-style colors nothing here was tuned against.
const BACKGROUNDS = {
  builderDark: '240 4% 8%',
  builderLight: '0 0% 100%',
  shadcnDark: '222.2 84% 4.9%',
  defaultThemeLight: '240 25% 99%',
  defaultThemeDark: '240 22% 7%',
  saturatedTenantTeal: '175 100% 37%',
  saturatedTenantMagenta: '320 80% 45%',
  midGray: '0 0% 50%',
}

describe('deriveMutedForeground', () => {
  it('always clears the WCAG AA 4.5:1 body-text floor against its background', () => {
    for (const [name, bg] of Object.entries(BACKGROUNDS)) {
      const fg = pickForeground(bg)
      const muted = deriveMutedForeground(bg, fg)
      expect(contrast(bg, muted), `${name} (bg=${bg})`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('is more subtle than the full foreground for a typical background', () => {
    // The whole point of a distinct muted-foreground token: less contrast
    // than body text, not identical to it.
    const bg = BACKGROUNDS.defaultThemeLight
    const fg = pickForeground(bg)
    const muted = deriveMutedForeground(bg, fg)
    expect(contrast(bg, muted)).toBeLessThan(contrast(bg, fg))
  })

  it('reproduces the reported bug scenario: a light tenant background no longer inherits the dark builder-shell muted-foreground', () => {
    // Before the fix, ThemeProvider never set --muted-foreground at all, so
    // a light-mode runtime app fell through to index.css's :root value
    // (240 2% 71%, tuned for an 8%-lightness dark background) — ~2:1
    // contrast against a 99%-lightness background, illegible per WCAG AA.
    const bg = BACKGROUNDS.defaultThemeLight
    const staleBuilderShellValue = '240 2% 71%'
    const derived = deriveMutedForeground(bg, pickForeground(bg))
    expect(contrast(bg, staleBuilderShellValue)).toBeLessThan(4.5)
    expect(contrast(bg, derived)).toBeGreaterThanOrEqual(4.5)
  })
})

describe('deriveOverlay', () => {
  it('formats as "<fg triplet> / <alpha>%", parseable by hsl()', () => {
    expect(deriveOverlay('222.2 84% 4.9%', 10)).toBe('222.2 84% 4.9% / 10%')
    expect(deriveOverlay('210 40% 98%', 5)).toBe('210 40% 98% / 5%')
  })

  it('picks a dark tint on a light background and a light tint on a dark background', () => {
    const lightBg = BACKGROUNDS.defaultThemeLight
    const darkBg = BACKGROUNDS.defaultThemeDark
    const lightBorder = deriveOverlay(pickForeground(lightBg), 10)
    const darkBorder = deriveOverlay(pickForeground(darkBg), 10)
    // near-black on light, near-white on dark — matches index.css's own
    // hand-picked :root (white/10%) vs .light (black/10%) precedent.
    expect(lightBorder.startsWith('222.2 84% 4.9%')).toBe(true)
    expect(darkBorder.startsWith('210 40% 98%')).toBe(true)
  })
})
