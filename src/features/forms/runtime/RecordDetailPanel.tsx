// The record detail experience shared by the Search menu's drawer and the
// "Expand to full page" route — Details / Audit Log / Linked Records tabs.
// Takes only (formId, recordId, fields), not the whole Menu, so it's usable
// from both call sites without depending on menu context.
import { useState, useEffect } from 'react'
import {
  ChevronLeft, ChevronRight, ChevronDown, Pencil, Trash2, Workflow as WorkflowIcon, User as UserIcon,
  RotateCw, XCircle, UserPlus,
} from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { DataTable } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
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
import { useForm as useFormDef } from '@/features/forms/hooks'
import type { FormSchema } from '@/features/form-builder/schema'
import type { FieldDef, AuditLogEntry, FormRecord, LinkedRecordGroup } from '@/features/forms/types'

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
      <Tabs defaultValue="details" className="flex min-h-0 flex-1 flex-col">
        <div className="border-b px-6 py-2" style={{ borderColor: 'hsl(var(--border))' }}>
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="audit">Audit Log</TabsTrigger>
            <TabsTrigger value="linked">Linked Records</TabsTrigger>
          </TabsList>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <TabsContent value="details">
            <DetailsTab
              formId={formId}
              recordId={recordId}
              fields={fields}
              schema={schema}
              editing={editing && canEdit}
              onStartEdit={() => setEditing(true)}
              onSubmit={async (values) => {
                await updateRecord.mutateAsync({ recordId, data: values })
                setEditing(false)
              }}
              onCancelEdit={() => setEditing(false)}
              submitting={updateRecord.isPending}
            />
          </TabsContent>
          <TabsContent value="audit">
            <AuditLogTab formId={formId} recordId={recordId} />
          </TabsContent>
          <TabsContent value="linked">
            <LinkedRecordsTab formId={formId} recordId={recordId} onNavigateToRecord={onNavigateToRecord} />
          </TabsContent>
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

function DetailsTab({ formId, recordId, fields, schema, editing, onStartEdit, onSubmit, onCancelEdit, submitting }: {
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

function actorLabel(entry: AuditLogEntry): { icon: typeof UserIcon; label: string } {
  if (entry.actor_workflow_execution_id) return { icon: WorkflowIcon, label: 'Workflow' }
  if (entry.actor_user_id) return { icon: UserIcon, label: entry.actor_user_id }
  return { icon: UserIcon, label: 'Unknown' }
}

function AuditLogTab({ formId, recordId }: { formId: string; recordId: string }) {
  const [page, setPage] = useState(1)
  const pageSize = 25
  const { data, isLoading } = useAuditLog(formId, recordId, page, pageSize)
  const [expanded, setExpanded] = useState<string | null>(null)

  if (isLoading) return <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>Loading…</p>
  const entries = data?.entries ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  if (entries.length === 0) return <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>No audit history yet.</p>

  return (
    <div className="space-y-2">
      {entries.map((entry) => {
        const actor = actorLabel(entry)
        const Icon = actor.icon
        const isOpen = expanded === entry.id
        const changeCount = entry.field_changes ? Object.keys(entry.field_changes).length : 0
        return (
          <div key={entry.id} className="rounded-lg border" style={{ borderColor: 'hsl(var(--border))' }}>
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : entry.id)}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-[hsl(var(--accent))]"
            >
              <span className="flex items-center gap-2">
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-medium uppercase"
                  style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }}
                >
                  {entry.action}
                </span>
                <span className="flex items-center gap-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  <Icon size={12} /> {actor.label}
                </span>
              </span>
              <span className="flex items-center gap-2 text-[11px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
                {new Date(entry.created_at).toLocaleString()}
                {changeCount > 0 && <ChevronDown size={12} className={isOpen ? 'rotate-180' : ''} />}
              </span>
            </button>
            {isOpen && changeCount > 0 && (
              <div className="space-y-1 border-t px-3 py-2 text-[12px]" style={{ borderColor: 'hsl(var(--border))' }}>
                {Object.entries(entry.field_changes!).map(([field, change]) => (
                  <div key={field} className="flex justify-between gap-3">
                    <span style={{ color: 'hsl(var(--muted-foreground))' }}>{field}</span>
                    <span style={{ color: 'hsl(var(--foreground))' }}>
                      {formatValue(change.old)} <span style={{ color: 'hsl(var(--muted-foreground))' }}>→</span> {formatValue(change.new)}
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

function LinkedRecordsTab({ formId, recordId, onNavigateToRecord }: {
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
