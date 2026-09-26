// The Agent editor (FR-C8-003) — modeled on RoleFormDrawer.tsx's
// list+click-to-edit-in-drawer pattern, the closest existing precedent in
// this codebase. Owns the Agent's own simple fields (name/description/
// instructions/model/enabled) plus, as its first subsection, the new MCP
// Tools registration this Spec ID actually exists to add — this drawer
// itself didn't exist before FR-C8-003's implementation; AgentsSection.tsx
// was list-only, with no click-to-edit target at all. Skills (FR-C8-002) and
// Session Retention (FR-F6-003) now add their own fields/subsections here
// too.
import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ModelPicker } from '@/features/model-providers/ModelPicker'
import { useUpdateAgent } from '@/features/agents/hooks'
import { MCPToolsSubsection } from '@/features/agent-mcp/MCPToolsSubsection'
import { WorkflowToolsSubsection } from '@/features/agent-mcp/WorkflowToolsSubsection'
import { SkillsSubsection } from '@/features/agents/SkillsSubsection'
import { ToolBindingsSubsection } from '@/features/agents/ToolBindingsSubsection'
import { KnowledgeBasesSubsection } from '@/features/agents/KnowledgeBasesSubsection'
import { useTranslation } from '@/features/i18n/I18nProvider'
import type { Agent, ToolBinding } from '@/features/agents/types'

interface AgentEditorDrawerProps {
  agent: Agent
  canWrite: boolean
  onClose: () => void
}

export function AgentEditorDrawer({ agent, canWrite, onClose }: AgentEditorDrawerProps) {
  const t = useTranslation()
  const [name, setName] = useState(agent.name)
  const [description, setDescription] = useState(agent.description)
  const [instructions, setInstructions] = useState(agent.instructions)
  const [modelId, setModelId] = useState(agent.model_id)
  const [enabled, setEnabled] = useState(agent.enabled)
  const [episodicMemoryEnabled, setEpisodicMemoryEnabled] = useState(Boolean(agent.episodic_memory_enabled))
  const [skills, setSkills] = useState(agent.skills)
  const [tools, setTools] = useState<ToolBinding[]>(agent.tools ?? [])
  // Sent only once changed: an attached knowledge base the app can no longer
  // read would otherwise make every save of this drawer fail on the server's
  // check, even one that only renamed the Agent.
  const [knowledgeBaseIds, setKnowledgeBaseIds] = useState<string[]>(agent.knowledge_base_ids ?? [])
  const [knowledgeBasesChanged, setKnowledgeBasesChanged] = useState(false)
  // Text, not number, state — an empty string is how the field represents
  // "use the platform default" (session_ttl_days: null) without a spurious
  // 0 flashing while the user is mid-edit; parsed back to number|null only
  // at save time (handleSave below).
  const [sessionTTLDaysInput, setSessionTTLDaysInput] = useState(
    agent.session_ttl_days === null ? '' : String(agent.session_ttl_days),
  )
  const updateMutation = useUpdateAgent(agent.id)

  const trimmedTTLInput = sessionTTLDaysInput.trim()
  const ttlIsValid = trimmedTTLInput === '' || (/^\d+$/.test(trimmedTTLInput) && Number(trimmedTTLInput) > 0)
  const episodicMemoryChanged = episodicMemoryEnabled !== Boolean(agent.episodic_memory_enabled)
  const canSave = name.trim() !== '' && ttlIsValid

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        name: name.trim(),
        description,
        instructions,
        model_id: modelId,
        skills,
        tools,
        enabled,
        session_ttl_days: trimmedTTLInput === '' ? null : Number(trimmedTTLInput),
        knowledge_base_ids: knowledgeBasesChanged ? knowledgeBaseIds : undefined,
        episodic_memory_enabled: episodicMemoryChanged ? episodicMemoryEnabled : undefined,
      })
      toast.success(`"${name.trim()}" saved`)
      onClose()
    } catch (e) {
      toast.error('Could not save agent', { description: e instanceof Error ? e.message : undefined })
    }
  }

  return (
    <Drawer open onOpenChange={(o) => { if (!o) onClose() }}>
      <DrawerContent size="lg">
        <DrawerHeader>
          <DrawerTitle>{agent.name}</DrawerTitle>
          <DrawerDescription>Instructions, model provider, and tools for this Agent.</DrawerDescription>
        </DrawerHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
          <div className="space-y-4">
            <div>
              <Label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canWrite} />
            </div>

            <div>
              <Label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Description</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} disabled={!canWrite} placeholder="Optional" />
            </div>

            <div>
              <Label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Instructions</Label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                disabled={!canWrite}
                rows={5}
                placeholder="How should this Agent behave? What is its role?"
                className="w-full resize-y rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div>
              <Label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Model</Label>
              <div className={!canWrite ? 'pointer-events-none opacity-50' : undefined}>
                <ModelPicker
                  value={modelId}
                  onChange={(id) => { if (id) setModelId(id) }}
                  capability="llm"
                  isOptionAllowed={(model) => model.provider_type === 'openai' || model.provider_type === 'gemini'}
                  accentClassName="text-[hsl(var(--primary))]"
                />
              </div>
              <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">
                {t('agents.model_change_hint')}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Switch id="agent-enabled" checked={enabled} onCheckedChange={setEnabled} disabled={!canWrite} />
              <Label htmlFor="agent-enabled" className="cursor-pointer text-xs text-[hsl(var(--muted-foreground))]">Enabled</Label>
            </div>

            <div>
              <Label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Session Retention (days)</Label>
              <Input
                value={sessionTTLDaysInput}
                onChange={(e) => setSessionTTLDaysInput(e.target.value)}
                disabled={!canWrite}
                placeholder="Platform default (90 days)"
                className={!ttlIsValid ? 'border-[hsl(var(--destructive))]' : undefined}
              />
              <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">
                How long this Agent's Chat sessions are kept before automatic deletion, measured from each
                session's most recent activity. Leave blank to use the platform default.
              </p>
              {!ttlIsValid && (
                <p className="mt-1 text-[11px] text-[hsl(var(--destructive))]">Enter a positive whole number of days, or leave blank.</p>
              )}
            </div>
          </div>

          <section className="space-y-3 border-t border-[hsl(var(--border))] pt-4">
            <div>
              <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">{t('agents.memory.title')}</h3>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">{t('agents.memory.description')}</p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="agent-memory-enabled"
                checked={episodicMemoryEnabled}
                onCheckedChange={setEpisodicMemoryEnabled}
                disabled={!canWrite}
              />
              <Label htmlFor="agent-memory-enabled" className="cursor-pointer text-xs text-[hsl(var(--muted-foreground))]">
                {t('agents.memory.toggle')}
              </Label>
            </div>
          </section>

          <div className="border-t border-[hsl(var(--border))] pt-4">
            <MCPToolsSubsection agentId={agent.id} canWrite={canWrite} />
          </div>

          <div className="border-t border-[hsl(var(--border))] pt-4">
            <WorkflowToolsSubsection />
          </div>

          <div className="border-t border-[hsl(var(--border))] pt-4">
            <ToolBindingsSubsection agentId={agent.id} bindings={tools} onChange={setTools} canWrite={canWrite} />
          </div>

          <div className="border-t border-[hsl(var(--border))] pt-4">
            <KnowledgeBasesSubsection
              selected={knowledgeBaseIds}
              onChange={(ids) => {
                setKnowledgeBaseIds(ids)
                setKnowledgeBasesChanged(true)
              }}
              canWrite={canWrite}
            />
          </div>

          <div className="border-t border-[hsl(var(--border))] pt-4">
            <SkillsSubsection agentId={agent.id} skills={skills} onChange={setSkills} canWrite={canWrite} />
          </div>
        </div>

        <DrawerFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          {canWrite && (
            <Button onClick={handleSave} disabled={!canSave || updateMutation.isPending} className="gap-1.5">
              {updateMutation.isPending && <Loader2 size={14} className="animate-spin" />}
              Save
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
