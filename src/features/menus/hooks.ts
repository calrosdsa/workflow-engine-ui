import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { menusApi } from './api'
import type { CreateMenuPayload, UpdateMenuPayload, ReorderMenusPayload, Menu } from './types'

export const menuKeys = {
  all:    ['menus'] as const,
  detail: (id: string) => ['menus', id] as const,
}

export function useMenus() {
  return useQuery({ queryKey: menuKeys.all, queryFn: menusApi.list })
}

export function useMenu(id: string) {
  return useQuery({ queryKey: menuKeys.detail(id), queryFn: () => menusApi.get(id), enabled: !!id })
}

export function useCreateMenu() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: CreateMenuPayload) => menusApi.create(p),
    onSuccess:  () => qc.invalidateQueries({ queryKey: menuKeys.all }),
  })
}

export function useUpdateMenu(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: UpdateMenuPayload) => menusApi.update(id, p),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: menuKeys.all })
      qc.invalidateQueries({ queryKey: menuKeys.detail(id) })
    },
  })
}

export function useDeleteMenu() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => menusApi.delete(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: menuKeys.all }),
  })
}

export function useReorderMenus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: ReorderMenusPayload) => menusApi.reorder(p),
    onSuccess:  () => qc.invalidateQueries({ queryKey: menuKeys.all }),
  })
}

/** Re-parents a menu (drag-and-drop into a different Parent menu, or to
 *  root). Takes the full current Menu row rather than just an id, since
 *  UpdateMenuPayload requires the complete mutable shape (same constraint
 *  useUpdateMenu's caller already works around) — only parent_id actually
 *  changes here, everything else round-trips as-is. Reordering the new
 *  sibling group's sort_order is a separate useReorderMenus call the caller
 *  makes afterward; this hook only changes parentage. */
export function useMoveMenu() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ menu, parent_id }: { menu: Menu; parent_id: string | null }) =>
      menusApi.update(menu.id, {
        parent_id,
        menu_type: menu.menu_type,
        slug: menu.slug,
        name: menu.name,
        icon: menu.icon,
        sort_order: menu.sort_order,
        config: menu.config,
        required_permission: menu.required_permission,
      }),
    onSuccess: (_data, { menu }) => {
      qc.invalidateQueries({ queryKey: menuKeys.all })
      qc.invalidateQueries({ queryKey: menuKeys.detail(menu.id) })
    },
  })
}
