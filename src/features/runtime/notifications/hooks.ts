import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from './api'

const notificationKeys = {
  unreadCount: ['runtime-notifications', 'unread-count'] as const,
  list: (unreadOnly?: boolean) => ['runtime-notifications', 'list', { unreadOnly }] as const,
}

// enabled gates both hooks so anonymous runtime visitors (no session) never
// poll an endpoint that would 401 — mirrors the session-gating pattern
// RuntimeAppShell already uses for the profile/design-hub UI.

export function useUnreadCount(enabled: boolean) {
  return useQuery({
    queryKey: notificationKeys.unreadCount,
    queryFn: notificationsApi.unreadCount,
    enabled,
    refetchInterval: 30_000,
  })
}

export function useNotifications(enabled: boolean, unreadOnly?: boolean) {
  return useQuery({
    queryKey: notificationKeys.list(unreadOnly),
    queryFn: () => notificationsApi.list(unreadOnly),
    enabled,
  })
}

export function useMarkRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['runtime-notifications'] })
    },
  })
}

export function useMarkAllRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['runtime-notifications'] })
    },
  })
}
