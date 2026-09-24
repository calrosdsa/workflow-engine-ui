// Trusted devices were listed by their raw User-Agent, cut at 120 characters --
// "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like
// Gecko) ... S". These pin what real User-Agents turn into, both whole and cut
// exactly as the engine stored them before it kept the full value, because the
// tokens that tell browsers apart are often the ones a cut loses.
import { describe, expect, it } from 'vitest'
import { en } from '@/features/i18n/locales/en'
import { describeDevice, parseUserAgent } from './deviceLabel'

const cut = (ua: string) => ua.slice(0, 120)

// English dictionary, same interpolation as the app's t().
const t = (key: string, vars: Record<string, string | number> = {}) =>
  (en as Record<string, string>)[key].replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(vars[name]))

const UA = {
  chromeWindows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  // What the builder saw on 09-24: an Electron app, Chromium underneath.
  electronWindows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Claude/2.7032.0 Chrome/152.0.7977.130 Safari/537.36',
  edgeWindows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.2210.91',
  edgeAndroid:
    'Mozilla/5.0 (Linux; Android 13; SM-S918B Build/TP1A.220624.014) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36 EdgA/120.0.2210.126',
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36',
  samsung:
    'Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36',
  safariIPhone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  chromeIPad:
    'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1',
  safariMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  firefoxMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
  firefoxLinux: 'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
  operaWindows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0',
  chromeOS:
    'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}

describe('describeDevice', () => {
  it.each([
    ['Chrome on Windows', UA.chromeWindows],
    ['Chrome on Windows', UA.electronWindows],
    ['Edge on Windows', UA.edgeWindows],
    ['Edge on Android', UA.edgeAndroid],
    ['Chrome on Android', UA.chromeAndroid],
    ['Samsung Internet on Android', UA.samsung],
    ['Safari on iPhone', UA.safariIPhone],
    ['Chrome on iPad', UA.chromeIPad],
    ['Safari on macOS', UA.safariMac],
    ['Firefox on macOS', UA.firefoxMac],
    ['Firefox on Linux', UA.firefoxLinux],
    ['Opera on Windows', UA.operaWindows],
    ['Chrome on ChromeOS', UA.chromeOS],
  ])('names %s from the whole User-Agent', (want, ua) => {
    expect(describeDevice(ua, t)).toBe(want)
  })

  // Devices trusted before the engine kept the whole value were stored cut at
  // 120 characters, and still show up in the list for up to 30 days.
  it.each([
    ['Chrome on Windows', UA.electronWindows],
    ['Safari on iPhone', UA.safariIPhone], // "Safari/" is past the cut; "Version/" is not
    ['Chrome on iPad', UA.chromeIPad],
    ['Firefox on macOS', UA.firefoxMac],
    // The cut takes "EdgA/" with it, which is why the engine now keeps the
    // whole value: all that is left is Chrome.
    ['Chrome on Android', UA.edgeAndroid],
  ])('still names %s from a User-Agent cut at 120 characters', (want, ua) => {
    expect(describeDevice(cut(ua), t)).toBe(want)
  })

  it('falls back to the operating system, then to "Unknown device"', () => {
    expect(describeDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', t)).toBe('Windows device')
    expect(describeDevice('curl/8.4.0', t)).toBe(en['mfa.device_unknown'])
    // What the engine stores when a client sends no User-Agent at all.
    expect(describeDevice('Unknown device', t)).toBe(en['mfa.device_unknown'])
    expect(describeDevice('', t)).toBe(en['mfa.device_unknown'])
  })

  it('does not take a Chromium-based browser for Chrome', () => {
    for (const ua of [UA.edgeWindows, UA.operaWindows, UA.samsung]) {
      expect(parseUserAgent(ua).browser).not.toBe('Chrome')
    }
  })
})
