// Config surface for the "image" block type (FR-J1-002 §1): a source toggle
// (static URL vs. upload) plus alt text. An upload goes through contentApi
// under owner_kind 'app_asset' — the closest semantic fit for "a standalone
// image an author attaches to a report" (internal/content.OwnerAppAsset's
// own doc comment already names "logo, export snapshot, etc." as its
// intended use; a report-attached image is the same kind of platform-level
// asset with no single owning record, not a form_record attachment). This
// is deliberately a much smaller upload flow than FileFieldInput.tsx (the
// runtime form-field uploader) — no per-field size/MIME-type rule lookup,
// since a report block has no FieldDef to read one from.
import { useRef, useState } from 'react'
import { Upload, X, ImageIcon, Loader2, AlertCircle } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import { contentApi } from '@/features/content/api'
import { useTranslation } from '@/features/i18n/I18nProvider'
import type { ReportBlockConfigPanelProps } from '../../report-block-contract'
import type { ImageBlockConfig } from './schema'

export function ImageBlockConfigPanel({ config, onChange }: ReportBlockConfigPanelProps<ImageBlockConfig>) {
  const t = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (file: File) => {
    setError(null)
    setUploading(true)
    try {
      const obj = await contentApi.upload({ ownerKind: 'app_asset', ownerResourceId: '' }, file)
      onChange({ ...config, source: 'content_id', content_id: obj.id, url: undefined })
    } catch (e) {
      setError(e instanceof Error ? e.message : t('reports.blocks.image.upload_failed'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{t('reports.blocks.image.source_label')}</Label>
        <SelectMenu
          value={config.source}
          onValueChange={(source) => onChange({ ...config, source: source as ImageBlockConfig['source'] })}
        >
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="url" className="text-xs">{t('reports.blocks.image.source_url_option')}</SelectItem>
            <SelectItem value="content_id" className="text-xs">{t('reports.blocks.image.upload_option')}</SelectItem>
          </SelectContent>
        </SelectMenu>
      </div>

      {config.source === 'url' ? (
        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
            {t('reports.blocks.image.url_label')} <span className="font-normal">({t('reports.blocks.image.url_hint')})</span>
          </Label>
          <Input
            value={config.url ?? ''}
            onChange={(e) => onChange({ ...config, url: e.target.value })}
            placeholder={t('reports.blocks.image.url_placeholder')}
            className="h-8 text-sm"
          />
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
            {t('reports.blocks.image.upload_label')} <span className="font-normal">({t('reports.blocks.image.upload_hint')})</span>
          </Label>
          {config.content_id ? (
            <div className="flex items-center gap-2 rounded-md border border-[hsl(var(--border))] p-2">
              <ImageIcon size={14} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
              <span className="min-w-0 flex-1 truncate text-xs text-[hsl(var(--foreground))]">{t('reports.blocks.image.uploaded_status')}</span>
              <Button
                variant="ghost" size="icon" className="h-6 w-6 shrink-0"
                onClick={() => onChange({ ...config, content_id: undefined })}
              >
                <X size={12} />
              </Button>
            </div>
          ) : (
            <>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f) }}
              />
              <Button
                variant="outline" size="sm" className="h-8 gap-1.5 text-xs"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                {uploading ? t('reports.blocks.image.uploading') : t('reports.blocks.image.choose_image')}
              </Button>
            </>
          )}
          {error && (
            <p className="flex items-center gap-1 text-[11px] text-[hsl(var(--destructive))]">
              <AlertCircle size={11} />{error}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
          {t('reports.blocks.image.alt_text_label')} <span className="font-normal">({t('common.optional')})</span>
        </Label>
        <Input
          value={config.alt ?? ''}
          onChange={(e) => onChange({ ...config, alt: e.target.value })}
          placeholder={t('reports.blocks.image.alt_placeholder')}
          className="h-8 text-sm"
        />
      </div>
    </div>
  )
}
