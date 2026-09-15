import { useTranslation } from '@/features/i18n/I18nProvider'
import type { WidgetRendererProps } from '../../widget-contract'
import type { HeadingWidgetConfig } from './schema'

// Adapts the 'heading' case of features/menus/runtime/CustomMenuRuntime.tsx's
// RuntimeComponent — same Tag/size mapping, moved here rather than
// duplicated so both call sites can't drift.
const SIZES: Record<1 | 2 | 3, string> = { 1: 'text-3xl', 2: 'text-2xl', 3: 'text-xl' }

export function HeadingRenderer({ config, mode }: WidgetRendererProps<HeadingWidgetConfig>) {
  const t = useTranslation()
  const Tag = (`h${config.level}`) as 'h1' | 'h2' | 'h3'
  // An empty heading renders zero visible pixels (chrome is 'plain' for
  // content widgets — see index.ts) — in the builder that leaves a tile a
  // user can't tell exists without clicking its exact invisible bounds, so
  // a dim placeholder fills the gap there specifically. Never shown at
  // runtime: a genuinely blank heading is a valid end state for a real
  // viewer, not something needing a "click to edit" hint they can't act on.
  if (!config.text && mode === 'builder') {
    return <p className="p-3 text-sm italic text-[hsl(var(--muted-foreground))]">{t('builder.dashboard_heading.empty_hint')}</p>
  }
  return (
    <Tag className={`p-3 font-semibold ${SIZES[config.level]}`} style={{ color: 'hsl(var(--foreground))' }}>
      {config.text}
    </Tag>
  )
}
