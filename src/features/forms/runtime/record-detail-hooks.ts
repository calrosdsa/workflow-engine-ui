import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formsApi } from '@/features/forms/api'
import { PREVIEW_RECORD_ID } from './preview-sentinel'

/** True for the Detail Page Builder preview's sentinel record id — every
 *  hook below gates `enabled` on this IN ADDITION TO its existing
 *  `!!recordId` check, the one airtight way to guarantee a real fetch
 *  never fires for preview data (see preview-sentinel.ts's own doc
 *  comment for why a cache-seeding-only approach isn't reliable enough:
 *  `enabled: false` means React Query never calls queryFn at all, no
 *  staleTime/in-flight-fetch race possible). DetailPagePreview.tsx still
 *  seeds the cache for this id via setQueryData so the UI shows real
 *  (fabricated) content — this check is what stops a real network
 *  request from ever being attempted in the first place. */
const isPreviewRecord = (recordId: string | null) => recordId === PREVIEW_RECORD_ID

/** Shared query key so the drawer and the full-page "expand" route reuse the
 *  same cache entry for a given record. */
export function useRecordDetail(formId: string, recordId: string | null) {
  return useQuery({
    queryKey: ['forms', formId, 'records', recordId],
    queryFn: () => formsApi.getRecord(formId, recordId!),
    enabled: !!recordId && !isPreviewRecord(recordId),
  })
}

export function useAuditLog(formId: string, recordId: string | null, page: number, pageSize: number) {
  return useQuery({
    queryKey: ['forms', formId, 'records', recordId, 'audit', page, pageSize],
    queryFn: () => formsApi.getRecordAuditLog(formId, recordId!, { page, page_size: pageSize }),
    enabled: !!recordId && !isPreviewRecord(recordId),
  })
}

export function useLinkedRecords(formId: string, recordId: string | null, page: number, pageSize: number) {
  return useQuery({
    queryKey: ['forms', formId, 'records', recordId, 'linked', page, pageSize],
    queryFn: () => formsApi.getLinkedRecords(formId, recordId!, { page, page_size: pageSize }),
    enabled: !!recordId && !isPreviewRecord(recordId),
  })
}

// --- comments (FR-D2-016) ---

const commentsKey = (formId: string, recordId: string | null, page: number, pageSize: number) =>
  ['forms', formId, 'records', recordId, 'comments', page, pageSize]

export function useComments(formId: string, recordId: string | null, page: number, pageSize: number) {
  return useQuery({
    queryKey: commentsKey(formId, recordId, page, pageSize),
    queryFn: () => formsApi.getComments(formId, recordId!, { page, page_size: pageSize }),
    enabled: !!recordId && !isPreviewRecord(recordId),
  })
}

/** Invalidates every page of this record's comment list — simpler than
 *  patching the paginated cache in place, and comment threads are small
 *  enough that a refetch is cheap. */
function invalidateComments(qc: ReturnType<typeof useQueryClient>, formId: string, recordId: string) {
  qc.invalidateQueries({ queryKey: ['forms', formId, 'records', recordId, 'comments'] })
}

export function useCreateComment(formId: string, recordId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: string) => formsApi.createComment(formId, recordId, body),
    onSuccess: () => invalidateComments(qc, formId, recordId),
  })
}

export function useUpdateComment(formId: string, recordId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ commentId, body }: { commentId: string; body: string }) =>
      formsApi.updateComment(formId, recordId, commentId, body),
    onSuccess: () => invalidateComments(qc, formId, recordId),
  })
}

export function useDeleteComment(formId: string, recordId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (commentId: string) => formsApi.deleteComment(formId, recordId, commentId),
    onSuccess: () => invalidateComments(qc, formId, recordId),
  })
}

// --- record-detail account actions (create_user_on_submit forms) ---

const accountStatusKey = (formId: string, recordId: string | null) => ['forms', formId, 'records', recordId, 'account']

/** enabled should be schema?.settings?.createUser?.enabled — skips the fetch
 *  entirely for forms that never had the setting on, rather than hitting the
 *  endpoint just to learn every record reports "none". */
export function useRecordAccountStatus(formId: string, recordId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: accountStatusKey(formId, recordId),
    queryFn: () => formsApi.getRecordAccountStatus(formId, recordId!),
    enabled: enabled && !!recordId,
  })
}

export function useResendRecordInvite(formId: string, recordId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => formsApi.resendRecordInvite(formId, recordId),
    onSuccess: (result) => qc.setQueryData(accountStatusKey(formId, recordId), result),
  })
}

export function useRemoveRecordAccess(formId: string, recordId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => formsApi.removeRecordAccess(formId, recordId),
    onSuccess: (result) => qc.setQueryData(accountStatusKey(formId, recordId), result),
  })
}

export function useEnableRecordAccess(formId: string, recordId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { email: string; role_id: string }) => formsApi.enableRecordAccess(formId, recordId, data),
    onSuccess: (result) => qc.setQueryData(accountStatusKey(formId, recordId), result),
  })
}
