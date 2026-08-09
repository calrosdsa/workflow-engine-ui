import DOMPurify from 'dompurify'

// Extracted as a plain function (not inlined in the Renderer's useMemo) so
// it's directly unit-testable against real attack payloads — see
// sanitize.test.ts. This is the actual security boundary for 'inline' mode
// (docs/dashboard-system-plan.md section 5.5): an explicit ALLOWED_TAGS/ATTR
// allowlist, not a denylist, so a config mistake fails closed (strips too
// much) rather than open (strips too little). FORBID_TAGS/FORBID_ATTR are
// belt-and-suspenders on top of the allowlist already excluding them —
// DOMPurify's own docs recommend this for anything user-facing.
export function sanitizeInlineHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'a', 'b', 'i', 'em', 'strong', 'u', 's', 'p', 'br', 'hr', 'span', 'div',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
      'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'figure', 'figcaption',
      'small', 'sub', 'sup', 'mark',
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'style', 'target', 'rel', 'width', 'height', 'colspan', 'rowspan'],
    FORBID_TAGS: ['script', 'style', 'iframe', 'embed', 'object', 'form', 'input', 'button', 'link', 'meta'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'formaction'],
  })
}
