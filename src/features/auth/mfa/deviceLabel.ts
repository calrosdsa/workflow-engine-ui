/** Turns the User-Agent the engine stores for a trusted device into something a
 *  person recognises ("Chrome on Windows"), in their own language. The engine
 *  keeps the raw value on purpose, and devices trusted before this existed were
 *  stored cut at 120 characters -- so this is written for truncated input too.
 *  Display only: nothing here is used to decide anything. */

export interface DeviceParts {
  browser: string | null
  os: string | null
}

// Order matters: Chromium-based browsers also say "Chrome/" (and Chrome also
// says "Safari/"), so the more specific names are checked first.
const BROWSERS: [RegExp, string][] = [
  [/\bEdg(A|iOS)?\//, 'Edge'],
  [/\b(OPR|Opera)\//, 'Opera'],
  [/\bSamsungBrowser\//, 'Samsung Internet'],
  [/\b(Firefox|FxiOS)\//, 'Firefox'],
  [/\bCriOS\//, 'Chrome'],
  [/\bChrome\//, 'Chrome'],
]

// iOS User-Agents say "like Mac OS X", and Android ones say "Linux", so the
// phones and tablets are checked before the desktops.
const SYSTEMS: [RegExp, string][] = [
  [/\biPhone\b/, 'iPhone'],
  [/\biPad\b/, 'iPad'],
  [/\bAndroid\b/, 'Android'],
  [/\bWindows\b/, 'Windows'],
  [/\bCrOS\b/, 'ChromeOS'],
  [/\b(Macintosh|Mac OS X)\b/, 'macOS'],
  [/\bLinux\b/, 'Linux'],
]

export function parseUserAgent(ua: string): DeviceParts {
  let browser = BROWSERS.find(([pattern]) => pattern.test(ua))?.[1] ?? null
  // Safari names itself only by "Version/x ... Safari/y", and the "Safari/"
  // part is exactly what a 120-character cut tends to lose.
  if (!browser && /\bVersion\//.test(ua) && /\bAppleWebKit\//.test(ua)) browser = 'Safari'
  const os = SYSTEMS.find(([pattern]) => pattern.test(ua))?.[1] ?? null
  return { browser, os }
}

type Translate = (key: string, vars?: Record<string, string | number>) => string

export function describeDevice(label: string, t: Translate): string {
  const { browser, os } = parseUserAgent(label)
  if (browser && os) return t('mfa.device_browser_on_os', { browser, os })
  if (browser) return browser
  if (os) return t('mfa.device_os_only', { os })
  return t('mfa.device_unknown')
}
