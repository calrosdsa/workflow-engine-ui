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
import { useTranslation } from '@/features/i18n/I18nProvider'
import { useReportStore } from './store'
import { StyleEditor } from './StyleEditor'
import { ReportVisibilityEditor } from './ReportVisibilityEditor'
import { PageSetupSection } from './PageSetupSection'
import { ALL_FORMATS } from './types'
import type { ExportFormat, ReportBlockRegion, ReportSettings } from './types'


export function ReportSettingsPanel({
  onBeforeChange,
  getSelection,
}: {
  onBeforeChange?: () => void
  /** Threaded straight through to PageSetupSection's print-region controls
   *  (print area, repeat rows, breaks, keep-together), which read the
   *  Univer surface's live selection — the same prop WorkbookRegionsPanel
   *  already receives from ReportBuilderPage, for the identical reason. */
  getSelection?: () => ReportBlockRegion | undefined
}) {
  const t = useTranslation()
  const settings = useReportStore((s) => s.definition.settings)
  const visibility = useReportStore((s) => s.definition.visibility)
  const sheets = useReportStore((s) => s.definition.workbook?.sheets)
  const updateSettings = useReportStore((s) => s.updateSettings)
  const updateStyleDefaults = useReportStore((s) => s.updateStyleDefaults)
  const updatePageSetup = useReportStore((s) => s.updatePageSetup)
  const updateSheetPrint = useReportStore((s) => s.updateSheetPrint)
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
        <Button variant="ghost" size="icon" className="h-8 w-8 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" title={t('reports.settings.title')} aria-label={t('reports.settings.title')}>
          <Settings2 size={16} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-4 p-4">
            <div>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('reports.settings.visibility')}</p>
              <ReportVisibilityEditor visibility={visibility} onChange={(next) => changeSettings(() => updateVisibility(next))} />
            </div>

            <div className="border-t border-[hsl(var(--border))] pt-3">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('reports.settings.export_formats')}</p>

              <div className="flex flex-col gap-1.5">
                <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('reports.settings.default_format')}</Label>
                <SelectMenu
                  value={settings.default_format ?? ''}
                  onValueChange={(v) => setDefaultFormat((v || undefined) as ExportFormat | undefined)}
                >
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={t('reports.settings.none_set')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="" className="text-xs">{t('reports.settings.none_set')}</SelectItem>
                    {ALL_FORMATS.map((f) => (
                      <SelectItem key={f} value={f} className="text-xs">{t(`reports.format.${f}.label`)}</SelectItem>
                    ))}
                  </SelectContent>
                </SelectMenu>
              </div>

              <div className="mt-3 flex flex-col gap-1.5">
                <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
                  {t('reports.settings.allowed_formats')} <span className="font-normal">({t('reports.settings.allowed_formats_hint')})</span>
                </Label>
                <div className="flex flex-col gap-1 rounded-md border border-[hsl(var(--border))] p-2">
                  {ALL_FORMATS.map((f) => (
                    <label key={f} className="flex items-center gap-2 text-xs">
                      <Checkbox
                        checked={restrictingFormats ? allowedFormats.includes(f) : false}
                        onCheckedChange={(checked) => toggleFormat(f, checked === true)}
                      />
                      {t(`reports.format.${f}.label`)}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-[hsl(var(--border))] pt-3">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                {t('reports.settings.style_defaults')} <span className="font-normal normal-case">({t('reports.settings.style_defaults_hint')})</span>
              </p>
              <StyleEditor style={settings.style_defaults ?? {}} onChange={(style) => changeSettings(() => updateStyleDefaults(Object.keys(style).length === 0 ? undefined : style))} />
            </div>

            <div className="border-t border-[hsl(var(--border))] pt-3">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{t('reports.settings.page_setup')}</p>
              <PageSetupSection
                page={settings.page ?? {}}
                onChangePage={(page) => changeSettings(() => updatePageSetup(page))}
                sheets={sheets}
                onChangeSheetPrint={(sheetId, print) => changeSettings(() => updateSheetPrint(sheetId, print))}
                getSelection={getSelection}
              />
            </div>
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
