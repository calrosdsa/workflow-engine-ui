/* Hallmark · component: form-section container · genre: modern-minimal
 * theme: unchanged — design.md token pickup only, no new colors
 * states: n/a — presentational container, no interactive surface of its own
 *         (the fields it wraps own their own states via InlineFieldEditor)
 * pre-emit critique: P5 H5 E4 S5 R5 V4
 */
import type { ReactNode } from 'react'

/** The shared chrome around one form section, used by BOTH read surfaces and
 *  fill surfaces (RecordDetailPanel's DetailsTab and FormRenderer) so a form
 *  authored with sections looks the same grouped way wherever it renders.
 *
 *  Why this exists: a section's title used to be a bare bold line followed
 *  directly by its fields, then immediately the next title and its fields.
 *  Nothing said where one group ended and the next began, so a form authored
 *  with three titled sections read as one flat list of fields — the author got
 *  no visible payoff for grouping, which is the whole point of the feature.
 *
 *  Separation is carried by a border and a header hairline, never by a fill.
 *  That is deliberate and matches this design system: `--card` resolves to the
 *  same value as `--background`, so a background tint separates nothing here —
 *  and the 5%-white `--muted` tint is spoken for as the fill-swap ACTIVE state
 *  for list/tab/chip controls, so borrowing it for static section chrome would
 *  say "selected" about something that isn't selectable. The teal accent is
 *  likewise reserved for focus rings, active states and CTAs, so there is no
 *  accent rule or coloured bar on a section head. Border-only is the system's
 *  own answer, not a compromise. */
export function FormSectionShell({ id, title, description, chrome, children }: {
  /** Section id — used to tie the heading to the region for screen readers. */
  id: string
  title?: string
  description?: string
  /** Whether to draw the card. False for a single-section form, where a box
   *  around the entire form is chrome that groups nothing — see shouldChromeSections. */
  chrome: boolean
  children: ReactNode
}) {
  const headingId = `${id}-title`
  const hasHeader = Boolean(title || description)

  if (!chrome) {
    return (
      <section aria-labelledby={title ? headingId : undefined}>
        {title && (
          <h3 id={headingId} className="mb-3 text-sm font-semibold" style={{ color: 'hsl(var(--foreground))' }}>
            {title}
          </h3>
        )}
        {description && (
          <p className="mb-3 text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>{description}</p>
        )}
        {children}
      </section>
    )
  }

  return (
    <section
      aria-labelledby={title ? headingId : undefined}
      className="overflow-hidden rounded-lg border"
      style={{ borderColor: 'hsl(var(--border))', backgroundColor: 'hsl(var(--card))' }}
    >
      {hasHeader && (
        <header className="border-b px-4 py-3" style={{ borderColor: 'hsl(var(--border))' }}>
          {title && (
            <h3 id={headingId} className="text-sm font-semibold leading-none tracking-tight" style={{ color: 'hsl(var(--foreground))' }}>
              {title}
            </h3>
          )}
          {description && (
            <p className="mt-1.5 text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>{description}</p>
          )}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  )
}

/** Card chrome earns its place only when there is more than one section to tell
 *  apart. A single-section form wrapped in a card gains a border around the
 *  whole form and separates nothing, so it stays plain — the same restraint the
 *  detail page already applies by not boxing a form that has no sections. */
export function shouldChromeSections(sectionCount: number): boolean {
  return sectionCount > 1
}
