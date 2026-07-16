import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formsApi } from '@/features/forms/api'

/** Shared query key so the drawer and the full-page "expand" route reuse the
 *  same cache entry for a given record. */
export function useRecordDetail(formId: string, recordId: string | null) {
  return useQuery({
    queryKey: ['forms', formId, 'records', recordId],
    queryFn: () => formsApi.getRecord(formId, recordId!),
    enabled: !!recordId,
  })
}

export function useAuditLog(formId: string, recordId: string | null, page: number, pageSize: number) {
  return useQuery({
    queryKey: ['forms', formId, 'records', recordId, 'audit', page, pageSize],
    queryFn: () => formsApi.getRecordAuditLog(formId, recordId!, { page, page_size: pageSize }),
    enabled: !!recordId,
  })
}

export function useLinkedRecords(formId: string, recordId: string | null, page: number, pageSize: number) {
  return useQuery({
    queryKey: ['forms', formId, 'records', recordId, 'linked', page, pageSize],
    queryFn: () => formsApi.getLinkedRecords(formId, recordId!, { page, page_size: pageSize }),
    enabled: !!recordId,
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
