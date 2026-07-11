import type { ReactNode } from 'react'
import { usePermission } from './permissions'

interface PermissionGateProps {
  need: string
  fallback?: ReactNode
  children: ReactNode
}

/** Renders children only if the current user has the given permission. */
export function PermissionGate({ need, fallback = null, children }: PermissionGateProps) {
  const allowed = usePermission(need)
  return <>{allowed ? children : fallback}</>
}
