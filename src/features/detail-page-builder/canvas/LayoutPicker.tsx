// Picks the form's DetailPageLayoutId — mirrors form-builder/canvas/
// SectionCard.tsx's own ColumnLayout SelectMenu, applied to the whole
// form's detail-page layout instead of one section's column split.
import { LayoutTemplate } from 'lucide-react'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { DETAIL_PAGE_LAYOUTS, type DetailPageLayoutId } from '@/features/form-builder/schema'

export function LayoutPicker({ value, onChange }: {
  value: DetailPageLayoutId
  onChange: (next: DetailPageLayoutId) => void
}) {
  const t = useTranslation()
  return (
    <SelectMenu value={value} onValueChange={(v) => onChange(v as DetailPageLayoutId)}>
      <SelectTrigger className="h-8 w-auto gap-1.5 px-2.5 text-[12px]">
        <LayoutTemplate size={13} className="text-[hsl(var(--muted-foreground))]" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(DETAIL_PAGE_LAYOUTS) as DetailPageLayoutId[]).map((id) => (
          <SelectItem key={id} value={id} className="text-xs">{t(`detail_tab.canvas.layout.${id}.label`)}</SelectItem>
        ))}
      </SelectContent>
    </SelectMenu>
  )
}
