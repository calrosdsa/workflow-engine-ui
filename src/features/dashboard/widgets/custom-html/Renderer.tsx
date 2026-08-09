import { useMemo } from 'react'
import type { WidgetRendererProps } from '../../widget-contract'
import type { CustomHtmlWidgetConfig } from './schema'
import { sanitizeInlineHtml } from './sanitize'

// Two rendering modes, two different threat models — see
// docs/dashboard-system-plan.md section 5.5. Author-supplied HTML is stored
// XSS against every viewer of a multi-user app, so the security posture is
// the whole point of this file, not an afterthought:
//
// 'inline' — sanitized with DOMPurify's strict allowlist (no <script>, no
// event handlers, no <iframe>) and rendered directly in the page DOM, so it
// inherits app theming. For formatted content a WYSIWYG-ish author trusts
// themselves to write, but the platform doesn't trust to execute.
//
// 'sandbox' — rendered in an iframe via `srcdoc`, sandboxed with
// `allow-scripts allow-popups` and DELIBERATELY NEVER `allow-same-origin`.
// Combining allow-scripts with allow-same-origin is the textbook iframe
// sandbox escape (the sandboxed script would then share the parent's origin
// policy and could reach its cookies/localStorage/session) — omitting
// allow-same-origin means the iframe gets a unique, opaque origin every
// render, so a malicious embed's script can run (as intended, for embed
// codes that need JS) but cannot see or touch this app's DOM, cookies, or
// Limen session, regardless of what it contains. For third-party embed
// codes (YouTube, analytics snippets) that need <script>/<iframe>, which
//'inline' mode's DOMPurify allowlist deliberately strips.
export function CustomHtmlRenderer({ config }: WidgetRendererProps<CustomHtmlWidgetConfig>) {
  if (!config.html.trim()) {
    return <div className="flex h-full items-center justify-center p-3 text-xs text-slate-400">No HTML added yet.</div>
  }

  if (config.mode === 'sandbox') {
    return (
      <iframe
        srcDoc={config.html}
        sandbox="allow-scripts allow-popups"
        title="Custom HTML"
        className="h-full w-full border-0"
      />
    )
  }

  return <InlineSanitizedHtml html={config.html} />
}

function InlineSanitizedHtml({ html }: { html: string }) {
  const clean = useMemo(() => sanitizeInlineHtml(html), [html])

  // `clean` is DOMPurify's sanitized output, never the raw author-supplied
  // string — sanitizeInlineHtml() is what makes this safe to inject.
  return <div className="h-full overflow-auto p-3 text-sm" dangerouslySetInnerHTML={{ __html: clean }} />
}
