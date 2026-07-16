import { api } from '@/lib/api'

export interface Notification {
  id: string
  title: string
  body?: string
  severity: 'info' | 'success' | 'warning' | 'error'
  link_url?: string
  read_at?: string
  created_at: string
}

export const notificationsApi = {
  list: (unreadOnly?: boolean) => {
    const url = unreadOnly ? 'notifications?unread_only=true' : 'notifications'
    return api.get(url).json<Notification[]>()
  },

  unreadCount: () =>
    api.get('notifications/unread-count').json<{ unread_count: number }>(),

  markRead: (id: string) => api.post(`notifications/${id}/read`),

  markAllRead: () => api.post('notifications/read-all'),
}
