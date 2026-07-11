import { useQuery } from '@tanstack/react-query'
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
