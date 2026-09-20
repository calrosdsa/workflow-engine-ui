// Fields reachable ONE hop through a reference field — the authoring half of
// the engine's reference traversal (docs/analytics-and-charting-mcp-rnd.md
// §4.5, roadmap row 14).
//
// The engine accepts a dotted "<reference>.<far_field>" as a dimension or a
// measure. Without this, only MCP could write one: a person has no way to
// name a field that is not on the form in front of them. Same MCP-can,
// humans-cannot gap dashboard parameters had after their first slice.
import { useQueries } from '@tanstack/react-query'
import { formKeys } from '@/features/forms/hooks'
import { formsApi } from '@/features/forms/api'
import type { FieldDef, FieldType, FormDefinition } from '@/features/forms/types'

/** One field on a form reached through a reference. */
export interface HopField {
  /** The dotted path the engine takes: "customer.region". */
  path: string
  /** "Customer / Region" — which form it came from, not the syntax. */
  label: string
  /** The FAR field's type, so a measure picker can gate on it exactly as it
   *  gates a near field. */
  type: FieldType
}

/** The reference fields on a form that actually point somewhere. */
export function referenceFields(form: FormDefinition | undefined): FieldDef[] {
  return (form?.fields ?? []).filter((f) => f.type === 'reference' && !!f.reference_table)
}

/** Every field reachable one hop from `form`.
 *
 *  Keyed with formKeys.detail, so each far form shares the SAME cache entry
 *  as any useForm(id) elsewhere — a dashboard whose tiles all point at one
 *  form fetches it once, not once per tile.
 *
 *  ONE hop only, matching the engine: a far form's own reference fields are
 *  not expanded, because "customer.rep.name" is refused rather than read as
 *  its first hop. */
export function useHopFields(form: FormDefinition | undefined): HopField[] {
  const refs = referenceFields(form)
  const results = useQueries({
    queries: refs.map((f) => ({
      queryKey: formKeys.detail(f.reference_table!),
      queryFn: () => formsApi.get(f.reference_table!),
      // A form definition changes far less often than a chart is edited.
      staleTime: 60_000,
    })),
  })

  const out: HopField[] = []
  refs.forEach((near, i) => {
    const far = results[i]?.data
    if (!far) return
    const nearLabel = near.label || near.name
    for (const f of far.fields) {
      // A far reference field would be the second hop of a chain the engine
      // refuses, so it is not offered.
      if (f.type === 'reference') continue
      out.push({
        path: `${near.name}.${f.name}`,
        label: `${nearLabel} / ${f.label || f.name}`,
        type: f.type,
      })
    }
  })
  return out
}

/** Splits a possibly-dotted field name, mirroring the engine's own
 *  SplitReferencePath: exactly one hop, or not a hop at all. */
export function isHopPath(name: string | undefined): boolean {
  if (!name) return false
  const parts = name.split('.')
  return parts.length === 2 && !!parts[0] && !!parts[1]
}
