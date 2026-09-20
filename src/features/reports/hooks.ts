import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { reportsApi, metaApi, type CreateReportPayload } from './api'
import type { ExportFormat } from './types'

export const reportKeys = {
  all: ['report-definitions'] as const,
  detail: (id: string) => ['report-definitions', id] as const,
}

// Static per-deployment data (which writer is registered for which format),
// not per-report — a long staleTime avoids refetching this on every report
// the author opens, since it can only change on a redeploy.
export function useRendererCapabilities() {
  return useQuery({
    queryKey: ['meta', 'catalog', 'renderer-capabilities'],
    queryFn: metaApi.rendererCapabilities,
    staleTime: 5 * 60 * 1000,
  })
}

// Same static-per-deployment reasoning as useRendererCapabilities above —
// RF-401's template picker source.
export function useReportExamples() {
  return useQuery({
    queryKey: ['meta', 'catalog', 'report-examples'],
    queryFn: metaApi.examples,
    staleTime: 5 * 60 * 1000,
  })
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

// A mutation, not a query, matching this codebase's own convention for a
// POST-with-arbitrary-body compute endpoint (see useQueryKnowledgeBase in
// features/knowledge/hooks.ts) — argument values change per invocation and
// aren't a natural cache key, and the caller wants explicit trigger-on-click
// (mutate/mutateAsync) rather than eager fetch-on-render.
export function useRuntimeReport(reportId: string) {
  return useMutation({
    mutationFn: (argumentValues?: Record<string, unknown>) => reportsApi.runtime(reportId, argumentValues),
  })
}

// Same mutation reasoning as useRuntimeReport above — a trigger-on-click
// download, not cacheable query state. Backs the runtime viewer's own
// Download button.
export function useExportReport(reportId: string) {
  return useMutation({
    mutationFn: ({ format, argumentValues }: { format?: ExportFormat; argumentValues?: Record<string, unknown> }) =>
      reportsApi.export(reportId, format, argumentValues),
  })
}
