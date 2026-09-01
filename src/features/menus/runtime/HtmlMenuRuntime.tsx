import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formsApi } from '@/features/forms/api'
import { composeSrcDoc, THEME_TOKENS } from '../html/srcdoc'
import type { MenuRuntimeRendererProps } from '../menu-registry'
import type { HtmlMenuConfig, HtmlDataSource, HtmlWriteTarget } from '../types'

/** Reads the host's resolved theme custom properties, to be mirrored into
 *  the frame. Resolved rather than declared: ThemeProvider sets these with
 *  element.style.setProperty from the app's saved theme, and the values that
 *  matter are whatever won after light/dark resolution. */
function readThemeTokens(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  const computed = getComputedStyle(document.documentElement)
  const out: Record<string, string> = {}
  for (const token of THEME_TOKENS) {
    const value = computed.getPropertyValue(token)
    if (value) out[token] = value.trim()
  }
  return out
}

interface QueryMessage {
  type: 'appbuilder:query'
  requestId: string
  source: string
  page?: number
  pageSize?: number
}

interface WriteMessage {
  type: 'appbuilder:write'
  requestId: string
  target: string
  op: 'create' | 'update'
  recordId?: string
  values: Record<string, unknown>
}

/** Renders an author-written page in a sandboxed iframe, and acts as its
 *  only channel to the outside.
 *
 *  The host holds the credentials; the frame holds the code. Everything
 *  privileged stays on this side of the wall: the frame never receives a
 *  cookie, a token, or an API client, only rows it asked for by a declared
 *  id and the outcome of writes to declared targets. Both go through the
 *  ordinary record endpoints, so the viewer's own per-form permissions,
 *  field validation, workflow triggers and the audit log all apply exactly
 *  as they would if the viewer had used the normal UI — a page can never do
 *  more than the person looking at it could do by hand.
 *
 *  See features/menus/html/srcdoc.ts for the document composition and why
 *  `allow-same-origin` must never be added to the sandbox attribute. */
export function HtmlMenuRuntime({ menu }: MenuRuntimeRendererProps) {
  const config = menu.config as HtmlMenuConfig
  const frameRef = useRef<HTMLIFrameElement>(null)
  // Read once per mount rather than on every render: the tokens only change
  // when the theme does, and re-composing srcdoc remounts the whole page,
  // discarding whatever state the author's script had built up.
  const [themeValues] = useState(readThemeTokens)

  const sources = useMemo<HtmlDataSource[]>(() => config.data_sources ?? [], [config.data_sources])
  const targets = useMemo<HtmlWriteTarget[]>(() => config.write_targets ?? [], [config.write_targets])

  const srcDoc = useMemo(() => composeSrcDoc({
    html: config.html ?? '',
    themeValues,
    allowedHosts: config.allowed_hosts ?? [],
    sourceIds: sources.map((s) => s.id),
  }), [config.html, config.allowed_hosts, sources, themeValues])

  const reply = useCallback((payload: Record<string, unknown>) => {
    // targetOrigin '*' is correct here and not a lapse: the frame's origin
    // is opaque precisely because allow-same-origin is omitted, so there is
    // no specific origin to name. What makes this safe is the direction —
    // we only ever reply to a request the frame made, carrying data the
    // author already declared it may see.
    frameRef.current?.contentWindow?.postMessage(payload, '*')
  }, [])

  useEffect(() => {
    const onMessage = async (event: MessageEvent) => {
      // The only identity check available for an opaque-origin frame: is
      // this actually our iframe's window? event.origin is "null" for every
      // sandboxed frame, so it can't distinguish ours from any other.
      if (!frameRef.current || event.source !== frameRef.current.contentWindow) return

      const msg = event.data as QueryMessage | WriteMessage | null
      if (!msg || typeof msg !== 'object' || typeof msg.requestId !== 'string') return

      const fail = (code: string, message: string) =>
        reply({ type: 'appbuilder:error', requestId: msg.requestId, code, message })

      try {
        if (msg.type === 'appbuilder:query') {
          const source = sources.find((s) => s.id === msg.source)
          // An id the author never declared is refused here, not filtered
          // later — this is the whole access-control boundary for reads.
          if (!source) return fail('unknown_source', `No data source named "${msg.source}".`)

          const pageSize = clampPageSize(msg.pageSize ?? source.page_size ?? 50)
          const result = await formsApi.searchRecords(source.form_id, {
            filter: source.filter,
            sort: source.sort,
            page: Math.max(1, msg.page ?? 1),
            page_size: pageSize,
          })
          return reply({
            type: 'appbuilder:rows',
            requestId: msg.requestId,
            rows: projectColumns(result.records, source.columns),
            total: result.total,
          })
        }

        if (msg.type === 'appbuilder:write') {
          const target = targets.find((t) => t.id === msg.target)
          if (!target) return fail('unknown_target', `No write target named "${msg.target}".`)

          const values = msg.values && typeof msg.values === 'object' ? msg.values : {}
          if (msg.op === 'create') {
            if (!target.allow_create) return fail('forbidden', `"${target.id}" does not allow creating records.`)
            const created = await formsApi.createRecord(target.form_id, values)
            return reply({ type: 'appbuilder:written', requestId: msg.requestId, recordId: String(created.id ?? '') })
          }
          if (msg.op === 'update') {
            if (!target.allow_update) return fail('forbidden', `"${target.id}" does not allow updating records.`)
            if (!msg.recordId) return fail('failed', 'An update needs a recordId.')
            await formsApi.updateRecord(target.form_id, msg.recordId, values)
            return reply({ type: 'appbuilder:written', requestId: msg.requestId, recordId: msg.recordId })
          }
          return fail('failed', `Unknown operation "${String(msg.op)}".`)
        }
      } catch (e) {
        // Includes the 403 a viewer without permission on the underlying
        // form gets. Reported to the page as a plain failure rather than
        // silence, so the author can show something honest.
        return fail('failed', e instanceof Error ? e.message : 'Request failed.')
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [sources, targets, reply])

  if (!config.html?.trim()) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
        This page has no content yet.
      </div>
    )
  }

  return (
    <iframe
      ref={frameRef}
      srcDoc={srcDoc}
      // allow-same-origin is deliberately absent. Adding it would give the
      // frame this app's origin, and with allow-scripts already present
      // that is the documented sandbox escape — see srcdoc.ts.
      sandbox="allow-scripts allow-popups allow-forms"
      title={menu.name}
      className="h-full w-full border-0"
    />
  )
}

/** Page size is bounded here rather than trusted from the frame: the value
 *  crosses the boundary, and an unbounded one would let a page pull a whole
 *  table in a single request. */
function clampPageSize(n: number): number {
  if (!Number.isFinite(n)) return 50
  return Math.min(500, Math.max(1, Math.floor(n)))
}

/** Narrows each row to the columns the author declared. Undefined/empty
 *  means the author didn't narrow it, so the row passes through whole —
 *  matching RecordsTable's own "empty columns means all fields" convention
 *  (FR-B1-006). `id` is always kept: without it a page can't address a
 *  record it just listed in a later update. */
function projectColumns(
  rows: Record<string, unknown>[],
  columns: string[] | undefined,
): Record<string, unknown>[] {
  if (!columns || columns.length === 0) return rows
  const keep = new Set([...columns, 'id'])
  return rows.map((row) => {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(row)) if (keep.has(key)) out[key] = row[key]
    return out
  })
}
