// "Add new Advanced Settings" modal — creates or edits a single named,
// targetable, conditional rule attached to a field (FormElement.advancedSettings).
// Opened from the Advanced Settings section of the Logic tab in ConfigPanel.tsx.

import { useEffect, useState } from 'react'
import { nanoid } from 'nanoid'
import { Plus, Trash2, Save } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select-menu'
import { RoleMultiSelect } from './RoleMultiSelect'
import { UserMultiSelect } from './UserMultiSelect'
import { AdvancedSettingConditionBuilder } from './AdvancedSettingConditionBuilder'
import {
  type AdvancedSetting, type AdvancedSettingAudience, type AdvancedSettingAction,
  type AdvancedSettingActionType, type FormElement,
  emptyAdvancedSetting, emptyAdvancedSettingGroup,
} from '../schema'

const AUDIENCE_OPTIONS: { value: AdvancedSettingAudience; label: string }[] = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'specific_people', label: 'Specific People' },
  { value: 'specific_role', label: 'Specific Role' },
]

const ACTION_LABELS: Record<AdvancedSettingActionType, string> = {
  hidden_in_ui: 'Hidden in UI',
  read_only: 'Read Only',
  show_exception: 'Show Exception',
  clear_value: 'Clear Value',
}

function newAction(): AdvancedSettingAction {
  return { id: nanoid(), type: 'hidden_in_ui' }
}

interface AddAdvancedSettingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Existing setting to edit, or undefined to create a new one. */
  setting?: AdvancedSetting
  /** This form's own fields, for the condition builder's field picker. */
  fields: FormElement[]
  onSave: (setting: AdvancedSetting) => void
}

export function AddAdvancedSettingDialog({
  open, onOpenChange, setting, fields, onSave,
}: AddAdvancedSettingDialogProps) {
  const [draft, setDraft] = useState<AdvancedSetting>(() => setting ?? emptyAdvancedSetting())

  // Re-seed the draft whenever the dialog opens (new "Add" click, or a
  // different existing setting is opened for editing).
  useEffect(() => {
    if (open) setDraft(setting ?? emptyAdvancedSetting())
  }, [open, setting])

  const patch = (p: Partial<AdvancedSetting>) => setDraft((d) => ({ ...d, ...p }))

  const setAudience = (appliesTo: AdvancedSettingAudience) => {
    patch({
      appliesTo,
      userIds: appliesTo === 'specific_people' ? (draft.userIds ?? []) : undefined,
      roleIds: appliesTo === 'specific_role' ? (draft.roleIds ?? []) : undefined,
    })
  }

  const addAction = () => patch({ actions: [...draft.actions, newAction()] })
  const updateAction = (id: string, type: AdvancedSettingActionType) =>
    patch({ actions: draft.actions.map((a) => (a.id === id ? { ...a, type } : a)) })
  const removeAction = (id: string) => patch({ actions: draft.actions.filter((a) => a.id !== id) })

  const canSave = draft.name.trim().length > 0
    && (draft.appliesTo !== 'specific_people' || (draft.userIds?.length ?? 0) > 0)
    && (draft.appliesTo !== 'specific_role' || (draft.roleIds?.length ?? 0) > 0)

  const handleSave = () => {
    if (!canSave) return
    onSave(draft)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] w-full max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add new Advanced Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 px-6 py-4">
          <div className="space-y-1.5">
            <Label className="text-[13px] font-medium text-slate-700">
              Settings Name<span className="text-red-500"> *</span>
            </Label>
            <Input
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="Enter a name to identify this settings"
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[13px] font-medium text-slate-700">Applies To</Label>
            <RadioGroup
              value={draft.appliesTo}
              onValueChange={(v) => setAudience(v as AdvancedSettingAudience)}
              className="grid grid-flow-col auto-cols-max gap-5"
            >
              {AUDIENCE_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 text-[13px] text-slate-600">
                  <RadioGroupItem value={opt.value} />
                  {opt.label}
                </label>
              ))}
            </RadioGroup>
            {draft.appliesTo === 'specific_people' && (
              <UserMultiSelect value={draft.userIds ?? []} onChange={(userIds) => patch({ userIds })} />
            )}
            {draft.appliesTo === 'specific_role' && (
              <RoleMultiSelect value={draft.roleIds ?? []} onChange={(roleIds) => patch({ roleIds })} />
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-[13px] font-medium text-slate-700">Apply These Settings When</Label>
            <AdvancedSettingConditionBuilder
              group={draft.when ?? emptyAdvancedSettingGroup()}
              fields={fields}
              onChange={(when) => patch({ when })}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[13px] font-medium text-slate-700">Actions</Label>
            {draft.actions.length === 0 && (
              <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-[12px] text-slate-400">
                No actions yet — add at least one below.
              </p>
            )}
            <div className="space-y-2">
              {draft.actions.map((action) => (
                <div key={action.id} className="flex items-center gap-2 rounded-lg bg-slate-100 p-2">
                  <SelectMenu value={action.type} onValueChange={(v) => updateAction(action.id, v as AdvancedSettingActionType)}>
                    <SelectTrigger className="h-8 flex-1 bg-white text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ACTION_LABELS) as AdvancedSettingActionType[]).map((t) => (
                        <SelectItem key={t} value={t} className="text-xs">{ACTION_LABELS[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </SelectMenu>
                  <button
                    type="button"
                    onClick={() => removeAction(action.id)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-500"
                    title="Remove action"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <Button variant="default" size="sm" onClick={addAction} className="mt-1 gap-1.5">
              <Plus size={14} /> Add Another Actions
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="gap-1.5">
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!canSave} className="gap-1.5">
            <Save size={14} /> Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
