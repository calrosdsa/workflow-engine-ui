import { useEffect, useState } from 'react'
import { Save, Loader2, CheckCircle2, AlertCircle, Sun, Moon, Monitor } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { ColorPicker } from '@/components/ui/color-picker'
import { useApplicationTheme, useUpdateApplicationTheme } from '@/features/applications/hooks'
import { usePermission } from '@/features/auth/permissions'
import { ThemeProvider, useThemeMode } from '@/features/theme/ThemeProvider'
import { DEFAULT_THEME, mergeTheme } from '@/features/theme/default-theme'
import { hexToHslTriplet, hslTripletToHex } from '@/features/theme/color-utils'
import type { ThemeConfig, ThemeMode } from '@/features/theme/types'

const FONT_OPTIONS = [
  { value: 'system-ui, sans-serif', label: 'System UI' },
  { value: 'Inter, sans-serif', label: 'Inter' },
  { value: 'Roboto, sans-serif', label: 'Roboto' },
  { value: 'Georgia, serif', label: 'Georgia' },
]

const SHADOW_OPTIONS: ThemeConfig['shadow'][] = ['none', 'sm', 'md', 'lg']

export function ThemeSection() {
  const { data: loaded, isLoading } = useApplicationTheme()
  const updateMutation = useUpdateApplicationTheme()
  const canWrite = usePermission('application:write')

  const [draft, setDraft] = useState<ThemeConfig>(DEFAULT_THEME)
  const [saved, setSaved] = useState(false)
  // State (not a plain ref) so ThemeProvider re-renders with the real
  // element as soon as it mounts, instead of seeing `null` on first paint
  // and falling back to document.documentElement for one frame.
  const [previewEl, setPreviewEl] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    if (loaded) setDraft(mergeTheme(loaded.theme))
  }, [loaded])

  if (isLoading) return <div className="flex h-64 items-center justify-center"><Spinner /></div>

  const patchColors = (mode: 'colors' | 'darkColors', key: keyof ThemeConfig['colors'], hex: string) => {
    setSaved(false)
    setDraft((d) => ({ ...d, [mode]: { ...d[mode], [key]: hexToHslTriplet(hex) } }))
  }

  const handleSave = async () => {
    await updateMutation.mutateAsync({ theme: draft })
    setSaved(true)
  }

  return (
    <div className="grid h-full grid-cols-2 divide-x">
      <div className="space-y-6 overflow-y-auto p-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Theme</h2>
          <p className="text-sm text-gray-500">Colors, typography, and branding for this application's runtime.</p>
        </div>

        <ColorSection title="Light mode colors" colors={draft.colors} onChange={(k, hex) => patchColors('colors', k, hex)} canWrite={canWrite} />
        <ColorSection title="Dark mode overrides" colors={{ ...draft.colors, ...draft.darkColors }} onChange={(k, hex) => patchColors('darkColors', k, hex)} canWrite={canWrite} />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Font family</label>
            <select
              value={draft.typography.fontFamily}
              onChange={(e) => { setSaved(false); setDraft((d) => ({ ...d, typography: { ...d.typography, fontFamily: e.target.value } })) }}
              disabled={!canWrite}
              className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm"
            >
              {FONT_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Base font size</label>
            <Input
              value={draft.typography.baseSize}
              onChange={(e) => { setSaved(false); setDraft((d) => ({ ...d, typography: { ...d.typography, baseSize: e.target.value } })) }}
              disabled={!canWrite}
              placeholder="16px"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Border radius</label>
            <Input
              value={draft.radius}
              onChange={(e) => { setSaved(false); setDraft((d) => ({ ...d, radius: e.target.value })) }}
              disabled={!canWrite}
              placeholder="0.5rem"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Shadow</label>
            <select
              value={draft.shadow}
              onChange={(e) => { setSaved(false); setDraft((d) => ({ ...d, shadow: e.target.value as ThemeConfig['shadow'] })) }}
              disabled={!canWrite}
              className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm"
            >
              {SHADOW_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Logo URL</label>
            <Input value={draft.logoUrl ?? ''} onChange={(e) => { setSaved(false); setDraft((d) => ({ ...d, logoUrl: e.target.value })) }} disabled={!canWrite} placeholder="https://…" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Favicon URL</label>
            <Input value={draft.faviconUrl ?? ''} onChange={(e) => { setSaved(false); setDraft((d) => ({ ...d, faviconUrl: e.target.value })) }} disabled={!canWrite} placeholder="https://…" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">App icon URL</label>
            <Input value={draft.appIconUrl ?? ''} onChange={(e) => { setSaved(false); setDraft((d) => ({ ...d, appIconUrl: e.target.value })) }} disabled={!canWrite} placeholder="https://…" />
          </div>
        </div>

        {canWrite && (
          <div className="flex items-center gap-3 border-t pt-4">
            <Button onClick={handleSave} disabled={updateMutation.isPending} className="gap-1.5">
              {updateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save theme
            </Button>
            {saved && !updateMutation.isPending && <span className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 size={13} />Saved</span>}
            {updateMutation.isError && <span className="flex items-center gap-1 text-xs text-red-600"><AlertCircle size={13} />Failed to save</span>}
          </div>
        )}
      </div>

      <div className="overflow-y-auto bg-gray-50 p-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Live preview</p>
        <ThemeProvider theme={draft} scopeElement={previewEl}>
          <PreviewPane setEl={setPreviewEl} />
        </ThemeProvider>
      </div>
    </div>
  )
}

function ColorSection({ title, colors, onChange, canWrite }: {
  title: string
  colors: ThemeConfig['colors']
  onChange: (key: keyof ThemeConfig['colors'], hex: string) => void
  canWrite: boolean
}) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
      <div className="grid grid-cols-2 gap-3">
        {(Object.keys(colors) as (keyof ThemeConfig['colors'])[]).map((key) => (
          <div key={key}>
            <label className="mb-1 block text-[11px] capitalize text-gray-500">{key}</label>
            <ColorPicker value={hslTripletToHex(colors[key])} onChange={(hex) => onChange(key, hex)} className={!canWrite ? 'pointer-events-none opacity-60' : ''} />
          </div>
        ))}
      </div>
    </div>
  )
}

// The preview needs its own DOM node to scope ThemeProvider to (rather than
// document.documentElement), so edits here never leak out and re-theme the
// builder's own chrome outside this pane.
function PreviewPane({ setEl }: { setEl: (el: HTMLDivElement | null) => void }) {
  const { mode, setMode } = useThemeMode()
  return (
    <div ref={setEl} className="space-y-4 rounded-lg border p-4" style={{ backgroundColor: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Sample components</span>
        <div className="flex gap-1 rounded-md border p-0.5">
          {([['light', Sun], ['dark', Moon], ['system', Monitor]] as const).map(([m, Icon]) => (
            <button
              key={m}
              onClick={() => setMode(m as ThemeMode)}
              className={`flex h-6 w-6 items-center justify-center rounded ${mode === m ? 'bg-black/10' : ''}`}
              title={m}
            >
              <Icon size={12} />
            </button>
          ))}
        </div>
      </div>
      <Card style={{ backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--card-foreground))', borderRadius: 'var(--radius)' }} className="p-4">
        <p className="mb-3 text-sm">This is a card with themed background and radius.</p>
        <div className="flex gap-2">
          <button
            className="rounded-md px-3 py-1.5 text-sm text-white"
            style={{ backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', borderRadius: 'var(--radius)' }}
          >
            Primary
          </button>
          <button
            className="rounded-md px-3 py-1.5 text-sm"
            style={{ backgroundColor: 'hsl(var(--secondary))', color: 'hsl(var(--secondary-foreground))', borderRadius: 'var(--radius)' }}
          >
            Secondary
          </button>
        </div>
        <input
          className="mt-3 w-full rounded-md border px-2 py-1 text-sm"
          style={{ borderRadius: 'var(--radius)' }}
          placeholder="Themed input"
        />
      </Card>
    </div>
  )
}

