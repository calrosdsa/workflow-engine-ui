// Tools section within the Agent editor (FR-C8-003) — mirrors
// IntegrationsSubsection.tsx's list/row/create-dialog shape (the closest
// existing precedent: free URL + optional credential, no static catalog),
// extended with the genuinely new half this codebase had no precedent for
// at all: a live tool-discovery step run at registration and on manual
// refresh (internal/agentmcp.Discover, backed by the real MCP protocol via
// github.com/modelcontextprotocol/go-sdk).
import { useState } from 'react'
import { Plus, Server, Trash2, Loader2, AlertCircle, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Spinner } from '@/components/ui/spinner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { extractApiError } from '@/lib/api'
import {
  useMCPServers,
  useRegisterMCPServer,
  useRefreshMCPServer,
  useSetMCPToolEnabled,
  useDeleteMCPServer,
} from './hooks'
import type { MCPServer } from './types'
import { useI18n } from '@/features/i18n/I18nProvider'

interface MCPToolsSubsectionProps {
  agentId: string
  canWrite: boolean
}

export function MCPToolsSubsection({ agentId, canWrite }: MCPToolsSubsectionProps) {
  const { t } = useI18n()
  const { data: servers, isLoading } = useMCPServers(agentId)
  const [registerOpen, setRegisterOpen] = useState(false)

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">{t('agent_tools.mcp')}</h3>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            {t('agent_tools.mcp_description')}
          </p>
        </div>
        {canWrite && (
          <Button size="sm" variant="outline" onClick={() => setRegisterOpen(true)} className="shrink-0 gap-1.5">
            <Plus size={14} />{t('agent_tools.add_server')}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex h-16 items-center justify-center"><Spinner /></div>
      ) : !servers?.length ? (
        <div className="rounded-lg border border-dashed border-[hsl(var(--border))] p-4 text-center text-xs text-[hsl(var(--muted-foreground))]">
          {t('agent_tools.empty')}
        </div>
      ) : (
        <div className="space-y-2">
          {servers.map((s) => (
            <MCPServerRow key={s.id} agentId={agentId} server={s} canWrite={canWrite} />
          ))}
        </div>
      )}

      {registerOpen && <RegisterServerDialog agentId={agentId} onClose={() => setRegisterOpen(false)} />}
    </section>
  )
}

function MCPServerRow({ agentId, server, canWrite }: { agentId: string; server: MCPServer; canWrite: boolean }) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(false)
  const refreshMutation = useRefreshMCPServer(agentId)
  const deleteMutation = useDeleteMCPServer(agentId)
  const toggleMutation = useSetMCPToolEnabled(agentId)

  const refreshError = refreshMutation.error ? extractApiError(refreshMutation.error) : null

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
      <div className="flex items-center gap-3 p-3">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]"
          aria-label={expanded ? t('common.collapse') : t('common.expand')}
        >
          <Server size={14} />
        </button>
        <button type="button" onClick={() => setExpanded((e) => !e)} className="min-w-0 flex-1 text-left">
          <p className="truncate text-sm font-medium text-[hsl(var(--foreground))]">{server.name}</p>
          <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
            {server.url} · {server.tools.length} tool{server.tools.length === 1 ? '' : 's'}
            {server.has_token && ' · authenticated'}
          </p>
        </button>
        {expanded ? <ChevronDown size={14} className="shrink-0 text-[hsl(var(--muted-foreground))]" /> : <ChevronRight size={14} className="shrink-0 text-[hsl(var(--muted-foreground))]" />}
        {canWrite && (
          <>
            <Button
              variant="ghost" size="icon" disabled={refreshMutation.isPending}
              onClick={() => refreshMutation.mutate(server.id)}
              aria-label={t('agent_tools.refresh')}
              title={t('agent_tools.refresh')}
            >
              {refreshMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            </Button>
            <Button
              variant="ghost" size="icon" disabled={deleteMutation.isPending}
              className="text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/10"
              onClick={() => deleteMutation.mutate(server.id)}
              aria-label={t('agent_tools.remove_server')}
              title={t('agent_tools.remove_server')}
            >
              {deleteMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            </Button>
          </>
        )}
      </div>

      {refreshError && (
        <p className="flex items-center gap-1 px-3 pb-2 text-xs text-[hsl(var(--destructive))]">
          <AlertCircle size={12} />{refreshError}
        </p>
      )}

      {expanded && (
        <div className="space-y-1.5 border-t border-[hsl(var(--border))] p-3">
          {server.tools.length === 0 ? (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">{t('agent_tools.no_tools')}</p>
          ) : (
            server.tools.map((tool) => (
              <label key={tool.name} className="flex items-start justify-between gap-3 py-1">
                <span className="min-w-0">
                  <span className="block truncate font-mono text-xs text-[hsl(var(--foreground))]">{tool.name}</span>
                  {tool.description && (
                    <span className="block truncate text-[11px] text-[hsl(var(--muted-foreground))]">{tool.description}</span>
                  )}
                </span>
                <Switch
                  checked={tool.enabled}
                  disabled={!canWrite || toggleMutation.isPending}
                  onCheckedChange={(checked) =>
                    toggleMutation.mutate({ id: server.id, toolName: tool.name, enabled: checked })
                  }
                  className="shrink-0"
                />
              </label>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function RegisterServerDialog({ agentId, onClose }: { agentId: string; onClose: () => void }) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [token, setToken] = useState('')
  const registerMutation = useRegisterMCPServer(agentId)

  const canSubmit = name.trim() !== '' && url.trim() !== ''
  const errorText = registerMutation.error ? extractApiError(registerMutation.error) : null

  const handleRegister = async () => {
    try {
      await registerMutation.mutateAsync({ name: name.trim(), url: url.trim(), token: token.trim() || undefined })
      onClose()
    } catch {
      // errorText above renders the failure — registration is deliberately
      // NOT saved on discovery failure (FR-C8-003 §4.2 step 4), so nothing
      // else needs cleaning up here.
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('agent_tools.add_server')}</DialogTitle>
          <DialogDescription>{t('agent_tools.add_server_description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-6 py-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">{t('common.name')}</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('agent_tools.name_placeholder')} autoFocus />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">{t('agent_tools.server_url')}</label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://mcp.example.com/mcp" className="font-mono text-xs" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">{t('agent_tools.bearer_token')}</label>
            <Input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder={t('agent_tools.bearer_placeholder')} className="font-mono text-xs" />
          </div>

          {errorText && (
            <p className="flex items-center gap-1 text-xs text-[hsl(var(--destructive))]">
              <AlertCircle size={13} />{errorText}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={registerMutation.isPending}>{t('common.cancel')}</Button>
          <Button onClick={handleRegister} disabled={!canSubmit || registerMutation.isPending} className="gap-1.5">
            {registerMutation.isPending && <Loader2 size={14} className="animate-spin" />}
            {registerMutation.isPending ? t('agent_tools.connecting') : t('agent_tools.register')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
