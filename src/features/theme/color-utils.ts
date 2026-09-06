// Conversions between the theme editor's hex/picker-friendly values and this
// codebase's CSS variable format — an HSL triplet WITHOUT the hsl() wrapper
// (e.g. "221.2 83.2% 53.3%"), so it can be interpolated as `hsl(var(--x))`
// in index.css exactly like the existing hardcoded values.

/** "#3b82f6" -> "217.2 91.2% 60%" */
export function hexToHslTriplet(hex: string): string {
  const { h, s, l } = hexToHsl(hex)
  return `${round1(h)} ${round1(s)}% ${round1(l)}%`
}

/** "217.2 91.2% 60%" -> "#3b82f6" */
export function hslTripletToHex(triplet: string): string {
  const match = triplet.trim().match(/^(-?[\d.]+)\s+(-?[\d.]+)%\s+(-?[\d.]+)%$/)
  if (!match) return '#000000'
  const [, h, s, l] = match
  return hslToHex(Number(h), Number(s), Number(l))
}

/** Picks near-white or near-black foreground text for a given background HSL
 *  triplet, using WCAG relative luminance — drives derived --*-foreground
 *  variables so the theme editor doesn't need 10 separate color pickers.
 *
 *  A raw lightness-percentage cutoff (e.g. "l > 60 -> dark text") looks
 *  reasonable but is wrong for saturated colors: a fully-saturated blue at
 *  L=59.8% (this codebase's own dark-mode --primary, 217.2 91.2% 59.8%)
 *  contrasts white text at only ~3.5:1 (fails WCAG AA's 4.5:1 body-text
 *  floor) while dark text on the same background hits ~5.4:1 — saturation
 *  suppresses perceived luminance in a way the L channel alone can't
 *  capture. Comparing actual relative luminance against both foreground
 *  candidates and picking whichever contrasts more gets both hue families
 *  right instead of just desaturated ones. */
export function pickForeground(bgHslTriplet: string): string {
  const parsed = parseHslTriplet(bgHslTriplet)
  if (!parsed) return '0 0% 100%'
  const darkFg = '222.2 84% 4.9%'
  const lightFg = '210 40% 98%'

  const bgLuminance = relativeLuminance(hslToRgbTriplet(parsed.h, parsed.s, parsed.l))
  const darkFgLuminance = relativeLuminance(hslToRgbTriplet(222.2, 84, 4.9))
  const lightFgLuminance = relativeLuminance(hslToRgbTriplet(210, 40, 98))

  const contrastWithDark = contrastRatio(bgLuminance, darkFgLuminance)
  const contrastWithLight = contrastRatio(bgLuminance, lightFgLuminance)

  return contrastWithDark >= contrastWithLight ? darkFg : lightFg
}

/** Low-alpha tint of a foreground color, meant to sit over its matching
 *  background — the same "achromatic foreground at N% alpha" shape already
 *  hand-picked for index.css's static palettes (e.g. --border: 0 0% 100% /
 *  10% on dark's near-white foreground, 0 0% 0% / 10% on light's near-black
 *  one). Drives --border/--input (10%) and --muted (5%) from whatever
 *  pickForeground() already picked for --foreground, so it generalizes to
 *  any tenant background instead of only the two hand-authored palettes. */
export function deriveOverlay(fgHslTriplet: string, alphaPercent: number): string {
  return `${fgHslTriplet} / ${alphaPercent}%`
}

/** Derives a legible "muted" text color for a given background: blended
 *  from the picked foreground color toward the background — same
 *  relationship the static palettes hand-picked (e.g. :root's foreground is
 *  97% lightness, background 8%, muted-foreground sits at 71%) — but
 *  contrast-VERIFIED per background instead of a fixed blend ratio, since a
 *  tenant background's saturation/hue can shift how much a fixed ratio
 *  actually contrasts (see pickForeground's own doc comment on why raw
 *  lightness math misleads for saturated colors).
 *
 *  Walks from mostly-background (most subtle) toward full foreground and
 *  returns the first blend whose contrast against the background clears
 *  WCAG AA's 4.5:1 body-text floor. This always terminates: at full
 *  strength the blend IS pickForeground's own return value, and picking
 *  whichever of near-black/near-white contrasts more against a background
 *  can never fall below ~4.58:1 (the two candidates' worst-case crossover),
 *  so the loop's fallback return is unreachable in practice and kept only
 *  as a defensive mirror of pickForeground's own malformed-input fallback.
 *
 *  For a background near that ~4.58:1 crossover (a saturated color whose
 *  BEST foreground choice is only barely legible to begin with — see
 *  pickForeground's own doc comment on saturation suppressing perceived
 *  luminance), there may be no blend below full strength that still clears
 *  4.5:1, so this deliberately returns the same value as pickForeground:
 *  muted text identical to body text is the correct outcome when the
 *  background leaves no contrast headroom for a second, subtler tier —
 *  not a bug in the search. */
export function deriveMutedForeground(bgHslTriplet: string, fgHslTriplet: string): string {
  const bg = parseHslTriplet(bgHslTriplet)
  const fg = parseHslTriplet(fgHslTriplet)
  if (!bg || !fg) return fgHslTriplet

  const bgRgb = hslToRgbTriplet(bg.h, bg.s, bg.l)
  const fgRgb = hslToRgbTriplet(fg.h, fg.s, fg.l)
  const bgLuminance = relativeLuminance(bgRgb)

  const TARGET_CONTRAST = 4.5
  const STEPS = 20
  for (let i = 1; i <= STEPS; i++) {
    const t = i / STEPS // 0 = pure background (most subtle), 1 = pure foreground
    const blended: [number, number, number] = [
      bgRgb[0] + (fgRgb[0] - bgRgb[0]) * t,
      bgRgb[1] + (fgRgb[1] - bgRgb[1]) * t,
      bgRgb[2] + (fgRgb[2] - bgRgb[2]) * t,
    ]
    if (contrastRatio(bgLuminance, relativeLuminance(blended)) >= TARGET_CONTRAST) {
      return rgbToHslTriplet(blended)
    }
  }
  return fgHslTriplet
}

function hslToRgbTriplet(h: number, s: number, l: number): [number, number, number] {
  const sNorm = s / 100
  const lNorm = l / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = sNorm * Math.min(lNorm, 1 - lNorm)
  const f = (n: number) => lNorm - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)]
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function contrastRatio(l1: number, l2: number): number {
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]
  return (hi + 0.05) / (lo + 0.05)
}

/** "217.2 91.2% 60%" -> { h: 217.2, s: 91.2, l: 60 }, shared by every
 *  function that reads an existing CSS-variable-format triplet (as opposed
 *  to hexToHsl, which reads a theme-editor hex value instead). */
function parseHslTriplet(triplet: string): { h: number; s: number; l: number } | null {
  const match = triplet.trim().match(/^(-?[\d.]+)\s+(-?[\d.]+)%\s+(-?[\d.]+)%$/)
  if (!match) return null
  const [, h, s, l] = match
  return { h: Number(h), s: Number(s), l: Number(l) }
}

/** [255, 128, 0] -> "30 100% 50%" — the inverse of hslToRgbTriplet, for
 *  turning a blended/computed RGB color back into this codebase's CSS
 *  variable format. */
function rgbToHslTriplet([r, g, b]: [number, number, number]): string {
  const { h, s, l } = rgbNormToHsl(r / 255, g / 255, b / 255)
  return `${round1(h)} ${round1(s)}% ${round1(l)}%`
}

// ---------------------------------------------------------------------------
// internal
// ---------------------------------------------------------------------------

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16) / 255
  const g = parseInt(clean.slice(2, 4), 16) / 255
  const b = parseInt(clean.slice(4, 6), 16) / 255
  return rgbNormToHsl(r, g, b)
}

/** Shared by hexToHsl and rgbToHslTriplet — takes 0-1 normalized RGB
 *  (hexToHsl's own scale) rather than 0-255, so hexToHsl can pass its
 *  already-normalized channels straight through. */
function rgbNormToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)); break
      case g: h = (b - r) / d + 2; break
      case b: h = (r - g) / d + 4; break
    }
    h *= 60
  }

  return { h, s: s * 100, l: l * 100 }
}

function hslToHex(h: number, s: number, l: number): string {
  const sNorm = s / 100
  const lNorm = l / 100
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = lNorm - c / 2
  let r = 0, g = 0, b = 0

  if (h < 60)       { r = c; g = x; b = 0 }
  else if (h < 120) { r = x; g = c; b = 0 }
  else if (h < 180) { r = 0; g = c; b = x }
  else if (h < 240) { r = 0; g = x; b = c }
  else if (h < 300) { r = x; g = 0; b = c }
  else              { r = c; g = 0; b = x }

  const toHex = (v: number) => {
    const hex = Math.round((v + m) * 255).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}
