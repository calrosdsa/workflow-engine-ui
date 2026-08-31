// Report-wide settings (FR-J1-003 §3's Settings fields, none of which had
// any UI before this): default_format, allowed_formats, and style_defaults
// (FR-J1-004 §1) — the report-level counterpart to BlockSettingsPanel's
// per-block Style section, sharing the exact same StyleEditor component.
import { Settings2 } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useReportStore } from './store'
import { StyleEditor } from './StyleEditor'
import { ReportVisibilityEditor } from './ReportVisibilityEditor'
import type { ExportFormat, ReportSettings } from './types'

const FORMAT_LABELS: Record<ExportFormat, string> = {
  csv: 'CSV',
  xlsx: 'Excel (.xlsx)',
  xls: 'Excel 97-2003 (.xls)',
  pdf: 'PDF',
  docx: 'Word (.docx)',
  markdown: 'Markdown',
}
const ALL_FORMATS = Object.keys(FORMAT_LABELS) as ExportFormat[]

export function ReportSettingsPanel({ onBeforeChange }: { onBeforeChange?: () => void }) {
  const settings = useReportStore((s) => s.definition.settings)
  const visibility = useReportStore((s) => s.definition.visibility)
  const updateSettings = useReportStore((s) => s.updateSettings)
  const updateStyleDefaults = useReportStore((s) => s.updateStyleDefaults)
  const updateVisibility = useReportStore((s) => s.updateVisibility)

  const allowedFormats = settings.allowed_formats?.length ? settings.allowed_formats : ALL_FORMATS
  const restrictingFormats = !!settings.allowed_formats?.length

  const changeSettings = (mutation: () => void) => {
    onBeforeChange?.()
    mutation()
  }

  const toggleFormat = (format: ExportFormat, checked: boolean) => {
    const base = restrictingFormats ? allowedFormats : []
    const next = checked ? [...base.filter((f) => f !== format), format] : base.filter((f) => f !== format)
    const patch: Partial<ReportSettings> = {
      allowed_formats: next.length === 0 ? undefined : next,
      default_format: !checked && settings.default_format === format ? undefined : settings.default_format,
    }
    changeSettings(() => updateSettings(patch))
  }

  const setDefaultFormat = (defaultFormat: ExportFormat | undefined) => {
    const patch: Partial<ReportSettings> = { default_format: defaultFormat }
    if (defaultFormat && restrictingFormats && !allowedFormats.includes(defaultFormat)) {
      patch.allowed_formats = [...allowedFormats, defaultFormat]
    }
    changeSettings(() => updateSettings(patch))
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" title="Report settings" aria-label="Report settings">
          <Settings2 size={16} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-4 p-4">
            <div>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Visibility</p>
              <ReportVisibilityEditor visibility={visibility} onChange={(next) => changeSettings(() => updateVisibility(next))} />
            </div>

            <div className="border-t border-[hsl(var(--border))] pt-3">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Export formats</p>

              <div className="flex flex-col gap-1.5">
                <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Default format</Label>
                <SelectMenu
                  value={settings.default_format ?? ''}
                  onValueChange={(v) => setDefaultFormat((v || undefined) as ExportFormat | undefined)}
                >
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="None set" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="" className="text-xs">None set</SelectItem>
                    {ALL_FORMATS.map((f) => (
                      <SelectItem key={f} value={f} className="text-xs">{FORMAT_LABELS[f]}</SelectItem>
                    ))}
                  </SelectContent>
                </SelectMenu>
              </div>

              <div className="mt-3 flex flex-col gap-1.5">
                <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
                  Allowed formats <span className="font-normal">(none checked = every format allowed)</span>
                </Label>
                <div className="flex flex-col gap-1 rounded-md border border-[hsl(var(--border))] p-2">
                  {ALL_FORMATS.map((f) => (
                    <label key={f} className="flex items-center gap-2 text-xs">
                      <Checkbox
                        checked={restrictingFormats ? allowedFormats.includes(f) : false}
                        onCheckedChange={(checked) => toggleFormat(f, checked === true)}
                      />
                      {FORMAT_LABELS[f]}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-[hsl(var(--border))] pt-3">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                Style defaults <span className="font-normal normal-case">(inherited by every block unless a block overrides it)</span>
              </p>
              <StyleEditor style={settings.style_defaults ?? {}} onChange={(style) => changeSettings(() => updateStyleDefaults(Object.keys(style).length === 0 ? undefined : style))} />
            </div>
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
