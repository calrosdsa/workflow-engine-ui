// FR-D2-016 v0.6 — @mention token parsing/rendering shared by the compose
// box (mentions.go's MentionAutocomplete) and CommentRow's display. Mirrors
// the backend's own mentionTokenPattern (api/forms/mentions.go) exactly —
// a UUID-shaped @[uuid] token, not a display name, so a later name change
// never requires rewriting stored comment bodies.
const MENTION_TOKEN = /@\[([0-9a-fA-F-]{36})\]/g

export interface MentionSegment {
  type: 'text' | 'mention'
  text: string
  userId?: string
}

/** Splits a comment body into plain-text and mention segments, in order —
 *  used by CommentRow to render each @[uuid] token as a resolved-name span
 *  instead of the raw token. */
export function splitMentionSegments(body: string): MentionSegment[] {
  const segments: MentionSegment[] = []
  let lastIndex = 0
  for (const match of body.matchAll(MENTION_TOKEN)) {
    const index = match.index ?? 0
    if (index > lastIndex) segments.push({ type: 'text', text: body.slice(lastIndex, index) })
    segments.push({ type: 'mention', text: match[0], userId: match[1] })
    lastIndex = index + match[0].length
  }
  if (lastIndex < body.length) segments.push({ type: 'text', text: body.slice(lastIndex) })
  return segments
}

/** Distinct mentioned user ids in a comment body, in first-appearance order —
 *  used to batch-resolve display names via GET /users/basic (same call
 *  CommentTabRenderer already makes for authors). */
export function parseMentionedUserIds(body: string): string[] {
  const seen = new Set<string>()
  for (const match of body.matchAll(MENTION_TOKEN)) seen.add(match[1])
  return [...seen]
}

/** An `@query` span active at the cursor position, if any — a `@` not
 *  preceded by a word character, followed by zero or more non-whitespace
 *  characters, with the cursor still inside that span. Returns the span's
 *  start offset (where the `@` itself is) and the query text typed after it
 *  (without the `@`), or null if the cursor isn't inside such a span. */
export function activeMentionQuery(value: string, cursor: number): { start: number; query: string } | null {
  const beforeCursor = value.slice(0, cursor)
  const at = beforeCursor.lastIndexOf('@')
  if (at === -1) return null
  const charBeforeAt = at > 0 ? beforeCursor[at - 1] : ''
  if (/\w/.test(charBeforeAt)) return null
  const between = beforeCursor.slice(at + 1)
  if (/\s/.test(between)) return null
  return { start: at, query: between }
}

/** Rewrites the active `@query` span (per activeMentionQuery) to a
 *  `@[user_id] ` mention token, returning the new value and where the
 *  cursor should land (right after the inserted token + trailing space). */
export function insertMention(value: string, span: { start: number; query: string }, userId: string): { value: string; cursor: number } {
  const before = value.slice(0, span.start)
  const after = value.slice(span.start + 1 + span.query.length)
  const token = `@[${userId}] `
  return { value: before + token + after, cursor: (before + token).length }
}
