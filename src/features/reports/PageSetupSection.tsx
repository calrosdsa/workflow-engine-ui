// RF-301: the Page Setup panel. Two distinct kinds of state, both reached
// through this one section:
//
//  - Report-wide (paper size, orientation, margins, scale, header/footer
//    bands, watermark) lives on ReportSettings.page and is edited directly —
//    no selection needed, same shape StyleEditor's style_defaults already is.
//  - Print-region (area, repeat rows, manual breaks, keep-together) lives per
//    SHEET (ReportWorkbookSheet.print), and is set FROM the sheet's current
//    selection rather than typed by hand — a print area is naturally "these
//    cells", not four row/column numbers an author would have to compute.
//    getSelection() is a live, on-demand callback into the Univer surface
//    (not React state), the exact same contract NumberFormatSection already
//    consumes — including its "stay live and say what's missing" rule
//    (see that file's own doc comment) rather than silently disabling a
//    control when nothing is selected.
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ColorPicker } from '@/components/ui/color-picker'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { useRendererCapabilities } from './hooks'
import { unknownTokens } from './page-setup'
import type {
  PageBand,
  PageMargins,
  PageOrientation,
  PageScale,
  PageSetup,
  PageSize,
  PrintCellRange,
  ReportBlockRegion,
  ReportWorkbookSheet,
  SheetPrintSettings,
} from './types'
import { FORMAT_LABELS, PAGE_BAND_TOKENS } from './types'

export interface PageSetupSectionProps {
  page: PageSetup
  onChangePage: (page: PageSetup | undefined) => void
  /** Every sheet in the report's workbook, so the print-region controls can
   *  show and edit whichever one the author last selected cells in.
   *  Undefined (no workbook yet — a v1/blocks-only report) disables the
   *  whole print-region subsection; report-wide controls above it stay
   *  usable regardless, since PageSetup applies independently of workbook mode. */
  sheets: ReportWorkbookSheet[] | undefined
  onChangeSheetPrint: (sheetId: string, print: SheetPrintSettings | undefined) => void
  getSelection?: () => ReportBlockRegion | undefined
}

const FIELD_LABEL = 'text-[11px] font-medium text-[hsl(var(--muted-foreground))]'
const DEFAULT_MARGIN_MM = 15

// Physical page sizes a non-custom paper_size resolves to, in millimeters —
// used only for this panel's own inline margin-sanity check. The backend's
// Validate is the real authority on what actually renders; disagreeing with
// it here would just mean a stale warning, never a wrong save.
const PAPER_SIZE_MM: Record<Exclude<PageSize, 'custom'>, { width: number; height: number }> = {
  a4: { width: 210, height: 297 },
  letter: { width: 215.9, height: 279.4 },
  legal: { width: 215.9, height: 355.6 },
}

function regionToRange(region: ReportBlockRegion): PrintCellRange {
  return {
    start_row: region.layout.row,
    end_row: region.layout.row + region.layout.row_span - 1,
    start_col: region.layout.col,
    end_col: region.layout.col + region.layout.col_span - 1,
  }
}

function rangesEqual(a: PrintCellRange, b: PrintCellRange): boolean {
  return a.start_row === b.start_row && a.end_row === b.end_row && a.start_col === b.start_col && a.end_col === b.end_col
}

function formatRange(range: PrintCellRange): string {
  return `R${range.start_row + 1}:${range.end_row + 1}, C${range.start_col + 1}:${range.end_col + 1}`
}

export function PageSetupSection({ page, onChangePage, sheets, onChangeSheetPrint, getSelection }: PageSetupSectionProps) {
  const t = useTranslation()
  // Which sheet's print-region settings are on screen — defaults to the
  // first sheet, and follows along whenever "Set from selection" succeeds,
  // the same "show what was last acted on" rule NumberFormatSection's own
  // draft state follows.
  const [activeSheetId, setActiveSheetId] = useState<string | undefined>(sheets?.[0]?.id)
  const sheetId = sheets?.some((s) => s.id === activeSheetId) ? activeSheetId : sheets?.[0]?.id
  const sheetPrint = sheets?.find((s) => s.id === sheetId)?.print

  // A margins-only patch never changes paper_size/custom_*, so the CURRENT
  // page's own dimensions are always the right ones to validate a new
  // margins_mm value against.
  const paperMM = page.paper_size && page.paper_size !== 'custom' ? PAPER_SIZE_MM[page.paper_size] : undefined
  const effectiveWidthMM = page.paper_size === 'custom' ? page.custom_width_mm : paperMM?.width
  const effectiveHeightMM = page.paper_size === 'custom' ? page.custom_height_mm : paperMM?.height

  const marginsWouldExceedPage = (m: PageMargins) => !!(
    effectiveWidthMM && effectiveHeightMM &&
    (m.left_mm + m.right_mm >= effectiveWidthMM || m.top_mm + m.bottom_mm >= effectiveHeightMM)
  )

  const patchPage = (patch: Partial<PageSetup>) => {
    // "Invalid settings are prevented inline before save" (RF-301
    // acceptance criteria): a margin patch that would leave no room for
    // content is rejected outright, not merely flagged — the store never
    // sees it, so there's nothing invalid for Save to send. Unlike the
    // custom-paper-size and unknown-token cases below (both legitimate
    // MID-EDIT states — an author typing width before height, or still
    // typing a token's name character by character), a margins_mm value is
    // always a complete, already-typed number the moment onChange fires,
    // so rejecting it outright never blocks a keystroke that was only ever
    // an intermediate step toward something valid.
    if (patch.margins_mm && marginsWouldExceedPage(patch.margins_mm)) {
      toast.error(t('reports.page_setup.margins_exceed_page'))
      return
    }
    const next = { ...page, ...patch }
    const isEmpty = Object.values(next).every((v) => v === undefined)
    onChangePage(isEmpty ? undefined : next)
  }

  const patchSheetPrint = (targetSheetId: string, patch: Partial<SheetPrintSettings>) => {
    const current = sheets?.find((s) => s.id === targetSheetId)?.print ?? {}
    const next = { ...current, ...patch }
    const isEmpty = Object.values(next).every((v) => v === undefined || (Array.isArray(v) && v.length === 0))
    onChangeSheetPrint(targetSheetId, isEmpty ? undefined : next)
  }

  // Shared by every print-region action below: read the live selection, and
  // if there isn't one, say so instead of doing nothing silently — see this
  // file's own doc comment for why (NumberFormatSection precedent).
  const withSelection = (fn: (selection: ReportBlockRegion) => void) => {
    const selection = getSelection?.()
    if (!selection) {
      toast.error(t('reports.page_setup.select_cells_first'))
      return
    }
    setActiveSheetId(selection.sheet_id)
    fn(selection)
  }

  const margins = page.margins_mm
  // Still shown even though patchPage now rejects a margins_mm edit that
  // would trip this: a report saved before this validation existed (or
  // written directly through the API/MCP tools, which this panel's own
  // rejection can't reach) can still load with margins already invalid.
  const marginsExceedPage = !!(margins && marginsWouldExceedPage(margins))
  const customSizeIncomplete = page.paper_size === 'custom' && (!page.custom_width_mm || !page.custom_height_mm)

  return (
    <div className="flex flex-col gap-4">
      <FormatSupportNote />

      {/* Paper, orientation, scale */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1.5">
          <Label className={FIELD_LABEL}>{t('reports.page_setup.paper_size')}</Label>
          <SelectMenu
            value={page.paper_size ?? 'a4'}
            onValueChange={(v) => patchPage({ paper_size: v as PageSize })}
          >
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="a4" className="text-xs">{t('reports.page_setup.paper_a4')}</SelectItem>
              <SelectItem value="letter" className="text-xs">{t('reports.page_setup.paper_letter')}</SelectItem>
              <SelectItem value="legal" className="text-xs">{t('reports.page_setup.paper_legal')}</SelectItem>
              <SelectItem value="custom" className="text-xs">{t('reports.page_setup.paper_custom')}</SelectItem>
            </SelectContent>
          </SelectMenu>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className={FIELD_LABEL}>{t('reports.page_setup.orientation')}</Label>
          <SelectMenu
            value={page.orientation ?? 'portrait'}
            onValueChange={(v) => patchPage({ orientation: v as PageOrientation })}
          >
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="portrait" className="text-xs">{t('reports.page_setup.orientation_portrait')}</SelectItem>
              <SelectItem value="landscape" className="text-xs">{t('reports.page_setup.orientation_landscape')}</SelectItem>
            </SelectContent>
          </SelectMenu>
        </div>
      </div>

      {page.paper_size === 'custom' && (
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <Label className={FIELD_LABEL}>{t('reports.page_setup.custom_width')}</Label>
            <Input
              type="number" min={1} value={page.custom_width_mm ?? ''}
              onChange={(e) => patchPage({ custom_width_mm: e.target.value ? Number(e.target.value) : undefined })}
              className="h-8 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className={FIELD_LABEL}>{t('reports.page_setup.custom_height')}</Label>
            <Input
              type="number" min={1} value={page.custom_height_mm ?? ''}
              onChange={(e) => patchPage({ custom_height_mm: e.target.value ? Number(e.target.value) : undefined })}
              className="h-8 text-sm"
            />
          </div>
          {customSizeIncomplete && (
            <p className="col-span-2 text-[11px] text-[hsl(var(--destructive))]">{t('reports.page_setup.custom_size_required')}</p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label className={FIELD_LABEL}>{t('reports.page_setup.scale')}</Label>
        <SelectMenu
          value={page.scale ?? 'actual'}
          onValueChange={(v) => patchPage({ scale: v as PageScale })}
        >
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="actual" className="text-xs">{t('reports.page_setup.scale_actual')}</SelectItem>
            <SelectItem value="fit_width" className="text-xs">{t('reports.page_setup.scale_fit_width')}</SelectItem>
            <SelectItem value="fit_page" className="text-xs">{t('reports.page_setup.scale_fit_page')}</SelectItem>
          </SelectContent>
        </SelectMenu>
      </div>

      {/* Margins, linked or independent */}
      <MarginsEditor
        value={margins}
        onChange={(next) => patchPage({ margins_mm: next })}
      />
      {marginsExceedPage && (
        <p className="text-[11px] text-[hsl(var(--destructive))]">{t('reports.page_setup.margins_exceed_page')}</p>
      )}

      {/* Header / footer */}
      <div className="border-t border-[hsl(var(--border))] pt-3">
        <p className={`mb-2 ${FIELD_LABEL}`}>{t('reports.page_setup.header')}</p>
        <BandEditor band={page.header} onChange={(header) => patchPage({ header })} />
      </div>
      <div>
        <p className={`mb-2 ${FIELD_LABEL}`}>{t('reports.page_setup.footer')}</p>
        <BandEditor band={page.footer} onChange={(footer) => patchPage({ footer })} />
      </div>

      {/* Watermark */}
      <div className="border-t border-[hsl(var(--border))] pt-3">
        <p className={`mb-2 ${FIELD_LABEL}`}>{t('reports.page_setup.watermark')}</p>
        <div className="flex flex-col gap-2">
          <Input
            value={page.watermark?.text ?? ''}
            onChange={(e) => {
              const text = e.target.value
              patchPage({ watermark: text ? { ...page.watermark, text } : undefined })
            }}
            placeholder={t('reports.page_setup.watermark_text_placeholder')}
            className="h-8 text-sm"
            aria-label={t('reports.page_setup.watermark_text_placeholder')}
          />
          {page.watermark?.text && (
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <Label className={FIELD_LABEL}>{t('reports.style.text_color')}</Label>
                <ColorPicker
                  value={page.watermark.color ?? '#9CA3AF'}
                  onChange={(color) => patchPage({ watermark: { ...page.watermark!, color } })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className={FIELD_LABEL}>{t('reports.page_setup.watermark_size')}</Label>
                <Input
                  type="number" min={1}
                  value={page.watermark.font_size ?? ''}
                  onChange={(e) => patchPage({ watermark: { ...page.watermark!, font_size: e.target.value ? Number(e.target.value) : undefined } })}
                  className="h-8 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className={FIELD_LABEL}>{t('reports.page_setup.watermark_opacity')}</Label>
                <Input
                  type="number" min={0} max={1} step={0.05}
                  value={page.watermark.opacity ?? ''}
                  onChange={(e) => patchPage({ watermark: { ...page.watermark!, opacity: e.target.value ? Number(e.target.value) : undefined } })}
                  className="h-8 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className={FIELD_LABEL}>{t('reports.page_setup.watermark_angle')}</Label>
                <Input
                  type="number" min={-180} max={180}
                  value={page.watermark.angle ?? ''}
                  onChange={(e) => patchPage({ watermark: { ...page.watermark!, angle: e.target.value ? Number(e.target.value) : undefined } })}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Print region: area, repeat rows, breaks, keep-together */}
      <div className="border-t border-[hsl(var(--border))] pt-3">
        <p className={`mb-2 ${FIELD_LABEL}`}>{t('reports.page_setup.print_region')}</p>

        {!sheets?.length ? (
          <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{t('reports.page_setup.no_workbook')}</p>
        ) : (
          <div className="flex flex-col gap-3">
            <PrintAreaRow
              t={t}
              current={sheetPrint?.area}
              onSet={() => withSelection((selection) => patchSheetPrint(selection.sheet_id, { area: regionToRange(selection) }))}
              onClear={() => sheetId && patchSheetPrint(sheetId, { area: undefined })}
            />
            <RepeatRowsRow
              t={t}
              current={sheetPrint?.repeat_rows}
              onSet={() => withSelection((selection) => patchSheetPrint(selection.sheet_id, {
                repeat_rows: { start: selection.layout.row, end: selection.layout.row + selection.layout.row_span - 1 },
              }))}
              onClear={() => sheetId && patchSheetPrint(sheetId, { repeat_rows: undefined })}
            />
            <PageBreaksRow
              t={t}
              current={sheetPrint?.row_breaks ?? []}
              onToggle={() => withSelection((selection) => {
                const row = selection.layout.row
                const existing = sheets?.find((s) => s.id === selection.sheet_id)?.print?.row_breaks ?? []
                const next = existing.includes(row) ? existing.filter((r) => r !== row) : [...existing, row].sort((a, b) => a - b)
                patchSheetPrint(selection.sheet_id, { row_breaks: next })
              })}
            />
            <KeepTogetherRow
              t={t}
              current={sheetPrint?.keep_together ?? []}
              onAdd={() => withSelection((selection) => {
                const range = regionToRange(selection)
                const existing = sheets?.find((s) => s.id === selection.sheet_id)?.print?.keep_together ?? []
                if (existing.some((r) => rangesEqual(r, range))) return
                patchSheetPrint(selection.sheet_id, { keep_together: [...existing, range] })
              })}
              onRemove={(range) => {
                if (!sheetId) return
                const existing = sheetPrint?.keep_together ?? []
                patchSheetPrint(sheetId, { keep_together: existing.filter((r) => !rangesEqual(r, range)) })
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// Which formats currently honor the four page-setup-related capabilities —
// RF-301's "UI explains which formats honor each feature" acceptance
// criterion. Fetched, not hardcoded, so a format's real support survives a
// backend change without this file drifting from it (ReportFormatCapability's
// own doc comment covers the one known exception: this can't see a
// deployment's REPORT_PDF_RENDERER=chromium override, so PDF's row carries a
// manual caveat rather than a flat "not supported").
const CAPABILITY_KEYS = ['page_setup', 'repeat_rows', 'page_numbering', 'watermark'] as const

function FormatSupportNote() {
  const t = useTranslation()
  const { data: capabilities } = useRendererCapabilities()
  const [open, setOpen] = useState(false)

  if (!capabilities?.length) return null

  return (
    <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 p-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="format-support-table"
        className="text-[11px] font-medium text-[hsl(var(--muted-foreground))] underline"
      >
        {t('reports.page_setup.format_support_toggle')}
      </button>
      {open && (
        <table id="format-support-table" className="mt-2 w-full text-[11px]">
          <thead>
            <tr className="text-left text-[hsl(var(--muted-foreground))]">
              <th className="pr-2 font-medium">{t('reports.page_setup.format_column')}</th>
              {CAPABILITY_KEYS.map((key) => (
                <th key={key} className="pr-2 font-medium">{t(`reports.page_setup.capability_${key}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {capabilities.map((cap) => (
              <tr key={cap.format}>
                <td className="pr-2">{FORMAT_LABELS[cap.format]}</td>
                {CAPABILITY_KEYS.map((key) => (
                  <td key={key} className="pr-2">
                    {cap[key] ? t('reports.page_setup.capability_yes') : t('reports.page_setup.capability_no')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {open && (
        <p className="mt-2 text-[11px] text-[hsl(var(--muted-foreground))]">{t('reports.page_setup.pdf_renderer_caveat')}</p>
      )}
    </div>
  )
}

function MarginsEditor({ value, onChange }: { value: PageMargins | undefined; onChange: (v: PageMargins | undefined) => void }) {
  const t = useTranslation()
  const [linked, setLinked] = useState(true)
  const m = value ?? { top_mm: DEFAULT_MARGIN_MM, right_mm: DEFAULT_MARGIN_MM, bottom_mm: DEFAULT_MARGIN_MM, left_mm: DEFAULT_MARGIN_MM }

  const setSide = (side: keyof PageMargins, mm: number) => {
    onChange(linked ? { top_mm: mm, right_mm: mm, bottom_mm: mm, left_mm: mm } : { ...m, [side]: mm })
  }

  const sides: { key: keyof PageMargins; label: string }[] = [
    { key: 'top_mm', label: t('reports.page_setup.margin_top') },
    { key: 'right_mm', label: t('reports.page_setup.margin_right') },
    { key: 'bottom_mm', label: t('reports.page_setup.margin_bottom') },
    { key: 'left_mm', label: t('reports.page_setup.margin_left') },
  ]

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Label className={FIELD_LABEL}>{t('reports.page_setup.margins')}</Label>
        <button
          type="button"
          onClick={() => setLinked((v) => !v)}
          className="text-[11px] text-[hsl(var(--muted-foreground))] underline"
          aria-pressed={linked}
        >
          {linked ? t('reports.page_setup.margins_linked') : t('reports.page_setup.margins_unlinked')}
        </button>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {sides.map(({ key, label }) => (
          <Input
            key={key}
            type="number" min={0}
            value={m[key]}
            onChange={(e) => setSide(key, e.target.value ? Number(e.target.value) : 0)}
            placeholder={label}
            aria-label={label}
            className="h-8 text-sm"
          />
        ))}
      </div>
    </div>
  )
}

function BandEditor({ band, onChange }: { band: PageBand | undefined; onChange: (b: PageBand | undefined) => void }) {
  const t = useTranslation()
  const b = band ?? {}

  const setZone = (zone: keyof PageBand, text: string) => {
    const next = { ...b, [zone]: text || undefined }
    const isEmpty = !next.left && !next.center && !next.right
    onChange(isEmpty ? undefined : next)
  }

  const zones: { key: keyof PageBand; label: string }[] = [
    { key: 'left', label: t('reports.page_setup.band_left') },
    { key: 'center', label: t('reports.page_setup.band_center') },
    { key: 'right', label: t('reports.page_setup.band_right') },
  ]

  return (
    <div className="flex flex-col gap-2">
      {zones.map(({ key, label }) => {
        const text = b[key] ?? ''
        const badTokens = unknownTokens(text)
        return (
          <div key={key} className="flex flex-col gap-1">
            <div className="flex gap-1.5">
              <Input
                value={text}
                onChange={(e) => setZone(key, e.target.value)}
                placeholder={label}
                aria-label={label}
                className="h-8 flex-1 text-sm"
              />
              <SelectMenu value="" onValueChange={(token) => setZone(key, `${text}{{${token}}}`)}>
                <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder={t('reports.page_setup.insert_token')} /></SelectTrigger>
                <SelectContent>
                  {PAGE_BAND_TOKENS.map((token) => (
                    <SelectItem key={token} value={token} className="text-xs">{t(`reports.page_setup.token_${token}`)}</SelectItem>
                  ))}
                </SelectContent>
              </SelectMenu>
            </div>
            {badTokens.length > 0 && (
              <p className="text-[11px] text-[hsl(var(--destructive))]">
                {t('reports.page_setup.unknown_token', { token: badTokens.join(', ') })}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

interface RowProps {
  t: ReturnType<typeof useTranslation>
}

function PrintAreaRow({ t, current, onSet, onClear }: RowProps & { current: PrintCellRange | undefined; onSet: () => void; onClear: () => void }) {
  // Clear unmounts itself (the `current &&` block it lives in) the moment
  // it's clicked, which would otherwise drop keyboard focus to
  // document.body. "Set from selection" survives every state this row can
  // be in, so refocusing it keeps a keyboard user anchored in the row they
  // were just working in instead of losing their place on the page.
  const setBtnRef = useRef<HTMLButtonElement>(null)
  return (
    <div className="flex flex-col gap-1">
      <Label className={FIELD_LABEL}>{t('reports.page_setup.print_area')}</Label>
      <div className="flex items-center gap-2">
        <Button ref={setBtnRef} type="button" variant="outline" size="sm" className="text-xs" onClick={onSet}>{t('reports.page_setup.set_from_selection')}</Button>
        {current && (
          <>
            <span className="text-[11px] text-[hsl(var(--muted-foreground))]">{formatRange(current)}</span>
            <button type="button" onClick={() => { onClear(); setBtnRef.current?.focus() }} className="text-[11px] text-[hsl(var(--muted-foreground))] underline">{t('common.clear')}</button>
          </>
        )}
      </div>
    </div>
  )
}

function RepeatRowsRow({ t, current, onSet, onClear }: RowProps & { current: { start: number; end: number } | undefined; onSet: () => void; onClear: () => void }) {
  // Same focus-loss-on-unmount hazard and fix as PrintAreaRow above.
  const setBtnRef = useRef<HTMLButtonElement>(null)
  return (
    <div className="flex flex-col gap-1">
      <Label className={FIELD_LABEL}>{t('reports.page_setup.repeat_rows')}</Label>
      <div className="flex items-center gap-2">
        <Button ref={setBtnRef} type="button" variant="outline" size="sm" className="text-xs" onClick={onSet}>{t('reports.page_setup.set_from_selection')}</Button>
        {current && (
          <>
            <span className="text-[11px] text-[hsl(var(--muted-foreground))]">{t('reports.page_setup.rows_range', { start: current.start + 1, end: current.end + 1 })}</span>
            <button type="button" onClick={() => { onClear(); setBtnRef.current?.focus() }} className="text-[11px] text-[hsl(var(--muted-foreground))] underline">{t('common.clear')}</button>
          </>
        )}
      </div>
    </div>
  )
}

function PageBreaksRow({ t, current, onToggle }: RowProps & { current: number[]; onToggle: () => void }) {
  return (
    <div className="flex flex-col gap-1">
      <Label className={FIELD_LABEL}>{t('reports.page_setup.page_breaks')}</Label>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" className="text-xs" onClick={onToggle}>{t('reports.page_setup.toggle_break_before_row')}</Button>
        {current.length > 0 && (
          <span className="text-[11px] text-[hsl(var(--muted-foreground))]">
            {t('reports.page_setup.rows_list', { rows: current.map((r) => r + 1).join(', ') })}
          </span>
        )}
      </div>
    </div>
  )
}

function KeepTogetherRow({ t, current, onAdd, onRemove }: RowProps & { current: PrintCellRange[]; onAdd: () => void; onRemove: (range: PrintCellRange) => void }) {
  // Removing a range unmounts its own <li>/button (and the whole <ul> if
  // it was the last one) regardless of where in the list it sat — same
  // focus-loss-on-unmount hazard as PrintAreaRow/RepeatRowsRow's Clear,
  // fixed the same way: refocus the always-mounted "Add selection" button.
  const addBtnRef = useRef<HTMLButtonElement>(null)
  return (
    <div className="flex flex-col gap-1">
      <Label className={FIELD_LABEL}>{t('reports.page_setup.keep_together')}</Label>
      <Button ref={addBtnRef} type="button" variant="outline" size="sm" className="w-fit text-xs" onClick={onAdd}>{t('reports.page_setup.add_selection')}</Button>
      {current.length > 0 && (
        <ul className="flex flex-col gap-1">
          {current.map((range, i) => (
            <li key={i} className="flex items-center justify-between text-[11px] text-[hsl(var(--muted-foreground))]">
              <span>{formatRange(range)}</span>
              <button type="button" onClick={() => { onRemove(range); addBtnRef.current?.focus() }} className="underline">{t('common.remove')}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
