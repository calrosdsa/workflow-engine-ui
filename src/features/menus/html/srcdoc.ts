// Composes the document an HTML menu's sandboxed iframe actually renders.
//
// This is the security boundary in one pure function, deliberately separated
// from the React component so it can be unit-tested against real payloads —
// same reasoning as features/dashboard/widgets/custom-html/sanitize.ts,
// which is the inline mode's equivalent boundary.
//
// The iframe runs with `sandbox="allow-scripts allow-popups"` and NEVER
// `allow-same-origin`, so the author's script executes against an opaque
// origin: it cannot read this app's DOM, cookies, or Limen session. That
// isolation is also why the two things the page legitimately needs — the
// theme, and its data — have to be handed in rather than fetched:
//
//   • Theme arrives as a `:root{…}` block of the host's own resolved CSS
//     custom properties, so `hsl(var(--primary))` matches the runtime.
//   • Data arrives over postMessage, from a host that holds the session and
//     only ever runs queries the author declared at design time.
//
// ORDERING IS LOAD-BEARING. The CSP <meta> is written first, before any
// author markup. A CSP delivered by <meta> only applies to content that
// follows it, and additional policies can only INTERSECT — a later policy,
// including one an author's script injects, can restrict further but can
// never widen. Composing ours first is therefore what makes the allowlist
// enforceable rather than advisory.

/** The theme custom properties mirrored into the frame.
 *
 *  Kept in step with features/theme/ThemeProvider.tsx, which is the only
 *  thing that sets them. A token added there and not here simply doesn't
 *  reach the frame — the page still renders, it just falls back for that
 *  one value, which is why this list is additive-safe. */
export const THEME_TOKENS = [
  '--primary', '--primary-foreground',
  '--secondary', '--secondary-foreground',
  '--accent', '--accent-foreground',
  '--background', '--foreground',
  '--card', '--card-foreground',
  '--popover', '--popover-foreground',
  '--muted', '--muted-foreground',
  '--border', '--input', '--ring', '--radius',
] as const

/** A host is accepted only in this shape. Deliberately strict: the value is
 *  interpolated into the CSP `content` attribute, so anything that could
 *  carry a `;` or whitespace would let an author append their own directive
 *  and widen the very policy that is meant to bound them.
 *
 *  Allows an optional scheme, a dotted hostname with an optional leading
 *  `*.` wildcard label, and an optional port. Rejects paths, query strings,
 *  credentials, and every CSP keyword (`*`, `'unsafe-eval'`, `data:` …). */
const HOST_PATTERN = /^(?:https?:\/\/)?(?:\*\.)?[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+(?::\d{1,5})?$/i

/** True when `host` is safe to place in a CSP directive. */
export function isAllowedHost(host: string): boolean {
  return HOST_PATTERN.test(host.trim())
}

/** Keeps only the hosts that pass validation. An invalid entry is dropped
 *  rather than failing the whole render — the config panel is where an
 *  author is told about it; at runtime a bad host must not blank the page. */
export function sanitizeHosts(hosts: readonly string[] | null | undefined): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of hosts ?? []) {
    const host = raw.trim()
    if (!host || seen.has(host) || !isAllowedHost(host)) continue
    seen.add(host)
    out.push(host)
  }
  return out
}

/** Builds the CSP the frame runs under.
 *
 *  `default-src 'none'` is the floor: everything is denied unless a
 *  directive below re-permits it. `'unsafe-inline'` for script and style is
 *  safe *here specifically* — the origin is opaque, so the script it allows
 *  has nothing of this app's to reach, and refusing it would mean an author
 *  couldn't write a `<script>` or a `<style>` in their own page at all. */
export function buildCsp(allowedHosts: readonly string[] | null | undefined): string {
  const hosts = sanitizeHosts(allowedHosts)
  const list = hosts.length > 0 ? ' ' + hosts.join(' ') : ''
  // With no declared hosts the page is fully self-contained: it may still
  // run its own inline script and style, but it can reach nothing outward.
  const connect = hosts.length > 0 ? hosts.join(' ') : "'none'"
  return [
    "default-src 'none'",
    `script-src 'unsafe-inline'${list}`,
    `style-src 'unsafe-inline'${list}`,
    `img-src data: blob:${list}`,
    `font-src data:${list}`,
    `connect-src ${connect}`,
    `frame-src${list || " 'none'"}`,
    "form-action 'none'",
    "base-uri 'none'",
  ].join('; ')
}

/** Serialises resolved token values into a `:root{…}` block.
 *
 *  Total by contract: every input here is nullable. These functions parse
 *  STORED config, which predates fields being added (a menu saved before
 *  write_targets existed has none) and is read straight off the wire — the
 *  same never-throws rule every other config parser in this codebase follows
 *  (FR-D-005). Throwing here blanks the page behind an error boundary, which
 *  is strictly worse than rendering with a fallback.
 * Values are
 *  filtered to a conservative character set: they come from
 *  getComputedStyle rather than from an author, but they are interpolated
 *  into a <style> block, and a value carrying `<` or `}` would break out of
 *  it. Anything unexpected is dropped rather than escaped — a missing token
 *  degrades to the page's own fallback, which is the safe direction. */
export function buildThemeCss(values: Record<string, string> | null | undefined): string {
  const safe = /^[a-zA-Z0-9\s.,%#()/_-]+$/
  const decls = Object.entries(values ?? {})
    .filter(([name, value]) => name.startsWith('--') && value && safe.test(value))
    .map(([name, value]) => `${name}: ${value.trim()};`)
  if (decls.length === 0) return ''
  return `:root{${decls.join('')}}`
}

export interface SrcDocInput {
  /** The author's markup, verbatim. Never sanitized — the sandbox, not a
   *  filter, is what makes it safe, and stripping tags here would defeat
   *  the point of offering a scripting surface at all. */
  html: string
  /** Resolved theme custom properties, from readThemeTokens(). */
  themeValues: Record<string, string> | null | undefined
  /** Hosts the page may reach outward. */
  allowedHosts: readonly string[] | null | undefined
  /** Declared data source ids, so the in-frame helper can fail fast on a
   *  typo instead of hanging on a request the host will refuse. */
  sourceIds: readonly string[] | null | undefined
}

/** The whole document, ready for the iframe's `srcdoc`. */
export function composeSrcDoc({ html, themeValues, allowedHosts, sourceIds }: SrcDocInput): string {
  const themeCss = buildThemeCss(themeValues)
  return `<!doctype html>
<html>
<head>
<meta http-equiv="Content-Security-Policy" content="${buildCsp(allowedHosts)}">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style id="ab-theme">${themeCss}</style>
<style>
html,body{margin:0;padding:0;background:hsl(var(--background));color:hsl(var(--foreground));font-family:system-ui,sans-serif;}
*,*::before,*::after{box-sizing:border-box;}
</style>
<script>${bridgeScript(sourceIds)}</script>
</head>
<body>
${html}
</body>
</html>`
}

/** The in-frame half of the bridge, exposed to the author as
 *  `AppBuilder.query(...)` / `AppBuilder.write(...)`.
 *
 *  A helper rather than raw postMessage because the correct usage has real
 *  detail — correlating a requestId, filtering messages that aren't
 *  replies, rejecting rather than hanging on error — and an author writing
 *  that by hand each time will get it subtly wrong. It also gives the
 *  contract one place to change.
 *
 *  Injected as a literal string, not a module: the frame has no bundler and
 *  no network access to fetch one. */
function bridgeScript(sourceIds: readonly string[] | null | undefined): string {
  const known = JSON.stringify([...(sourceIds ?? [])])
  return `(function(){
var KNOWN=${known},pending={},n=0;
function applyTheme(css){
  var el=document.getElementById('ab-theme');
  if(!el){el=document.createElement('style');el.id='ab-theme';document.head.appendChild(el);}
  el.textContent=css;
}
window.addEventListener('message',function(e){
  if(e.source!==window.parent)return;
  var m=e.data;if(!m)return;
  // Theme updates carry no requestId — handled before the correlation
  // check below, which exists only for request/response pairs.
  if(m.type==='appbuilder:theme'){applyTheme(m.css);return;}
  if(!m.requestId)return;
  var p=pending[m.requestId];if(!p)return;
  delete pending[m.requestId];
  if(m.type==='appbuilder:error')p.reject(new Error(m.message||m.code||'request failed'));
  else p.resolve(m);
});
function send(payload){
  return new Promise(function(resolve,reject){
    var id='r'+(++n);
    pending[id]=({resolve:resolve,reject:reject});
    payload.requestId=id;
    window.parent.postMessage(payload,'*');
    setTimeout(function(){
      if(pending[id]){delete pending[id];reject(new Error('timed out'));}
    },30000);
  });
}
window.AppBuilder={
  sources:KNOWN,
  query:function(source,opts){
    if(KNOWN.indexOf(source)===-1)return Promise.reject(new Error('unknown data source "'+source+'" — declared: '+KNOWN.join(', ')));
    opts=opts||{};
    return send({type:'appbuilder:query',source:source,page:opts.page,pageSize:opts.pageSize})
      .then(function(m){return {rows:m.rows,total:m.total};});
  },
  write:function(target,op,values,recordId){
    return send({type:'appbuilder:write',target:target,op:op,values:values,recordId:recordId})
      .then(function(m){return {recordId:m.recordId};});
  }
};
})();`
}
