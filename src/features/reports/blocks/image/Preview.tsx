import { useQuery } from '@tanstack/react-query'
import { contentApi } from '@/features/content/api'
import { useTranslation } from '@/features/i18n/I18nProvider'
import type { ReportBlockRendererProps } from '../../report-block-contract'
import type { ImageBlockConfig } from './schema'

// Design-time preview — for a content_id source, mints a presigned URL
// client-side (the browser CAN fetch this directly; only the SERVER-SIDE
// embedding into XLSX/DOCX/PDF needs the actual bytes, resolved separately
// at generation time via block_image.go). For a URL source, renders the
// author's URL directly — this preview is the one place a static URL's
// image is genuinely fetched/displayed at all, since generation itself
// deliberately never fetches it server-side (Jorge's resolved design,
// 2026-08-30) — a broken/inaccessible URL just fails to load here the same
// way any <img> tag would, which is itself useful design-time feedback.
export function ImageBlockPreview({ config }: ReportBlockRendererProps<ImageBlockConfig>) {
  const t = useTranslation()
  const { data: presigned } = useQuery({
    queryKey: ['content-presigned-url', config.content_id],
    queryFn: () => contentApi.presignedUrl(config.content_id!),
    enabled: config.source === 'content_id' && !!config.content_id,
  })

  const src = config.source === 'url' ? config.url : presigned?.url

  if (!src) {
    return <p className="p-3 text-xs italic text-[hsl(var(--muted-foreground))]">{t('reports.blocks.image.no_image_selected')}</p>
  }

  return (
    <div className="flex h-full items-center justify-center overflow-hidden p-2">
      {/* eslint-disable-next-line jsx-a11y/img-redundant-alt */}
      <img src={src} alt={config.alt || t('reports.blocks.image.default_alt')} className="max-h-full max-w-full object-contain" />
    </div>
  )
}
