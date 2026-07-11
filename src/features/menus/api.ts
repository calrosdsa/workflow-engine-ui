import { api } from '@/lib/api'
import type { Menu, CreateMenuPayload, UpdateMenuPayload, ReorderMenusPayload } from './types'

export const menusApi = {
  list:    () => api.get('menus').json<Menu[]>(),
  get:     (id: string) => api.get(`menus/${id}`).json<Menu>(),
  create:  (p: CreateMenuPayload) => api.post('menus', { json: p }).json<Menu>(),
  update:  (id: string, p: UpdateMenuPayload) => api.put(`menus/${id}`, { json: p }).json<Menu>(),
  delete:  (id: string) => api.delete(`menus/${id}`),
  reorder: (p: ReorderMenusPayload) => api.post('menus/reorder', { json: p }),
}
