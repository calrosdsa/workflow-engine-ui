import { useEffect, useState } from 'react'
import { Save, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useUpdateApplicationSettings } from '@/features/applications/hooks'
import { usePermission } from '@/features/auth/permissions'
import type { Application } from '@/features/applications/types'
import { useTranslation } from '@/features/i18n/I18nProvider'

interface GeneralSettingsSectionProps {
  app: Application
}

export function GeneralSettingsSection({ app }: GeneralSettingsSectionProps) {
  const t = useTranslation()
  const updateMutation = useUpdateApplicationSettings()
  const canWrite = usePermission('application:write')

  const [name, setName] = useState(app.name)
  const [description, setDescription] = useState(app.settings.description ?? '')
  const [defaultMenuSlug, setDefaultMenuSlug] = useState(app.settings.default_menu_slug ?? '')
  const [saved, setSaved] = useState(false)

  // Re-hydrate local state if the app data refetches from elsewhere (e.g. after publish).
  useEffect(() => {
    setName(app.name)
    setDescription(app.settings.description ?? '')
    setDefaultMenuSlug(app.settings.default_menu_slug ?? '')
  }, [app.name, app.settings.description, app.settings.default_menu_slug])

  const handleSave = async () => {
    setSaved(false)
    await updateMutation.mutateAsync({
      name,
      settings: { ...app.settings, description, default_menu_slug: defaultMenuSlug || undefined },
    })
    setSaved(true)
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 p-6">
      <div>
        <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">{t('app_config.general_title')}</h2>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{t('app_config.general_description')}</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">{t('app_config.name')}</label>
          <Input value={name} onChange={(e) => { setName(e.target.value); setSaved(false) }} placeholder="My Application" disabled={!canWrite} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">{t('app_config.description')}</label>
          <textarea
            value={description}
            onChange={(e) => { setDescription(e.target.value); setSaved(false) }}
            placeholder="What this application is for…"
            disabled={!canWrite}
            rows={3}
            className="flex w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] shadow-sm placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">{t('app_config.default_menu_slug')}</label>
          <Input
            value={defaultMenuSlug}
            onChange={(e) => { setDefaultMenuSlug(e.target.value); setSaved(false) }}
            placeholder="e.g. dashboard"
            disabled={!canWrite}
            className="font-mono text-xs"
          />
          <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">{t('app_config.default_menu_slug_help')}</p>
        </div>
      </div>

      {canWrite && (
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={updateMutation.isPending} className="gap-1.5">
            {updateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {t('common.save')}
          </Button>
          {saved && !updateMutation.isPending && (
            <span className="flex items-center gap-1 text-xs text-[hsl(var(--success))]"><CheckCircle2 size={13} />{t('common.saved')}</span>
          )}
          {updateMutation.isError && (
            <span className="flex items-center gap-1 text-xs text-[hsl(var(--destructive))]"><AlertCircle size={13} />{t('common.save_failed')}</span>
          )}
        </div>
      )}
    </div>
  )
}
