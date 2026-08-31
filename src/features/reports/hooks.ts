import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { reportsApi, type CreateReportPayload } from './api'

export const reportKeys = {
  all: ['report-definitions'] as const,
  detail: (id: string) => ['report-definitions', id] as const,
}

export function useReports() {
  return useQuery({ queryKey: reportKeys.all, queryFn: reportsApi.list })
}

export function useReport(id: string) {
  return useQuery({ queryKey: reportKeys.detail(id), queryFn: () => reportsApi.get(id), enabled: !!id })
}

export function useCreateReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: CreateReportPayload) => reportsApi.create(p),
    onSuccess:  () => qc.invalidateQueries({ queryKey: reportKeys.all }),
  })
}

export function useUpdateReport(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: CreateReportPayload) => reportsApi.update(id, p),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: reportKeys.all })
      qc.invalidateQueries({ queryKey: reportKeys.detail(id) })
    },
  })
}

export function useDeleteReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => reportsApi.delete(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: reportKeys.all }),
  })
}
