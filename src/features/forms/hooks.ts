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
  return useQuery({ queryKey: formKeys.detail(id), queryFn: () => formsApi.get(id) })
}

export function useCreateForm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: CreateFormPayload) => formsApi.create(p),
    onSuccess:  () => qc.invalidateQueries({ queryKey: formKeys.all }),
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
    },
  })
}

export function useDeleteForm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => formsApi.delete(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: formKeys.all }),
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

export function useDeleteRecord(formId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (recordId: string) => formsApi.deleteRecord(formId, recordId),
    onSuccess:  () => qc.invalidateQueries({ queryKey: formKeys.records(formId) }),
  })
}
