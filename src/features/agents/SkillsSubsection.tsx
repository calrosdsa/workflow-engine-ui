// Skills section within the Agent editor (FR-C8-002) — mirrors
// MCPToolsSubsection.tsx's list/row/create-dialog shape, the closest
// in-drawer precedent. Unlike MCP Tools, Skills has no backend fetch/mutate
// of its own: it operates on the `skills` array already lifted into
// AgentEditorDrawer's own local state alongside name/description/
// instructions, and is only persisted when that drawer's own Save fires —
// there is no dedicated Skills endpoint, per FR-C8-002 §4.2's resolved
// design (skills round-trips through the Agent's own PUT).
import { useState } from 'react'
import { Plus, Sparkles, Trash2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useMCPServers } from '@/features/agent-mcp/hooks'
import type { Skill } from './types'
import { useI18n } from '@/features/i18n/I18nProvider'

interface SkillsSubsectionProps {
  agentId: string
  skills: Skill[]
  onChange: (skills: Skill[]) => void
  canWrite: boolean
}

export function SkillsSubsection({ agentId, skills, onChange, canWrite }: SkillsSubsectionProps) {
  const { t } = useI18n()
  const { data: servers } = useMCPServers(agentId)
  const availableTools = (servers ?? []).flatMap((s) => s.tools.map((t) => t.name))

  const [editing, setEditing] = useState<{ index: number; skill: Skill } | null>(null)
  const [creating, setCreating] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<number | null>(null)

  const saveSkill = (index: number | null, skill: Skill) => {
    if (index === null) {
      onChange([...skills, skill])
    } else {
      onChange(skills.map((s, i) => (i === index ? skill : s)))
    }
    setCreating(false)
    setEditing(null)
  }

  const confirmDelete = () => {
    if (pendingDelete === null) return
    onChange(skills.filter((_, i) => i !== pendingDelete))
    setPendingDelete(null)
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">{t('agents.skills.title')}</h3>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            {t('agents.skills.description')}
          </p>
        </div>
        {canWrite && (
          <Button size="sm" variant="outline" onClick={() => setCreating(true)} className="shrink-0 gap-1.5">
            <Plus size={14} />{t('agents.skills.add')}
          </Button>
        )}
      </div>

      {!skills.length ? (
        <div className="rounded-lg border border-dashed border-[hsl(var(--border))] p-4 text-center text-xs text-[hsl(var(--muted-foreground))]">
          {t('agents.skills.empty')}
        </div>
      ) : (
        <div className="space-y-2">
          {skills.map((skill, index) => (
            <div key={index} className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                  <Sparkles size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[hsl(var(--foreground))]">{skill.name}</p>
                  <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">{skill.description}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {skill.allowed_tools.length === 0 ? (
                      <Badge variant="secondary" className="text-[10px]">{t('agents.skills.all_tools')}</Badge>
                    ) : (
                      skill.allowed_tools.map((t) => (
                        <Badge key={t} variant="outline" className="font-mono text-[10px]">{t}</Badge>
                      ))
                    )}
                  </div>
                </div>
                {canWrite && (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => setEditing({ index, skill })}
                      aria-label={t('agents.skills.edit', { name: skill.name })}
                      title={t('agents.skills.edit', { name: skill.name })}
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/10"
                      onClick={() => setPendingDelete(index)}
                      aria-label={t('agents.skills.delete', { name: skill.name })}
                      title={t('agents.skills.delete', { name: skill.name })}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <SkillFormDialog
          initial={editing?.skill ?? null}
          availableTools={availableTools}
          onSave={(skill) => saveSkill(editing?.index ?? null, skill)}
          onClose={() => { setCreating(false); setEditing(null) }}
        />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => { if (!open) setPendingDelete(null) }}
        title={t('agents.skills.delete_title')}
        description={pendingDelete !== null ? t('agents.skills.delete_description', { name: skills[pendingDelete]?.name ?? '' }) : undefined}
        confirmLabel={t('common.delete')}
        destructive
        onConfirm={confirmDelete}
      />
    </section>
  )
}

function SkillFormDialog({
  initial,
  availableTools,
  onSave,
  onClose,
}: {
  initial: Skill | null
  availableTools: string[]
  onSave: (skill: Skill) => void
  onClose: () => void
}) {
  const t = useI18n().t
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [instructions, setInstructions] = useState(initial?.instructions ?? '')
  const [allowedTools, setAllowedTools] = useState<string[]>(initial?.allowed_tools ?? [])

  const canSubmit = name.trim() !== '' && description.trim() !== '' && instructions.trim() !== ''

  const toggleTool = (tool: string, checked: boolean) => {
    setAllowedTools((prev) => (checked ? [...prev, tool] : prev.filter((t) => t !== tool)))
  }

  const handleSubmit = () => {
    if (!canSubmit) return
    onSave({
      name: name.trim(),
      description: description.trim(),
      instructions: instructions.trim(),
      allowed_tools: allowedTools,
    })
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? t('agents.skills.edit_skill') : t('agents.skills.add')}</DialogTitle>
          <DialogDescription>{t('agents.skills.dialog_description')}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto px-6 py-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">{t('common.name')}</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('agents.skills.name_placeholder')} autoFocus />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">{t('common.description')}</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('agents.skills.description_placeholder')}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">{t('agents.skills.instructions')}</label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={4}
              placeholder={t('agents.skills.instructions_placeholder')}
              className="w-full resize-y rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">{t('agents.skills.allowed_tools')}</label>
            {availableTools.length === 0 ? (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                {t('agents.skills.no_tools')}
              </p>
            ) : (
              <div className="max-h-32 space-y-1.5 overflow-y-auto rounded-md border border-[hsl(var(--input))] p-2">
                {availableTools.map((tool) => (
                  <label key={tool} className="flex items-center gap-2 text-xs">
                    <Checkbox
                      checked={allowedTools.includes(tool)}
                      onCheckedChange={(checked) => toggleTool(tool, checked === true)}
                    />
                    <span className="font-mono text-[hsl(var(--foreground))]">{tool}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit} className="gap-1.5">
            {initial ? t('common.save') : t('common.add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
