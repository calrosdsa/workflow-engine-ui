import { describe, it, expect } from 'vitest'
import { pickForeground, deriveMutedForeground, deriveOverlay, ensureContrast } from './color-utils'

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

// Channels (0-1) of an HSL triplet, for blending two colours the way a
// translucent tint over a background renders.
function rgbOf(hslTriplet: string): [number, number, number] {
  const match = hslTriplet.trim().match(/^(-?[\d.]+)\s+(-?[\d.]+)%\s+(-?[\d.]+)%$/)!
  const [h, s, l] = [Number(match[1]), Number(match[2]) / 100, Number(match[3]) / 100]
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0), f(8), f(4)]
}

function luminanceOfRgb([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

// Contrast of a colour against its own tint (alpha over bg), as a status
// badge draws it: text in the colour on a 15% wash of the same colour.
function contrastOnOwnTint(color: string, bg: string, alpha: number): number {
  const c = rgbOf(color)
  const b = rgbOf(bg)
  const tint = c.map((v, i) => v * alpha + b[i] * (1 - alpha)) as [number, number, number]
  const [l1, l2] = [luminanceOfRgb(c), luminanceOfRgb(tint)]
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]
  return (hi + 0.05) / (lo + 0.05)
}

describe('ensureContrast', () => {
  // Tenant primaries chosen to break a naive "use the primary as text"
  // rule: too pale, too close to white, too close to black, and a
  // saturated red whose perceived luminance the L channel misreports.
  const HOSTILE_PRIMARIES = {
    paleYellow: '54 96% 72%',
    nearWhite: '60 20% 96%',
    nearBlack: '220 30% 6%',
    saturatedRed: '0 100% 50%',
    runtimeDefault: '172 70% 25%',
  }
  const MODES = {
    light: { background: '160 8% 95.5%', surface: '150 12% 99.5%' },
    dark: { background: '170 10% 7%', surface: '168 8% 10.5%' },
  }

  for (const [mode, { background, surface }] of Object.entries(MODES)) {
    const foreground = pickForeground(background)
    for (const [name, primary] of Object.entries(HOSTILE_PRIMARIES)) {
      it(`clears the target on both surfaces for ${name} in ${mode} mode`, () => {
        const ink = ensureContrast(primary, [background, surface], foreground, 4.8)
        expect(contrast(ink, background)).toBeGreaterThanOrEqual(4.8)
        expect(contrast(ink, surface)).toBeGreaterThanOrEqual(4.8)
      })
    }
  }

  it('returns the colour unchanged when it already clears the target', () => {
    expect(ensureContrast('172 70% 25%', ['150 12% 99.5%'], '222.2 84% 4.9%', 4.5)).toBe('172 70% 25%')
  })

  it('also clears the target on its own tint when asked, as a status badge draws it', () => {
    const bg = '160 8% 95.5%'
    // A green that passes on the plain background but not on its own 15% wash.
    const green = ensureContrast('154 70% 26%', [bg], pickForeground(bg), 4.5, { tintAlpha: 0.15 })
    expect(contrast(green, bg)).toBeGreaterThanOrEqual(4.5)
    expect(contrastOnOwnTint(green, bg, 0.15)).toBeGreaterThanOrEqual(4.5)
  })

  it('falls back to the target colour for malformed input', () => {
    expect(ensureContrast('not a colour', ['0 0% 100%'], '222.2 84% 4.9%', 4.5)).toBe('222.2 84% 4.9%')
  })
})
