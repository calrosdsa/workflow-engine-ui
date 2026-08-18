import { api } from '@/lib/api'
import type { SavedView, SavedViewPayload } from './types'

export const savedViewsApi = {
  list: (menuId: string) => api.get(`menus/${menuId}/saved-views`).json<SavedView[]>(),
  create: (menuId: string, p: SavedViewPayload) =>
    api.post(`menus/${menuId}/saved-views`, { json: p }).json<SavedView>(),
  update: (menuId: string, id: string, p: SavedViewPayload) =>
    api.patch(`menus/${menuId}/saved-views/${id}`, { json: p }).json<SavedView>(),
  delete: async (menuId: string, id: string): Promise<void> => {
    await api.delete(`menus/${menuId}/saved-views/${id}`)
  },
}
