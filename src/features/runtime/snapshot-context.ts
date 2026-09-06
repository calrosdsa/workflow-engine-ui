// Extracted out of runtime-router.tsx so a component that is NOT part of
// the route tree itself — anything reached indirectly through
// RecordDetailPanel's detail-tab registry, e.g. the connections tab's
// Renderer, which needs the published menu list to resolve a configured
// targetMenuId into a slug — can read the current app's published
// AppSnapshot without importing runtime-router.tsx directly. Importing that
// file directly would be a real circular import: runtime-router.tsx already
// transitively imports every detail-tab type (via RuntimeFormRecordPage/
// RuntimeRecordPage -> RecordDetailPanel -> the detail-tabs registry), so a
// detail-tab file importing back from runtime-router.tsx closes the cycle.
//
// runtime-router.tsx remains the only place that PROVIDES these contexts
// (RuntimeSnapshotContext.Provider / RuntimeDraftPreviewContext.Provider) —
// this file only owns their definitions and read-side hooks.
import { createContext, useContext } from 'react'
import type { AppSnapshot } from './types'

export const RuntimeSnapshotContext = createContext<AppSnapshot | null>(null)

export function useRuntimeSnapshotContext(): AppSnapshot {
  const ctx = useContext(RuntimeSnapshotContext)
  if (!ctx) throw new Error('useRuntimeSnapshotContext must be used within the runtime app route')
  return ctx
}

// Whether this tab is currently previewing DRAFT (unpublished) design —
// exposed alongside the snapshot itself so RuntimeAppShell can show a
// persistent "Previewing draft" banner with an exit action.
export const RuntimeDraftPreviewContext = createContext(false)

export function useRuntimeDraftPreview(): boolean {
  return useContext(RuntimeDraftPreviewContext)
}
