// Role picker used by (1) the form-builder's "Create User" settings
// sub-section and (2) the record-detail "Enable Account" dialog (Phase C).
// Local to form-builder (not a shared features/roles component) since no
// other place in the app needs a styled SelectMenu role picker yet — Team's
// UserFormDrawer.tsx uses a raw <select> from a different visual system.
import {
  SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select-menu'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { useAuthStore } from '@/stores/auth'
import { useRoles } from '@/features/roles/hooks'

// Sentinel for "nothing selected". Radix Select disallows an empty-string
// item value, so this is mapped to/from `undefined` at the component boundary.
const NONE = '__none__'

interface RoleSelectProps {
  value?: string
  onChange: (roleId: string | undefined) => void
  /** Which app's roles to list. Defaults to the active membership's app —
   *  the form-builder call site relies on this default; the record-detail
   *  "Enable Account" dialog (which isn't necessarily rendered from within
   *  a builder page but the same active-app context still applies there
   *  too) may pass it explicitly if a different app scope is ever needed. */
  appId?: string
}

export function RoleSelect({ value, onChange, appId: appIdProp }: RoleSelectProps) {
  const t = useTranslation()
  const activeAppId = useAuthStore((s) => s.activeMembership?.app_id) ?? ''
  const appId = appIdProp ?? activeAppId
  const { data: roles, isLoading } = useRoles(appId)

  if (!appId) {
    return (
      <SelectMenu disabled>
        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={t('form_config.no_active_app')} /></SelectTrigger>
        <SelectContent />
      </SelectMenu>
    )
  }

  return (
    <SelectMenu value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? undefined : v)} disabled={isLoading}>
      <SelectTrigger className="h-8 text-sm">
        <SelectValue placeholder={isLoading ? t('form_config.loading_roles') : t('form_config.select_a_role')} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE} className="text-xs">{t('form_config.none')}</SelectItem>
        {(roles ?? []).map((r) => (
          <SelectItem key={r.id} value={r.id} className="text-xs">{r.name}</SelectItem>
        ))}
      </SelectContent>
    </SelectMenu>
  )
}
