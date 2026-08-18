// Linked counterpart to ReferenceValueLabel — same label resolution, but
// renders it as a real link to the referenced record's detail page instead
// of plain text. Always points at the formId-keyed runtime route
// (/forms/$formId/$recordId), not a Search menu's own /$menuSlug/$recordId
// URL — a form can have zero, one, or several Search menus pointing at it,
// and there's no principled way to prefer one over another the moment more
// than one exists, so every reference link uses the one URL shape that's
// valid regardless of menu configuration.
import { useQuery } from '@tanstack/react-query'
import { formsApi } from '@/features/forms/api'
import { useForm as useFormDef } from '@/features/forms/hooks'
import { useAuthStore } from '@/stores/auth'
import { resolveReferenceLabel } from './record-title'
import { RuntimeLink } from '@/features/runtime/RuntimeLink'

interface RecordReferenceLinkProps {
  /** The referenced form's id (element.formRef / FieldDef.reference_table). */
  formId?: string
  /** The stored reference value — the referenced record's id. */
  recordId?: unknown
  /** Explicit display field, when configured (element.displayField). */
  displayField?: string
}

export function RecordReferenceLink({ formId, recordId, displayField }: RecordReferenceLinkProps) {
  const id = typeof recordId === 'string' ? recordId : undefined
  const { data: targetForm } = useFormDef(formId ?? '')
  const { data: record, isLoading } = useQuery({
    queryKey: ['forms', formId, 'records', id],
    queryFn: () => formsApi.getRecord(formId!, id!),
    enabled: !!formId && !!id,
  })
  // Mirrors runtimeAppRoute's beforeLoad sync in runtime-router.tsx — this
  // component has no direct access to the $clientId/$appId route params
  // (it's rendered several layers below the route, inside a form-agnostic,
  // reusable table), so it reads the same activeMembership that sync keeps
  // pointed at whatever runtime app is currently being viewed.
  const activeMembership = useAuthStore((s) => s.activeMembership)

  if (!id) return <>—</>
  if (isLoading) return <span className="text-[hsl(var(--muted-foreground))]">…</span>
  if (!record) return <>{id}</>

  const label = resolveReferenceLabel(targetForm?.fields, record, displayField) || id

  // No resolved runtime app to link within (e.g. this table is rendered
  // outside the published runtime, or activeMembership hasn't synced yet) —
  // degrade to the same plain-text rendering ReferenceValueLabel already
  // uses, rather than emit a link to a broken/relative URL.
  if (!formId || !activeMembership?.client_id || !activeMembership?.app_id) return <>{label}</>

  return (
    // stopPropagation on the wrapper's capture phase, not RuntimeLink's own
    // onClick prop — that prop only fires on the subset of clicks RuntimeLink
    // itself intercepts (a plain left-click), so a modified click (middle-
    // click/ctrl/cmd, opening a new tab) would otherwise still bubble up to
    // an ancestor row's own onClick (e.g. RecordsTable's row-opens-drawer
    // handler) even though this link handled it in its own tab.
    <span onClickCapture={(e) => e.stopPropagation()}>
      <RuntimeLink
        to={`/${activeMembership.client_id}/${activeMembership.app_id}/forms/${formId}/${id}`}
        className="text-[hsl(var(--primary))] underline-offset-2 hover:underline"
      >
        {label}
      </RuntimeLink>
    </span>
  )
}
