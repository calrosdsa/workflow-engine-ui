// The record detail experience shared by the Search menu's drawer and the
// "Expand to full page" route — Details / Audit Log / Linked Records tabs.
// Takes only (formId, recordId, fields), not the whole Menu, so it's usable
// from both call sites without depending on menu context.
import { useState, useEffect } from 'react'
import {
  ChevronLeft, ChevronRight, ChevronDown, Pencil, Trash2, Workflow as WorkflowIcon, User as UserIcon,
  RotateCw, XCircle, UserPlus, History,
} from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { DataTable } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PermissionGate } from '@/features/auth/PermissionGate'
import { useUpdateRecord, useDeleteRecord } from '@/features/forms/hooks'
import {
  useRecordDetail, useAuditLog, useLinkedRecords,
  useRecordAccountStatus, useResendRecordInvite, useRemoveRecordAccess, useEnableRecordAccess,
} from './record-detail-hooks'
import { FormRenderer } from './FormRenderer'
import { LineItemsGrid } from './LineItemsGrid'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EnableAccountDialog } from './EnableAccountDialog'
import { COLUMN_LAYOUTS } from '@/features/form-builder/schema'
import { COMPONENT_REGISTRY } from '@/features/form-builder/component-registry'
import { formatValue } from './format-value'
import { resolveReferenceLabel } from './record-title'
import { ReferenceValueLabel } from './ReferenceValueLabel'
import { buildEnumLabels, resolveEnumLabel } from './enum-labels'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useTeamUsers } from '@/features/users/hooks'
import type { TeamUser } from '@/features/users/types'
import { useForm as useFormDef } from '@/features/forms/hooks'
import { resolveDetailTabs, getDetailTab } from './detail-tabs/registry'
import { useCurrentViewer, isTabVisible } from './detail-tabs/useTabVisible'
import { useExpressionRuntimeState, schemaToVariableDecls } from './expression-context'
import './detail-tabs'
import type { FormSchema } from '@/features/form-builder/schema'
import type { FieldDef, AuditLogEntry, AuditFieldChange, FormRecord, LinkedRecordGroup } from '@/features/forms/types'

export { formatValue }

interface RecordDetailPanelProps {
  formId: string
  recordId: string
  fields: FieldDef[]
  /** The form's builder layout (sections/columns). When provided, the
   *  Details tab mirrors the same section/column arrangement configured in
   *  the form designer instead of falling back to a flat field list, and
   *  edit mode (Edit button / per-field pencils) becomes available — editing
   *  reuses FormRenderer, which requires the real schema to render inputs. */
  schema?: FormSchema
  /** Called with a (formId, recordId) pair when the user wants to jump to a
   *  linked record — the caller decides how to resolve that into a real
   *  navigation (e.g. finding a Search menu that targets that form). */
  onNavigateToRecord?: (formId: string, recordId: string) => void
  /** Called after a successful delete so the caller can close the drawer /
   *  navigate back to the list — the panel itself has no navigation context. */
  onDeleted?: () => void
}

export function RecordDetailPanel({ formId, recordId, fields, schema, onNavigateToRecord, onDeleted }: RecordDetailPanelProps) {
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [confirmingRemoveAccess, setConfirmingRemoveAccess] = useState(false)
  const [enablingAccount, setEnablingAccount] = useState(false)
  const canEdit = !!schema && schema.sections.length > 0
  const createUserSettings = schema?.settings?.createUser
  const accountEnabled = !!createUserSettings?.enabled

  const updateRecord = useUpdateRecord(formId)
  const deleteRecord = useDeleteRecord(formId)
  const { data: record } = useRecordDetail(formId, recordId)
  const { data: accountStatus } = useRecordAccountStatus(formId, recordId, accountEnabled)
  const resendInvite = useResendRecordInvite(formId, recordId)
  const removeAccess = useRemoveRecordAccess(formId, recordId)
  const enableAccess = useEnableRecordAccess(formId, recordId)

  const viewer = useCurrentViewer()
  const configuredTabs = resolveDetailTabs(schema?.settings?.detailTabs).filter(
    (t) => !t.hidden && isTabVisible(t.visibility, viewer),
  )
  const variables = schema ? schemaToVariableDecls(schema) : []
  const renderIfExpressions = configuredTabs
    .filter((t) => t.renderIf?.mode === 'expression' && !!t.renderIf.expressionWhen)
    .map((t) => ({ key: t.id, kind: 'visibleWhen' as const, expr: t.renderIf!.expressionWhen }))
  const renderIfResolved = useExpressionRuntimeState(renderIfExpressions, variables, record ?? {})
  // Deliberately `?? false`, not useExpressionRuntimeState's own field-level
  // DEFAULT_STATE.visible=true — a whole tab flashing in/out during the
  // 250ms debounce window (or staying visible on an invalid expression) is
  // more disruptive than a single field's visibility flickering, so a tab's
  // renderIf fails closed (hidden) until a real, resolved `true` comes back,
  // per FR-D2-015 §6's edge-case row for this exact scenario.
  const renderableTabs = configuredTabs.filter((t) => {
    if (t.renderIf?.mode !== 'expression' || !t.renderIf.expressionWhen) return true
    return renderIfResolved[t.id]?.visible ?? false
  })

  // hideWhenEmpty (related_form only, FR-D2-015 §3) can only resolve AFTER
  // that tab's own Renderer has fetched its data — unlike visibility/
  // renderIf, which are known before any tab-specific content mounts. Every
  // tab renders optimistically at first; a related_form tab configured with
  // hideWhenEmpty reports back via onEmptyResolved once its own existence
  // check settles, and is retroactively dropped from BOTH the trigger list
  // and the content below — a brief flash-then-hide, not a permanent gap,
  // and the only tradeoff of not being able to know "is it empty" before
  // that tab's own Renderer has had a chance to ask.
  const [emptyTabIds, setEmptyTabIds] = useState<Set<string>>(new Set())
  const visibleTabs = renderableTabs.filter((t) => !emptyTabIds.has(t.id))

  // Reacts to the mutation's own settled state via an effect rather than a
  // mutate()-call callback or an awaited mutateAsync() continuation — traced
  // to formsApi.deleteRecord returning ky's raw, unconsumed ResponsePromise:
  // the DELETE's HTTP request completed (204) but the mutation's own
  // isPending/isSuccess never flipped since nothing ever awaited/consumed
  // that response (see api.ts's deleteRecord, now fixed to await it
  // directly). Watching `deleteRecord.isSuccess` here is the robust way to
  // react to the fix — it fires from this component's own next render once
  // React Query actually flags the mutation successful.
  useEffect(() => {
    if (deleteRecord.isSuccess) {
      onDeleted?.()
      setConfirmingDelete(false)
    }
    // onDeleted intentionally excluded — call sites pass a fresh inline
    // function each render, and re-running this effect for that alone would
    // re-fire onDeleted every time the parent re-renders after the mutation
    // already succeeded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deleteRecord.isSuccess])

  const handleDelete = () => {
    if (deleteRecord.isPending) return
    deleteRecord.mutate(recordId)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Keyed on the resolved visible-tab-id list, not just formId — if a
         renderIf expression resolves AFTER first paint (the debounced
         backend round-trip) and changes which tabs are visible, the
         underlying Radix Tabs' own internal "which value is active" state
         needs a fresh mount to re-derive a valid defaultValue, or it can end
         up pointed at a tab that no longer exists in the list. */}
      <Tabs key={visibleTabs.map((t) => t.id).join(',') || 'empty'} defaultValue={visibleTabs[0]?.id} className="flex min-h-0 flex-1 flex-col">
        <div className="border-b px-6 py-2" style={{ borderColor: 'hsl(var(--border))' }}>
          <TabsList>
            {visibleTabs.map((t) => {
              const def = getDetailTab(t.type)
              return (
                <TabsTrigger key={t.id} value={t.id}>
                  {t.label || def?.label || t.type}
                </TabsTrigger>
              )
            })}
          </TabsList>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {/* Every renderableTab mounts its Renderer (not just visibleTabs)
             so a hideWhenEmpty related_form tab's own existence-check query
             keeps running even while its trigger/content chrome is hidden —
             the moment new data makes it non-empty, it reappears without a
             second, separate polling mechanism. Chrome visibility
             (TabsTrigger above, and the wrapper div's display here) is the
             ONLY thing emptiness affects; the Renderer itself always mounts. */}
          {renderableTabs.map((t) => {
            const def = getDetailTab(t.type)
            if (!def) return null
            const config = def.parseConfig(t.config)
            const isVisible = !emptyTabIds.has(t.id)
            return (
              <TabsContent key={t.id} value={t.id} forceMount style={isVisible ? undefined : { display: 'none' }}>
                <def.Renderer
                  formId={formId}
                  recordId={recordId}
                  fields={fields}
                  schema={schema}
                  config={config}
                  onNavigateToRecord={onNavigateToRecord}
                  editing={editing && canEdit}
                  onStartEdit={() => setEditing(true)}
                  onSubmitEdit={async (values) => {
                    await updateRecord.mutateAsync({ recordId, data: values })
                    setEditing(false)
                  }}
                  onCancelEdit={() => setEditing(false)}
                  submittingEdit={updateRecord.isPending}
                  onEmptyResolved={(empty) => {
                    setEmptyTabIds((prev) => {
                      if (empty === prev.has(t.id)) return prev
                      const next = new Set(prev)
                      if (empty) next.add(t.id)
                      else next.delete(t.id)
                      return next
                    })
                  }}
                />
              </TabsContent>
            )
          })}
        </div>
      </Tabs>

      {canEdit && !editing && (
        <div className="flex items-center justify-end gap-2 border-t px-6 py-3" style={{ borderColor: 'hsl(var(--border))' }}>
          {accountEnabled && (
            <PermissionGate need={`forms:${formId}:edit`}>
              {accountStatus?.status === 'pending' && (
                <Button
                  variant="outline" size="sm" className="gap-1.5"
                  disabled={resendInvite.isPending}
                  onClick={() => resendInvite.mutate()}
                >
                  <RotateCw size={13} />Resend Invite
                </Button>
              )}
              {accountStatus?.status === 'active' && (
                <Button
                  variant="outline" size="sm" className="gap-1.5 text-red-500 hover:bg-red-50 hover:text-red-700"
                  onClick={() => setConfirmingRemoveAccess(true)}
                >
                  <XCircle size={13} />Remove Login Access
                </Button>
              )}
              {accountStatus?.status === 'removed' && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEnablingAccount(true)}>
                  <UserPlus size={13} />Enable Account
                </Button>
              )}
            </PermissionGate>
          )}
          <PermissionGate need={`forms:${formId}:delete`}>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setConfirmingDelete(true)}>
              <Trash2 size={13} />Delete
            </Button>
          </PermissionGate>
          <PermissionGate need={`forms:${formId}:edit`}>
            <Button size="sm" className="gap-1.5" onClick={() => setEditing(true)}>
              <Pencil size={13} />Edit
            </Button>
          </PermissionGate>
        </div>
      )}

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title="Delete this record?"
        description="This action can't be undone."
        confirmLabel="Delete"
        destructive
        loading={deleteRecord.isPending}
        onConfirm={handleDelete}
        container={document.getElementById('runtime-root')}
      />

      <ConfirmDialog
        open={confirmingRemoveAccess}
        onOpenChange={setConfirmingRemoveAccess}
        title="Remove login access?"
        description="This person will no longer be able to log in. You can re-enable access later."
        confirmLabel="Remove Access"
        destructive
        loading={removeAccess.isPending}
        onConfirm={async () => {
          await removeAccess.mutateAsync()
          setConfirmingRemoveAccess(false)
        }}
        container={document.getElementById('runtime-root')}
      />

      <EnableAccountDialog
        open={enablingAccount}
        onOpenChange={setEnablingAccount}
        defaultEmail={createUserSettings?.emailFieldKey ? (record?.[createUserSettings.emailFieldKey] as string | undefined) : undefined}
        loading={enableAccess.isPending}
        onConfirm={async (data) => {
          await enableAccess.mutateAsync(data)
          setEnablingAccount(false)
        }}
        container={document.getElementById('runtime-root')}
      />
    </div>
  )
}

export function DetailsTab({ formId, recordId, fields, schema, editing, onStartEdit, onSubmit, onCancelEdit, submitting }: {
  formId: string
  recordId: string
  fields: FieldDef[]
  schema?: FormSchema
  editing: boolean
  onStartEdit: () => void
  onSubmit: (values: FormRecord) => void | Promise<void>
  onCancelEdit: () => void
  submitting: boolean
}) {
  const { data: record, isLoading } = useRecordDetail(formId, recordId)
  if (isLoading) return <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>Loading…</p>
  if (!record) return <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>Record not found.</p>

  if (editing && schema && schema.sections.length > 0) {
    return (
      <div className="space-y-3">
        <FormRenderer schema={schema} fields={fields} formId={formId} defaultValues={record} onSubmit={onSubmit} submitting={submitting} submitLabel="Save" />
        <Button variant="outline" size="sm" onClick={onCancelEdit} disabled={submitting}>Cancel</Button>
      </div>
    )
  }

  if (schema && schema.sections.length > 0) {
    return (
      <div className="space-y-6">
        {schema.sections.map((section) => (
          <div key={section.id}>
            {section.title && <h3 className="mb-3 text-sm font-semibold" style={{ color: 'hsl(var(--foreground))' }}>{section.title}</h3>}
            {section.description && <p className="mb-3 text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>{section.description}</p>}
            <div className="flex gap-4">
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
                const visibleElements = column.elements.filter((el) => {
                  if (el.component === 'hidden') return false
                  if (el.component === 'line_items') return el.sourceMode === 'existing'
                  return COMPONENT_REGISTRY[el.component].dataBearing
                })
                return (
                  <div key={column.id} className="space-y-3" style={{ flex: ratios[idx] ?? 1 }}>
                    {visibleElements.map((el) => (
                      <div key={el.id} className="group text-sm">
                        <div className="mb-1 flex items-center gap-1.5 text-xs font-medium" style={{ color: 'hsl(var(--muted-foreground))' }}>
                          {el.label}
                          {el.component !== 'line_items' && (
                            <PermissionGate need={`forms:${formId}:edit`}>
                              <button
                                type="button"
                                onClick={onStartEdit}
                                className="opacity-0 transition-opacity hover:text-[hsl(var(--foreground))] group-hover:opacity-100 focus-visible:opacity-100"
                                aria-label={`Edit ${el.label}`}
                              >
                                <Pencil size={11} />
                              </button>
                            </PermissionGate>
                          )}
                        </div>
                        {el.component === 'line_items' ? (
                          <LineItemsGrid el={el} field={{ value: record[el.key], onChange: () => {} }} parentFormId={formId} disabled />
                        ) : el.component === 'form' ? (
                          <div style={{ color: 'hsl(var(--foreground))' }}>
                            <ReferenceValueLabel formId={el.formRef} recordId={record[el.key]} displayField={el.displayField} />
                          </div>
                        ) : (
                          <div style={{ color: 'hsl(var(--foreground))' }}>{formatValue(record[el.key])}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
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
            ) : (
              formatValue(record[f.name])
            )}
          </div>
        </div>
      ))}
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

  const fieldLabel = (key: string) => fields.find((f) => f.name === key)?.label ?? key
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
                      {fieldIsEnum(field) ? resolveEnumLabel(enumLabels, field, change.old) : formatValue(change.old)}
                      {' '}<span style={{ color: 'hsl(var(--muted-foreground))' }}>→</span>{' '}
                      {fieldIsEnum(field) ? resolveEnumLabel(enumLabels, field, change.new) : formatValue(change.new)}
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
