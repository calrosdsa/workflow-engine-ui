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
  const match = bgHslTriplet.trim().match(/^(-?[\d.]+)\s+(-?[\d.]+)%\s+(-?[\d.]+)%$/)
  if (!match) return '0 0% 100%'
  const [, h, s, l] = match
  const darkFg = '222.2 84% 4.9%'
  const lightFg = '210 40% 98%'

  const bgLuminance = relativeLuminance(hslToRgbTriplet(Number(h), Number(s), Number(l)))
  const darkFgLuminance = relativeLuminance(hslToRgbTriplet(222.2, 84, 4.9))
  const lightFgLuminance = relativeLuminance(hslToRgbTriplet(210, 40, 98))

  const contrastWithDark = contrastRatio(bgLuminance, darkFgLuminance)
  const contrastWithLight = contrastRatio(bgLuminance, lightFgLuminance)

  return contrastWithDark >= contrastWithLight ? darkFg : lightFg
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
