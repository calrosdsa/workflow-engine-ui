// The record detail experience shared by the Search menu's drawer and the
// "Expand to full page" route — Details / Audit Log / Linked Records tabs.
// Takes only (formId, recordId, fields), not the whole Menu, so it's usable
// from both call sites without depending on menu context.
import { useState } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, Workflow as WorkflowIcon, User as UserIcon } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { DataTable } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { useRecordDetail, useAuditLog, useLinkedRecords } from './record-detail-hooks'
import type { FieldDef, AuditLogEntry } from '@/features/forms/types'

export function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

interface RecordDetailPanelProps {
  formId: string
  recordId: string
  fields: FieldDef[]
  /** Called with a (formId, recordId) pair when the user wants to jump to a
   *  linked record — the caller decides how to resolve that into a real
   *  navigation (e.g. finding a Search menu that targets that form). */
  onNavigateToRecord?: (formId: string, recordId: string) => void
}

export function RecordDetailPanel({ formId, recordId, fields, onNavigateToRecord }: RecordDetailPanelProps) {
  return (
    <Tabs defaultValue="details" className="flex h-full flex-col">
      <div className="border-b border-slate-100 px-6 py-2">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
          <TabsTrigger value="linked">Linked Records</TabsTrigger>
        </TabsList>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <TabsContent value="details">
          <DetailsTab formId={formId} recordId={recordId} fields={fields} />
        </TabsContent>
        <TabsContent value="audit">
          <AuditLogTab formId={formId} recordId={recordId} />
        </TabsContent>
        <TabsContent value="linked">
          <LinkedRecordsTab formId={formId} recordId={recordId} onNavigateToRecord={onNavigateToRecord} />
        </TabsContent>
      </div>
    </Tabs>
  )
}

function DetailsTab({ formId, recordId, fields }: { formId: string; recordId: string; fields: FieldDef[] }) {
  const { data: record, isLoading } = useRecordDetail(formId, recordId)
  if (isLoading) return <p className="text-sm text-slate-400">Loading…</p>
  if (!record) return <p className="text-sm text-slate-400">Record not found.</p>
  return (
    <div className="space-y-2">
      {fields.map((f) => (
        <div key={f.name} className="flex justify-between gap-4 border-b border-slate-100 py-1.5 text-sm last:border-0">
          <span className="text-slate-500">{f.label}</span>
          <span className="text-right text-slate-800">{formatValue(record[f.name])}</span>
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

  if (isLoading) return <p className="text-sm text-slate-400">Loading…</p>
  const entries = data?.entries ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  if (entries.length === 0) return <p className="text-sm text-slate-400">No audit history yet.</p>

  return (
    <div className="space-y-2">
      {entries.map((entry) => {
        const actor = actorLabel(entry)
        const Icon = actor.icon
        const isOpen = expanded === entry.id
        const changeCount = entry.field_changes ? Object.keys(entry.field_changes).length : 0
        return (
          <div key={entry.id} className="rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : entry.id)}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50"
            >
              <span className="flex items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium uppercase text-slate-600">
                  {entry.action}
                </span>
                <span className="flex items-center gap-1 text-slate-500">
                  <Icon size={12} /> {actor.label}
                </span>
              </span>
              <span className="flex items-center gap-2 text-[11px] text-slate-400">
                {new Date(entry.created_at).toLocaleString()}
                {changeCount > 0 && <ChevronDown size={12} className={isOpen ? 'rotate-180' : ''} />}
              </span>
            </button>
            {isOpen && changeCount > 0 && (
              <div className="space-y-1 border-t border-slate-100 px-3 py-2 text-[12px]">
                {Object.entries(entry.field_changes!).map(([field, change]) => (
                  <div key={field} className="flex justify-between gap-3">
                    <span className="text-slate-500">{field}</span>
                    <span className="text-slate-700">
                      {formatValue(change.old)} <span className="text-slate-300">→</span> {formatValue(change.new)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 text-xs text-slate-400">
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
  if (!isLoading && groups.length === 0) return <p className="text-sm text-slate-400">No linked records.</p>

  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-200">
        <DataTable columns={[{ key: '__preview', label: 'Linked records', sortable: false }]} rows={[]} getRowId={() => ''} loading />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const totalPages = Math.max(1, Math.ceil(group.total / group.page_size))
        const columns = [{ key: '__preview', label: group.form_name, sortable: false }]
        const rows = group.records.map((r) => ({ ...r, __preview: previewValue(r) }))
        return (
          <div key={`${group.form_id}-${group.field_name}`} className="rounded-lg border border-slate-200">
            <div className="border-b border-slate-100 px-3 py-2 text-xs font-medium text-slate-600">
              {group.form_name} <span className="text-slate-400">via {group.field_label}</span>
            </div>
            <DataTable
              columns={columns}
              rows={rows}
              getRowId={(r) => r.id as string}
              onRowClick={onNavigateToRecord ? (r) => onNavigateToRecord(group.form_id, r.id as string) : undefined}
              emptyMessage="No records."
            />
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 px-3 py-1.5 text-[11px] text-slate-400">
                <span>Page {group.page} of {totalPages}</span>
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="h-6 gap-1 px-1.5">
                    <ChevronLeft size={11} />
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="h-6 gap-1 px-1.5">
                    <ChevronRight size={11} />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function previewValue(r: Record<string, unknown>): string {
  return (r.name as string) ?? (r.label as string) ?? (r.id as string)
}
