import type { ResourceDiff } from '@/features/applications/types'

/** The current app's Environment Link state — one of three shapes,
 *  distinguished by role (mirrors the backend's statusResponse doc comment,
 *  api/environment/handler.go):
 *   - linked === false: no active link. CreateProduction/LinkExisting are
 *     both available actions from here.
 *   - role === 'sandbox': the current app IS a linked Sandbox. otherAppId is
 *     its Production app. Promote is available.
 *   - role === 'production': the current app IS a linked Production, and is
 *     LOCKED (enforced server-side too — see
 *     internal/middleware.RequireEnvironmentUnlocked) — no local edits.
 *     otherAppId is its Sandbox app. Promote is NOT available from here
 *     (only initiated from the Sandbox side). */
export interface EnvironmentLinkStatus {
  linked: boolean
  role?: 'sandbox' | 'production'
  other_app_id?: string
  linked_at?: string
}

export interface CreateProductionPayload {
  name: string
  slug: string
}

export interface LinkExistingPayload {
  production_app_id: string
}

export interface PromotePreviewResult {
  diff: Record<string, ResourceDiff>
}

export interface RestoreWarning {
  path: string
  message: string
}

export interface PromoteResult {
  id: string
  app_id: string
  version_number: number
  major_version: number
  minor_version: number
  kind: string
  promoted_from_app_id: string
  created_at: string
  warnings?: RestoreWarning[]
}
