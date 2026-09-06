// The record detail experience shared by the Search menu's drawer and the
// "Expand to full page" route — Details / Audit Log / Linked Records tabs.
// Takes only (formId, recordId, fields), not the whole Menu, so it's usable
// from both call sites without depending on menu context.
import { useState } from 'react'
import {
  ChevronLeft, ChevronRight, ChevronDown, Workflow as WorkflowIcon, User as UserIcon, History,
} from 'lucide-react'
import { DataTable } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useRecordDetail, useAuditLog, useLinkedRecords } from './record-detail-hooks'
import { InlineFieldEditor } from './InlineFieldEditor'
import { resolveAdvancedSettings } from './advanced-settings'
import { useCurrentViewer } from './detail-tabs/useTabVisible'
import { COLUMN_LAYOUTS } from '@/features/form-builder/schema'
import { COMPONENT_REGISTRY } from '@/features/form-builder/component-registry'
import { formatValue, formatFileOrValue } from './format-value'
import { FileCellDisplay } from './FileCellDisplay'
import { resolveReferenceLabel } from './record-title'
import { ReferenceValueLabel } from './ReferenceValueLabel'
import { buildEnumLabels, resolveEnumLabel } from './enum-labels'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useTeamUsers } from '@/features/users/hooks'
import type { TeamUser } from '@/features/users/types'
import { useForm as useFormDef } from '@/features/forms/hooks'
import { iterElements } from '@/features/form-builder/projection'
import { resolveDetailTabs } from './detail-tabs/registry'
import { DetailTabList } from './detail-tabs/DetailTabList'
import { ZonedDetailTabList } from './detail-tabs/ZonedDetailTabList'
import { MAX_GROUP_DEPTH } from './detail-tabs/contract'
import { FormSectionShell, shouldChromeSections } from './FormSectionShell'
import './detail-tabs'
import type { FormSchema, DetailTabConfig } from '@/features/form-builder/schema'
import type { FieldDef, AuditLogEntry, AuditFieldChange, LinkedRecordGroup } from '@/features/forms/types'

export { formatValue }
export { RecordDetailToolbar } from './RecordDetailToolbar'

interface RecordDetailPanelProps {
  formId: string
  recordId: string
  fields: FieldDef[]
  /** The form's builder layout (sections/columns). When provided, the
   *  Details tab mirrors the same section/column arrangement configured in
   *  the form designer instead of falling back to a flat field list, and
   *  per-field inline editing (InlineFieldEditor) becomes available for
   *  eligible fields — it needs the real schema to know each field's
   *  ComponentType/behavior rules. */
  schema?: FormSchema
  /** Called with a (formId, recordId) pair when the user wants to jump to a
   *  linked record — the caller decides how to resolve that into a real
   *  navigation (e.g. finding a Search menu that targets that form). */
  onNavigateToRecord?: (formId: string, recordId: string) => void
}

export function RecordDetailPanel({ formId, recordId, fields, schema, onNavigateToRecord }: RecordDetailPanelProps) {
  const { data: record } = useRecordDetail(formId, recordId)
  const configuredTabs = resolveDetailTabs(schema?.settings?.detailTabs)

  return (
    <div className="flex h-full flex-col">
      <ZonedDetailTabList
        formId={formId}
        recordId={recordId}
        fields={fields}
        schema={schema}
        record={record}
        tabConfigs={configuredTabs}
        layout={schema?.settings?.detailLayout ?? 'single'}
        orientation={schema?.settings?.tabOrientation ?? 'horizontal'}
        onNavigateToRecord={onNavigateToRecord}
      />
    </div>
  )
}

export function DetailsTab({
  formId, recordId, fields, schema,
  childTabs, onNavigateToRecord, groupDepth,
}: {
  formId: string
  recordId: string
  fields: FieldDef[]
  schema?: FormSchema
  /** Optional tabs (e.g. "Comments" / "History") rendered as a nested
   *  sub-tab-bar below the fields — see built-in/schema.ts's DetailsTabConfig. */
  childTabs?: DetailTabConfig[]
  onNavigateToRecord?: (formId: string, recordId: string) => void
  groupDepth?: number
}) {
  const { data: record, isLoading } = useRecordDetail(formId, recordId)
  const viewer = useCurrentViewer()
  // Only one field can be in edit mode at a time across this whole record —
  // lifted here (rather than each InlineFieldEditor owning independent
  // local state) so opening a second field's editor forces the first one
  // to resolve first. Keyed by el.id (stable across a record's fields,
  // unlike el.key which theoretically could collide across sections) so an
  // editor knows whether IT is the one currently open.
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null)
  if (isLoading) return <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>Loading…</p>
  if (!record) return <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>Record not found.</p>

  // Same cycle-protection as GroupTabRenderer — 'details' is itself pickable
  // inside a Tab Group (or another Details' own childTabs), so nothing stops
  // an admin nesting Details inside Details inside Details indefinitely
  // without this cap.
  const childTabList = childTabs && childTabs.length > 0 ? (
    (groupDepth ?? 0) >= MAX_GROUP_DEPTH ? (
      <p className="mt-6 border-t pt-4 text-sm" style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--destructive))' }}>
        Nested too deeply (possibly a group containing itself) — stopped rendering further.
      </p>
    ) : (
      <div className="mt-6 border-t pt-4" style={{ borderColor: 'hsl(var(--border))' }}>
        <DetailTabList
          formId={formId}
          recordId={recordId}
          fields={fields}
          schema={schema}
          record={record}
          tabConfigs={childTabs}
          onNavigateToRecord={onNavigateToRecord}
          nested
          groupDepth={(groupDepth ?? 0) + 1}
        />
      </div>
    )
  ) : null

  if (schema && schema.sections.length > 0) {
    const chromeSections = shouldChromeSections(schema.sections.length)
    return (
    <div className={chromeSections ? 'space-y-4' : 'space-y-6'}>
      {schema.sections.map((section) => (
        <FormSectionShell
          key={section.id}
          id={section.id}
          title={section.title}
          description={section.description}
          chrome={chromeSections}
        >
          {/* Stacks to one column below `md` for the same reason FormRenderer's
           *  own section row does: a 2/3/4-column layout has no room to sit
           *  side by side on a phone, and a bare flex row squeezed every column
           *  into a sliver rather than wrapping. */}
          <div className="flex flex-col gap-4 md:flex-row">
            {section.columns.map((column) => {
              const ratios = COLUMN_LAYOUTS[section.layout]?.ratios ?? [1]
              const idx = section.columns.indexOf(column)
              // A 'line_items' element is data-bearing ONLY in adopted mode
              // (see projection.ts's elementToField) — COMPONENT_REGISTRY's
              // dataBearing flag is per-component-type and can't see a
              // specific element's sourceMode, so it's always false for
              // 'line_items' and this filter has to special-case it here,
              // the same way elementToField does on the write side.
              // Without this, an adopted Line Items grid's section renders
              // with a heading and nothing else in read-only view.
              // Advanced Settings apply on this surface too: the detail page
              // renders the same form UI the fill form does, so a field
              // hidden_in_ui for this viewer must not display its stored
              // value here either, and read_only must survive into inline
              // editing. Resolved once per element against the RECORD's
              // saved values (there is no draft on a read surface);
              // clear_value is a fill-time side effect and has no meaning on
              // display, so only hidden/readOnly are consumed.
              const visibleElements = column.elements
                .filter((el) => {
                  if (el.component === 'hidden') return false
                  if (el.component === 'line_items') return el.sourceMode === 'existing'
                  return COMPONENT_REGISTRY[el.component].dataBearing
                })
                .map((el) => ({ el, effects: resolveAdvancedSettings(el.advancedSettings, viewer, record) }))
                .filter(({ effects }) => !effects.hidden)
              return (
                <div key={column.id} className="space-y-3" style={{ flex: ratios[idx] ?? 1 }}>
                  {visibleElements.map(({ el, effects }) => (
                    <div key={el.id} className="text-sm">
                      <div className="mb-1 text-xs font-medium" style={{ color: 'hsl(var(--muted-foreground))' }}>
                        {el.label}
                      </div>
                      <InlineFieldEditor
                        el={el}
                        record={record}
                        formId={formId}
                        recordId={recordId}
                        advancedReadOnly={effects.readOnly}
                        isEditing={editingFieldId === el.id}
                        anyFieldEditing={editingFieldId !== null}
                        onStartEdit={() => setEditingFieldId(el.id)}
                        onStopEdit={() => setEditingFieldId((cur) => (cur === el.id ? null : cur))}
                      />
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </FormSectionShell>
      ))}
      {childTabList}
    </div>
    )
  }

  return (
    <div className="space-y-3">
      {fields.map((f) => (
        <div key={f.name} className="text-sm">
          <div className="mb-1 text-xs font-medium" style={{ color: 'hsl(var(--muted-foreground))' }}>{f.label}</div>
          <div style={{ color: 'hsl(var(--foreground))' }}>
            {f.type === 'reference' ? (
              <ReferenceValueLabel formId={f.reference_table} recordId={record[f.name]} displayField={f.display_field} />
            ) : f.type === 'file' ? (
              <FileCellDisplay value={record[f.name]} />
            ) : (
              formatValue(record[f.name])
            )}
          </div>
        </div>
      ))}
      {childTabList}
    </div>
  )
}

function userDisplayName(u: TeamUser): string {
  const name = `${u.first_name} ${u.last_name}`.trim()
  return name || u.email
}

/** Resolves an actor id to a display name + icon. The users lookup
 *  (GET /users) is Super-Admin-only server-side (workflow-engine/api/handler.go),
 *  so `users` is undefined/empty for every other viewer — this always falls
 *  back to a short, readable id fragment rather than either crashing or
 *  silently showing nothing, since a 403 there must never break this tab. */
function actorLabel(
  entry: AuditLogEntry,
  users: TeamUser[] | undefined,
): { icon: typeof UserIcon; label: string; sublabel?: string } {
  if (entry.actor_workflow_execution_id) return { icon: WorkflowIcon, label: 'Automation', sublabel: 'Workflow' }
  if (entry.actor_user_id) {
    const user = users?.find((u) => u.id === entry.actor_user_id)
    if (user) return { icon: UserIcon, label: userDisplayName(user), sublabel: user.email }
    return { icon: UserIcon, label: `User ${entry.actor_user_id.slice(0, 8)}` }
  }
  return { icon: UserIcon, label: 'System' }
}

const ACTION_BADGE: Record<AuditLogEntry['action'], { variant: 'success' | 'default' | 'destructive'; label: string }> = {
  create: { variant: 'success', label: 'Created' },
  update: { variant: 'default', label: 'Updated' },
  delete: { variant: 'destructive', label: 'Deleted' },
}

/** id/created_at/updated_at ride along in every field_changes payload
 *  (internal/forms/store diffs the whole row) but are never real field
 *  edits a viewer configured — id never changes and the timestamps are
 *  system-maintained, so surfacing them as "changes" is pure noise. */
const NOISE_FIELDS = new Set(['id', 'created_at', 'updated_at'])

function realFieldChanges(entry: AuditLogEntry): [string, AuditFieldChange][] {
  if (!entry.field_changes) return []
  return Object.entries(entry.field_changes).filter(([key, change]) => {
    if (NOISE_FIELDS.has(key)) return false
    return change.old !== change.new
  })
}

export function AuditLogTab({ formId, recordId, fields, schema }: { formId: string; recordId: string; fields: FieldDef[]; schema?: FormSchema }) {
  const [page, setPage] = useState(1)
  const pageSize = 25
  const { data, isLoading } = useAuditLog(formId, recordId, page, pageSize)
  const { data: users } = useTeamUsers()
  const [expanded, setExpanded] = useState<string | null>(null)

  // Prefers the (already-localized, per its caller) layout schema's own
  // element label over FieldDef.label — same reasoning as RecordsTable's
  // identical labelByKey, and the same "no schema means no localization to
  // do" fallback.
  const labelByKey = schema ? new Map([...iterElements(schema)].map((el) => [el.key, el.label])) : new Map<string, string>()
  const fieldLabel = (key: string) => labelByKey.get(key) ?? fields.find((f) => f.name === key)?.label ?? key
  const enumLabels = buildEnumLabels(schema)
  const fieldIsEnum = (key: string) => fields.find((f) => f.name === key)?.type === 'enum'

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    )
  }
  const entries = data?.entries ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-10 text-center" style={{ borderColor: 'hsl(var(--border))' }}>
        <History size={20} style={{ color: 'hsl(var(--muted-foreground))' }} />
        <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>No audit history yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => {
        const actor = actorLabel(entry, users)
        const Icon = actor.icon
        const isOpen = expanded === entry.id
        const changes = realFieldChanges(entry)
        const changeCount = changes.length
        const badge = ACTION_BADGE[entry.action]
        return (
          <div key={entry.id} className="rounded-lg border" style={{ borderColor: 'hsl(var(--border))' }}>
            <button
              type="button"
              onClick={() => changeCount > 0 && setExpanded(isOpen ? null : entry.id)}
              className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-[hsl(var(--accent))]"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <Avatar name={actor.label === 'Automation' ? 'AT' : actor.label} className="h-7 w-7" />
                <span className="flex min-w-0 flex-col">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[13px] font-medium" style={{ color: 'hsl(var(--foreground))' }}>{actor.label}</span>
                    <Badge variant={badge.variant} className="shrink-0 px-1.5 py-0 text-[10px]">{badge.label}</Badge>
                  </span>
                  {actor.sublabel && (
                    <span className="flex items-center gap-1 truncate text-[11px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
                      <Icon size={10} /> {actor.sublabel}
                    </span>
                  )}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-[11px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
                {new Date(entry.created_at).toLocaleString()}
                {changeCount > 0 && <ChevronDown size={12} className={isOpen ? 'rotate-180' : ''} />}
              </span>
            </button>
            {isOpen && changeCount > 0 && (
              <div className="space-y-1.5 border-t px-3 py-2.5 text-[12px]" style={{ borderColor: 'hsl(var(--border))' }}>
                {changes.map(([field, change]) => (
                  <div key={field} className="flex items-center justify-between gap-3">
                    <span className="shrink-0" style={{ color: 'hsl(var(--muted-foreground))' }}>{fieldLabel(field)}</span>
                    <span className="truncate text-right" style={{ color: 'hsl(var(--foreground))' }}>
                      {fieldIsEnum(field) ? resolveEnumLabel(enumLabels, field, change.old) : formatFileOrValue(change.old)}
                      {' '}<span style={{ color: 'hsl(var(--muted-foreground))' }}>→</span>{' '}
                      {fieldIsEnum(field) ? resolveEnumLabel(enumLabels, field, change.new) : formatFileOrValue(change.new)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="h-7 gap-1 px-2">
              <ChevronLeft size={12} />Prev
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="h-7 gap-1 px-2">
              Next<ChevronRight size={12} />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export function LinkedRecordsTab({ formId, recordId, onNavigateToRecord }: {
  formId: string
  recordId: string
  onNavigateToRecord?: (formId: string, recordId: string) => void
}) {
  const [page, setPage] = useState(1)
  const pageSize = 10
  const { data, isLoading } = useLinkedRecords(formId, recordId, page, pageSize)

  const groups = data?.groups ?? []
  if (!isLoading && groups.length === 0) return <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>No linked records.</p>

  if (isLoading) {
    return (
      <div className="rounded-lg border" style={{ borderColor: 'hsl(var(--border))' }}>
        <DataTable columns={[{ key: '__preview', label: 'Linked records', sortable: false }]} rows={[]} getRowId={() => ''} loading />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <LinkedRecordGroupCard
          key={`${group.form_id}-${group.field_name}`}
          group={group}
          page={page}
          onPageChange={setPage}
          onNavigateToRecord={onNavigateToRecord}
        />
      ))}
    </div>
  )
}

function LinkedRecordGroupCard({ group, page, onPageChange, onNavigateToRecord }: {
  group: LinkedRecordGroup
  page: number
  onPageChange: (p: number) => void
  onNavigateToRecord?: (formId: string, recordId: string) => void
}) {
  // The target form's own field defs — needed to resolve its record-title
  // fields (see resolveRecordTitle) instead of just falling back to
  // name/label/id. group.records already carry full field values (not just
  // ids), so no per-row fetch is needed, just this one query per group.
  const { data: targetForm } = useFormDef(group.form_id)

  const totalPages = Math.max(1, Math.ceil(group.total / group.page_size))
  const columns = [{ key: '__preview', label: group.form_name, sortable: false }]
  const rows = group.records.map((r) => ({ ...r, __preview: resolveReferenceLabel(targetForm?.fields, r) }))

  return (
    <div className="rounded-lg border" style={{ borderColor: 'hsl(var(--border))' }}>
      <div className="border-b px-3 py-2 text-xs font-medium" style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}>
        {group.form_name} <span style={{ color: 'hsl(var(--muted-foreground))' }}>via {group.field_label}</span>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id as string}
        onRowClick={onNavigateToRecord ? (r) => onNavigateToRecord(group.form_id, r.id as string) : undefined}
        emptyMessage="No records."
      />
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t px-3 py-1.5 text-[11px]" style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}>
          <span>Page {group.page} of {totalPages}</span>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="h-6 gap-1 px-1.5">
              <ChevronLeft size={11} />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} className="h-6 gap-1 px-1.5">
              <ChevronRight size={11} />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
