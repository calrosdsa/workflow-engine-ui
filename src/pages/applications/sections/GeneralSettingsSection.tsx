import { useEffect, useState } from 'react'
import { Save, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useUpdateApplicationSettings } from '@/features/applications/hooks'
import { usePermission } from '@/features/auth/permissions'
import type { Application } from '@/features/applications/types'

interface GeneralSettingsSectionProps {
  app: Application
}

export function GeneralSettingsSection({ app }: GeneralSettingsSectionProps) {
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
        <h2 className="text-lg font-semibold text-slate-800">General settings</h2>
        <p className="text-sm text-gray-500">Basic information about this application.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Name</label>
          <Input value={name} onChange={(e) => { setName(e.target.value); setSaved(false) }} placeholder="My Application" disabled={!canWrite} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Description</label>
          <textarea
            value={description}
            onChange={(e) => { setDescription(e.target.value); setSaved(false) }}
            placeholder="What this application is for…"
            disabled={!canWrite}
            rows={3}
            className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Default menu slug</label>
          <Input
            value={defaultMenuSlug}
            onChange={(e) => { setDefaultMenuSlug(e.target.value); setSaved(false) }}
            placeholder="e.g. dashboard"
            disabled={!canWrite}
            className="font-mono text-xs"
          />
          <p className="mt-1 text-[11px] text-gray-400">Which menu the runtime lands on at /{'{clientId}'}/{'{appId}'} with no slug given.</p>
        </div>
      </div>

      {canWrite && (
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={updateMutation.isPending} className="gap-1.5">
            {updateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save
          </Button>
          {saved && !updateMutation.isPending && (
            <span className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 size={13} />Saved</span>
          )}
          {updateMutation.isError && (
            <span className="flex items-center gap-1 text-xs text-red-600"><AlertCircle size={13} />Failed to save</span>
          )}
        </div>
      )}
    </div>
  )
}
