import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { savedViewsApi } from './api'
import type { SavedViewPayload } from './types'

export const savedViewKeys = {
  all: (menuId: string) => ['menus', menuId, 'saved-views'] as const,
}

export function useSavedViews(menuId: string | undefined) {
  return useQuery({
    queryKey: savedViewKeys.all(menuId ?? ''),
    queryFn: () => savedViewsApi.list(menuId!),
    enabled: !!menuId,
  })
}

export function useCreateSavedView(menuId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: SavedViewPayload) => savedViewsApi.create(menuId, p),
    onSuccess: () => qc.invalidateQueries({ queryKey: savedViewKeys.all(menuId) }),
  })
}

export function useUpdateSavedView(menuId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: SavedViewPayload }) =>
      savedViewsApi.update(menuId, id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: savedViewKeys.all(menuId) }),
  })
}

export function useDeleteSavedView(menuId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => savedViewsApi.delete(menuId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: savedViewKeys.all(menuId) }),
  })
}
