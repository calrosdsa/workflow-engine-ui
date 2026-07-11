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
 *  triplet, using relative luminance — drives derived --*-foreground
 *  variables so the theme editor doesn't need 10 separate color pickers. */
export function pickForeground(bgHslTriplet: string): string {
  const match = bgHslTriplet.trim().match(/^(-?[\d.]+)\s+(-?[\d.]+)%\s+(-?[\d.]+)%$/)
  if (!match) return '0 0% 100%'
  const [, , , l] = match
  return Number(l) > 60 ? '222.2 84% 4.9%' : '210 40% 98%'
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
