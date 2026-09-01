// The app's own Content-Security-Policy.
//
// WHY THIS LIVES IN THE DOCUMENT, NOT IN GO MIDDLEWARE
// ----------------------------------------------------
// The plan for this originally said "response-header middleware in
// workflow-engine". That was wrong: the Go server serves only /api — it has
// no FileServer, no embed.FS, no ServeFile anywhere. A CSP on a JSON API
// response governs nothing, because a CSP applies to the DOCUMENT that
// loads scripts and frames, and this codebase's documents (index.html,
// runtime.html) are served by Vite in development and by whatever hosts
// `dist/` in production. A <meta> in the document is therefore the only
// delivery mechanism this repository actually controls.
//
// WHAT A <meta> CSP CANNOT DO
// ---------------------------
// `frame-ancestors`, `report-uri`/`report-to`, and `sandbox` are ignored
// when delivered by <meta> — they are header-only by spec. Clickjacking
// protection (`frame-ancestors`) therefore still needs an X-Frame-Options
// or CSP header at the hosting layer; it is deliberately not listed below
// rather than listed and silently ineffective.
//
// WHY connect-src AND img-src ARE BROAD
// -------------------------------------
// Two origins are only known at RUNTIME, not at build time:
//   • the Centrifugo websocket, whose ws_url arrives in an API response
//   • presigned content URLs, whose origin is CONTENT_S3_ENDPOINT (Garage
//     on :3900 in dev, a real S3 endpoint in production)
// Neither can be enumerated here. Narrowing them means either building the
// frontend per-deployment with those values, or serving the document from
// Go so it can compose the policy from the config it already holds — both
// real options, both larger than this. The scheme-level allowance below is
// the honest intermediate: it does not stop exfiltration, and says so.
//
// What this policy DOES buy, and it is the larger half: `script-src`
// without a wildcard, `object-src 'none'`, and a locked `base-uri` /
// `form-action` — the directives that actually blunt injected-script and
// form-hijacking attacks.

export interface CspOptions {
  /** Development adds what Vite's dev server needs: eval for its transform
   *  pipeline, and a plain-ws/http origin for HMR and the API proxy. */
  dev: boolean
}

/** Builds the policy string. Pure, so csp.test.ts can assert the shape
 *  rather than trusting a template literal in a config file. */
export function buildAppCsp({ dev }: CspOptions): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],

    // No wildcard, ever. 'unsafe-inline' is required because the built
    // bundle carries an inline module-preload shim, and dev additionally
    // needs 'unsafe-eval' for Vite's transform pipeline.
    'script-src': ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : [])],

    // 'unsafe-inline' is unavoidable here rather than lax: ThemeProvider
    // applies the app's palette with element.style.setProperty, and inline
    // style attributes are CSP-governed. Removing it would break theming
    // outright.
    'style-src': ["'self'", "'unsafe-inline'"],

    // blob: covers object URLs; https: covers presigned content from
    // whatever S3 endpoint this deployment uses. http: only in dev, where
    // Garage runs on plain http://localhost:3900.
    'img-src': ["'self'", 'data:', 'blob:', 'https:', ...(dev ? ['http:'] : [])],
    'font-src': ["'self'", 'data:'],

    // https:/wss: rather than named origins — see the note above.
    'connect-src': ["'self'", 'https:', 'wss:', ...(dev ? ['http:', 'ws:'] : [])],

    // Deliberately permissive: Embedded Integrations and the embed widget
    // exist to iframe author-chosen third-party URLs, and HTML menus render
    // their sandboxed pages from srcdoc (blob:/data: adjacent). Narrowing
    // this would break shipped features, not tighten a gap.
    'frame-src': ["'self'", 'https:', 'blob:', 'data:', ...(dev ? ['http:'] : [])],
    'worker-src': ["'self'", 'blob:'],

    // The genuinely valuable locks.
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
  }

  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ')
}

/** The <meta> element, ready to inject as the first thing in <head>.
 *
 *  Position matters: a meta CSP governs only what FOLLOWS it, so it must
 *  precede every script and stylesheet in the document. */
export function cspMetaTag(options: CspOptions): string {
  return `<meta http-equiv="Content-Security-Policy" content="${buildAppCsp(options)}">`
}
