// Report-level visibility (FR-J1-003 v0.2, FR-D2-018's own resolved
// authorization model): public / specific_roles / specific_people. This is
// the SOLE cross-form authorization boundary export_report checks — it
// covers related-record blocks reaching a second form too, with no
// independent per-related-form check (Jorge's explicit resolution,
// 2026-08-30, FR-D2-018 §5/§8). Every report defaults to public, since
// ReportSettingsPanel/emptyReportDefinition never set anything else — this
// is the first UI that lets an author actually change it.
//
// Deliberately NOT reusing FR-D2-015's TabVisibilityConfig UI verbatim —
// that shape (everyone/roles/people/roles_or_people, 4 modes) doesn't match
// ReportVisibility's own 3-mode shape exactly, and the two mechanisms are
// independently evolving (this one is enforced by export_report's own
// permission check, not the tab-visibility gate). RoleMultiSelect/
// UserMultiSelect ARE reused verbatim — those are genuinely
// mode-independent generic pickers, not part of the 4-mode shape mismatch.
import { Label } from '@/components/ui/label'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { RoleMultiSelect } from '@/features/form-builder/config/RoleMultiSelect'
import { UserMultiSelect } from '@/features/form-builder/config/UserMultiSelect'
import type { ReportVisibility, VisibilityMode } from './types'

const MODE_LABELS: Record<VisibilityMode, string> = {
  public: 'Everyone with access to this app',
  specific_roles: 'Specific roles',
  specific_people: 'Specific people',
}

interface ReportVisibilityEditorProps {
  visibility: ReportVisibility
  onChange: (visibility: ReportVisibility) => void
}

export function ReportVisibilityEditor({ visibility, onChange }: ReportVisibilityEditorProps) {
  const mode = visibility.mode ?? 'public'

  const handleModeChange = (nextMode: VisibilityMode) => {
    // Switching mode clears the other mode's own list rather than leaving a
    // stale, now-irrelevant role_ids/user_ids array sitting in the saved
    // definition — a report switched from specific_roles back to public and
    // then later back to specific_roles should start from an empty
    // selection, not silently resurrect whatever was picked before.
    onChange({ mode: nextMode })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Who can run/export this report</Label>
        <SelectMenu value={mode} onValueChange={(v) => handleModeChange(v as VisibilityMode)}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(MODE_LABELS) as VisibilityMode[]).map((m) => (
              <SelectItem key={m} value={m} className="text-xs">{MODE_LABELS[m]}</SelectItem>
            ))}
          </SelectContent>
        </SelectMenu>
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
          Only narrows access below the current form's own view permission — never grants access beyond it.
        </p>
      </div>

      {mode === 'specific_roles' && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Roles</Label>
          <RoleMultiSelect
            value={visibility.role_ids ?? []}
            onChange={(role_ids) => onChange({ ...visibility, role_ids })}
          />
        </div>
      )}

      {mode === 'specific_people' && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">People</Label>
          <UserMultiSelect
            value={visibility.user_ids ?? []}
            onChange={(user_ids) => onChange({ ...visibility, user_ids })}
          />
        </div>
      )}
    </div>
  )
}
