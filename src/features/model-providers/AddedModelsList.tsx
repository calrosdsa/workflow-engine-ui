import { useState } from 'react'
import { toast } from 'sonner'
import { HTTPError } from 'ky'
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useProviderInstances, useDeleteInstance } from './hooks'
import { InstanceModelsList } from './InstanceModelsList'
import { PROVIDER_LOGOS } from './logos'
import type { ProviderInstance } from './types'

export function AddedModelsList({ canWrite }: { canWrite: boolean }) {
  const { data: instances, isLoading } = useProviderInstances()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [pendingDelete, setPendingDelete] = useState<ProviderInstance | null>(null)
  const deleteMutation = useDeleteInstance()

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const confirmDelete = () => {
    if (!pendingDelete) return
    const name = pendingDelete.name
    deleteMutation.mutate(pendingDelete.id, {
      onSuccess: () => {
        toast.success(`"${name}" removed`)
        setPendingDelete(null)
      },
      onError: (e) => {
        if (e instanceof HTTPError && e.response.status === 409) {
          toast.error(`"${name}" is still used by one or more agents — remove or reassign them first.`)
          setPendingDelete(null)
          return
        }
        toast.error('Could not remove provider', { description: e instanceof Error ? e.message : undefined })
      },
    })
  }

  if (isLoading) {
    return <div className="flex h-24 items-center justify-center"><Spinner /></div>
  }

  const rows = instances ?? []

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-[hsl(var(--foreground))]">Added models</h2>
      {rows.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-[hsl(var(--border))] p-8 text-center text-[13px] text-[hsl(var(--muted-foreground))]">
          No providers added yet — pick one from Available models to get started.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((inst) => {
            const Logo = PROVIDER_LOGOS[inst.provider_type]
            const isOpen = expanded.has(inst.id)
            return (
              <div key={inst.id} className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                <div className="flex items-center gap-2.5 px-3 py-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--muted))]">
                    <Logo size={16} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[hsl(var(--foreground))]">{inst.name}</span>
                  <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-[11px]" onClick={() => toggle(inst.id)}>
                    {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    {isOpen ? 'Hide models' : 'View models'}
                  </Button>
                  {canWrite && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/10 hover:text-[hsl(var(--destructive))]"
                      onClick={() => setPendingDelete(inst)}
                      aria-label={`Remove ${inst.name}`}
                      title={`Remove ${inst.name}`}
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
                </div>
                {isOpen && <InstanceModelsList instanceId={inst.id} canWrite={canWrite} />}
              </div>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => { if (!open) setPendingDelete(null) }}
        title="Remove this provider?"
        description={pendingDelete ? `"${pendingDelete.name}" and every model under it will no longer be available — this can't be undone.` : undefined}
        confirmLabel="Remove"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
