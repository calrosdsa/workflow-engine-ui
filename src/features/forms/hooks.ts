import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formsApi } from './api'
import type { CreateFormPayload, UpdateFormPayload, FormRecord, FormDefinition } from './types'

export const formKeys = {
  all:     ['forms'] as const,
  detail:  (id: string) => ['forms', id] as const,
  records: (id: string) => ['forms', id, 'records'] as const,
  record:  (fid: string, rid: string) => ['forms', fid, 'records', rid] as const,
}

export function useForms() {
  return useQuery({ queryKey: formKeys.all, queryFn: formsApi.list })
}

export function useForm(id: string) {
  return useQuery({ queryKey: formKeys.detail(id), queryFn: () => formsApi.get(id), enabled: !!id })
}

export function useCreateForm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: CreateFormPayload) => formsApi.create(p),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: formKeys.all })
      // A new form adds View/Create/Edit/Delete entries to the per-form
      // permission catalog (see features/permissions/hooks.ts).
      qc.invalidateQueries({ queryKey: ['permissions'] })
    },
  })
}

export function useUpdateForm(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: UpdateFormPayload) => formsApi.update(id, p),
    // Optimistically reflect name/slug/description renames immediately so the
    // header and list update without waiting for a refetch.
    onMutate: async (p: UpdateFormPayload) => {
      await qc.cancelQueries({ queryKey: formKeys.detail(id) })
      const prev = qc.getQueryData<FormDefinition>(formKeys.detail(id))
      if (prev) {
        qc.setQueryData<FormDefinition>(formKeys.detail(id), {
          ...prev, name: p.name, slug: p.slug, description: p.description,
        })
      }
      return { prev }
    },
    onError: (_e, _p, ctx) => {
      if (ctx?.prev) qc.setQueryData(formKeys.detail(id), ctx.prev)
    },
    onSettled:  () => {
      qc.invalidateQueries({ queryKey: formKeys.all })
      qc.invalidateQueries({ queryKey: formKeys.detail(id) })
      // The form's name may have changed, and the per-form catalog's labels
      // ("Items: View records") are derived from it.
      qc.invalidateQueries({ queryKey: ['permissions'] })
    },
  })
}

export function useDeleteForm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => formsApi.delete(id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: formKeys.all })
      qc.invalidateQueries({ queryKey: ['permissions'] })
    },
  })
}

/** "Copy Form" — duplicates a form (fresh id/table/columns, "-copy" slug)
 *  under the same parent. */
export function useCopyForm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => formsApi.copy(id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: formKeys.all })
      qc.invalidateQueries({ queryKey: ['permissions'] })
    },
  })
}

/** "Unlink Dependent Form" — detaches a form from its parent without deleting it. */
export function useUnlinkForm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => formsApi.unlink(id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: formKeys.all })
      qc.invalidateQueries({ queryKey: ['permissions'] })
    },
  })
}

/** "Share This Form In Other Apps" — clones the definition into another app
 *  under the same client. */
export function useShareForm() {
  return useMutation({
    mutationFn: ({ id, targetAppId }: { id: string; targetAppId: string }) => formsApi.share(id, targetAppId),
  })
}

export function useFormRecords(formId: string) {
  return useQuery({
    queryKey: formKeys.records(formId),
    queryFn:  () => formsApi.listRecords(formId),
  })
}

export function useCreateRecord(formId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: FormRecord) => formsApi.createRecord(formId, data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: formKeys.records(formId) }),
  })
}

export function useUpdateRecord(formId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ recordId, data }: { recordId: string; data: FormRecord }) => formsApi.updateRecord(formId, recordId, data),
    // Invalidates the whole ['forms', formId, ...] prefix — React Query's
    // default partial matching catches both the plain records list and every
    // parameterized Search menu query (['forms', formId, 'search', filter,
    // sort, page, pageSize]), not just formKeys.records(formId) itself.
    onSuccess: (_result, { recordId }) => {
      qc.invalidateQueries({ queryKey: formKeys.detail(formId) })
      qc.invalidateQueries({ queryKey: formKeys.record(formId, recordId) })
    },
  })
}

export function useDeleteRecord(formId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (recordId: string) => formsApi.deleteRecord(formId, recordId),
    onSuccess:  () => qc.invalidateQueries({ queryKey: formKeys.detail(formId) }),
  })
}
