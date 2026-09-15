import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, GitCommitHorizontal, History, Rocket, Save, X } from 'lucide-react'
import { useApplication, useApplicationVersions, usePublishApplication, useSaveVersion, useVersionDiff } from '@/features/applications/hooks'
import { usePermission } from '@/features/auth/permissions'
import { Spinner } from '@/components/ui/spinner'
import type { WorkflowDefinitionGraph } from '../types'
import { useTranslation } from '@/features/i18n/I18nProvider'

type LifecycleError = { action: 'save' | 'checkpoint' | 'publish'; message: string } | null

/**
 * Workflows are versioned in this product as part of the app snapshot. This
 * drawer makes that scope explicit: a workflow draft can be saved alone, but
 * a checkpoint or publish records the complete app so active behavior never
 * silently diverges from the version history.
 */
export function WorkflowLifecycleDrawer({ open, onClose, workflowName, isDirty, savedDefinition, currentDefinition, onSaveWorkflow }: {
  open: boolean
  onClose: () => void
  workflowName: string
  isDirty: boolean
  savedDefinition?: WorkflowDefinitionGraph
  currentDefinition: WorkflowDefinitionGraph
  onSaveWorkflow: () => Promise<boolean>
}) {
  const t = useTranslation()
  const { data: app } = useApplication()
  const { data: versions } = useApplicationVersions()
  const canPublish = usePermission('application:publish')
  const checkpointMutation = useSaveVersion()
  const publishMutation = usePublishApplication()
  const latest = versions?.[0]
  const { data: versionDiff } = useVersionDiff(latest?.version_number ?? null, app?.published_version ?? undefined)
  const [acknowledged, setAcknowledged] = useState(false)
  const [error, setError] = useState<LifecycleError>(null)
  const [savedNotice, setSavedNotice] = useState(false)
  const draftDiff = useMemo(() => summarizeDraft(savedDefinition, currentDefinition), [savedDefinition, currentDefinition])

  useEffect(() => {
    if (!open) return
    setAcknowledged(false)
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null
  const isBusy = checkpointMutation.isPending || publishMutation.isPending
  const currentLabel = isDirty ? t('workflows.lifecycle.draft_changes') : app?.published_version != null ? t('workflows.lifecycle.saved_live', { version: app.published_version }) : t('workflows.lifecycle.saved_unpublished')
  const ensureSaved = async () => {
    setError(null)
    if (!isDirty) return true
    const saved = await onSaveWorkflow()
    if (!saved) setError({ action: 'save', message: t('workflows.lifecycle.save_failed') })
    return saved
  }
  const handleSave = async () => { if (await ensureSaved()) setSavedNotice(true) }
  const handleCheckpoint = async () => {
    if (!await ensureSaved()) return
    try { await checkpointMutation.mutateAsync({ label: `Workflow: ${workflowName}` }); setSavedNotice(true) }
    catch (caught) { setError({ action: 'checkpoint', message: caught instanceof Error ? caught.message : t('workflows.lifecycle.checkpoint_failed') }) }
  }
  const handlePublish = async () => {
    if (!acknowledged || !await ensureSaved()) return
    try { await publishMutation.mutateAsync(undefined); setSavedNotice(true); setAcknowledged(false) }
    catch (caught) { setError({ action: 'publish', message: caught instanceof Error ? caught.message : t('workflows.lifecycle.publish_failed') }) }
  }

  return <div className="workflow-builder-drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <dialog open className="workflow-builder-drawer" aria-label={t('workflows.lifecycle.aria')}>
      <header className="flex items-start justify-between gap-4 border-b border-[hsl(var(--border))] px-5 py-4"><div><div className="flex items-center gap-2"><History size={16} className="text-[hsl(var(--primary))]" /><h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">{t('workflows.lifecycle.title')}</h2></div><p className="mt-1 text-[12px] leading-relaxed text-[hsl(var(--muted-foreground))]">{t('workflows.lifecycle.description')}</p></div><button type="button" onClick={onClose} className="rounded-md p-1 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]" title={t('workflows.lifecycle.close')}><X size={16} /></button></header>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
        <section className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/45 p-3"><div className="flex items-center justify-between gap-3"><div><p className="text-[11px] font-semibold text-[hsl(var(--foreground))]">{t('workflows.lifecycle.current_state')}</p><p className="mt-0.5 text-[12px] text-[hsl(var(--muted-foreground))]">{currentLabel}</p></div>{isDirty ? <span className="rounded-full bg-[hsl(var(--warning))]/10 px-2 py-1 text-[10px] font-semibold text-[hsl(var(--warning))]">{t('workflows.lifecycle.draft_changes')}</span> : <CheckCircle2 size={18} className="text-[hsl(var(--success))]" />}</div>{savedNotice && <p className="mt-2 text-[10px] text-[hsl(var(--success))]">{t('workflows.lifecycle.latest_action')}</p>}</section>

        <section><p className="text-[12px] font-semibold text-[hsl(var(--foreground))]">{t('workflows.lifecycle.diff_title')}</p><p className="mt-0.5 text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]">{t('workflows.lifecycle.diff_description')}</p><DiffRows diff={draftDiff} /></section>

        <section className="border-t border-[hsl(var(--border))] pt-5"><p className="text-[12px] font-semibold text-[hsl(var(--foreground))]">{t('workflows.lifecycle.version_history')}</p><p className="mt-0.5 text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]">{latest ? t('workflows.lifecycle.latest_checkpoint', { major: latest.major_version, minor: latest.minor_version, kind: latest.kind }) : t('workflows.lifecycle.no_checkpoint')} {t('workflows.lifecycle.checkpoint_hint')}</p>{versionDiff && <p className="mt-2 rounded-md bg-[hsl(var(--muted))] px-2 py-1.5 text-[10px] text-[hsl(var(--muted-foreground))]">{t('workflows.lifecycle.snapshot_diff', { changes: formatResourceDiff(versionDiff.resources.workflows) })}</p>}</section>

        {error && <div className="rounded-lg border border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/10 p-3 text-[11px] leading-relaxed text-[hsl(var(--destructive))]"><div className="flex items-center gap-1.5 font-semibold"><AlertCircle size={13} />{error.action === 'publish' ? t('workflows.lifecycle.publish_failed_label') : error.action === 'checkpoint' ? t('workflows.lifecycle.checkpoint_failed_label') : t('workflows.lifecycle.save_failed_label')}</div><p className="mt-1">{error.message}</p></div>}

        <section className="border-t border-[hsl(var(--border))] pt-5"><p className="text-[12px] font-semibold text-[hsl(var(--foreground))]">{t('workflows.lifecycle.publish_review')}</p><label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg border border-[hsl(var(--border))] p-3 text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} className="mt-0.5 accent-[hsl(var(--primary))]" /><span>{t('workflows.lifecycle.review_ack')}</span></label>{!canPublish && <p className="mt-2 text-[10px] text-[hsl(var(--warning))]">{t('workflows.lifecycle.no_publish_permission')}</p>}<p className="mt-3 text-[10px] text-[hsl(var(--muted-foreground))]">{t('workflows.lifecycle.unpublish_unavailable')}</p></section>
      </div>
      <footer className="flex flex-wrap justify-end gap-2 border-t border-[hsl(var(--border))] px-5 py-3"><button type="button" onClick={() => void handleSave()} disabled={!isDirty || isBusy} className="workflow-builder-drawer-action"><Save size={13} />{t('workflows.lifecycle.save_draft')}</button><button type="button" onClick={() => void handleCheckpoint()} disabled={isBusy} className="workflow-builder-drawer-action"><GitCommitHorizontal size={13} />{t('workflows.lifecycle.checkpoint')}</button><button type="button" onClick={() => void handlePublish()} disabled={!acknowledged || !canPublish || isBusy} className="workflow-builder-drawer-publish">{isBusy ? <Spinner className="h-3.5 w-3.5" /> : <Rocket size={13} />}{t('workflows.lifecycle.publish_app')}</button></footer>
    </dialog>
  </div>
}

function DiffRows({ diff }: { diff: { addedNodes: number; removedNodes: number; changedNodes: number; addedEdges: number; removedEdges: number; variablesChanged: boolean } }) {
  const rows = [
    diff.addedNodes && `+${diff.addedNodes} node${diff.addedNodes === 1 ? '' : 's'}`,
    diff.removedNodes && `-${diff.removedNodes} node${diff.removedNodes === 1 ? '' : 's'}`,
    diff.changedNodes && `${diff.changedNodes} node configuration change${diff.changedNodes === 1 ? '' : 's'}`,
    diff.addedEdges && `+${diff.addedEdges} connection${diff.addedEdges === 1 ? '' : 's'}`,
    diff.removedEdges && `-${diff.removedEdges} connection${diff.removedEdges === 1 ? '' : 's'}`,
    diff.variablesChanged && 'workflow variables changed',
  ].filter(Boolean)
  return <div className="mt-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 text-[11px] text-[hsl(var(--muted-foreground))]">{rows.length ? rows.join(' · ') : 'No unsaved graph changes.'}</div>
}

function summarizeDraft(saved: WorkflowDefinitionGraph | undefined, current: WorkflowDefinitionGraph) {
  const before = new Map((saved?.nodes ?? []).map((node) => [node.id, node]))
  const after = new Map(current.nodes.map((node) => [node.id, node]))
  let changedNodes = 0
  for (const [id, node] of after) {
    const previous = before.get(id)
    if (previous && JSON.stringify({ label: previous.label, configuration: previous.configuration, inputs: previous.inputs, outputs: previous.outputs }) !== JSON.stringify({ label: node.label, configuration: node.configuration, inputs: node.inputs, outputs: node.outputs })) changedNodes += 1
  }
  const edgeKey = (edge: WorkflowDefinitionGraph['edges'][number]) => `${edge.source}:${edge.source_handle}->${edge.target}:${edge.target_handle}:${edge.condition ?? ''}`
  const beforeEdges = new Set((saved?.edges ?? []).map(edgeKey))
  const afterEdges = new Set(current.edges.map(edgeKey))
  return { addedNodes: [...after.keys()].filter((id) => !before.has(id)).length, removedNodes: [...before.keys()].filter((id) => !after.has(id)).length, changedNodes, addedEdges: [...afterEdges].filter((key) => !beforeEdges.has(key)).length, removedEdges: [...beforeEdges].filter((key) => !afterEdges.has(key)).length, variablesChanged: JSON.stringify(saved?.variables ?? []) !== JSON.stringify(current.variables) }
}

function formatResourceDiff(diff: { added: string[]; removed: string[]; changed: string[] } | undefined) {
  if (!diff) return 'no workflow resource data'
  const parts = [diff.added.length && `+${diff.added.length} added`, diff.removed.length && `-${diff.removed.length} removed`, diff.changed.length && `${diff.changed.length} changed`].filter(Boolean)
  return parts.length ? parts.join(', ') : 'no workflow changes'
}
