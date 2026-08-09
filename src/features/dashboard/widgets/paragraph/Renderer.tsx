import type { WidgetRendererProps } from '../../widget-contract'
import type { ParagraphWidgetConfig } from './schema'

export function ParagraphRenderer({ config, mode }: WidgetRendererProps<ParagraphWidgetConfig>) {
  // See HeadingRenderer's identical guard for why this only shows in the
  // builder — an empty paragraph is invisible (zero pixels, 'plain'
  // chrome), which is fine at runtime but leaves a builder-mode tile with
  // no way to tell it exists without clicking its exact bounds.
  if (!config.text && mode === 'builder') {
    return <p className="p-3 text-sm italic text-slate-300">Empty paragraph — click to add text</p>
  }
  return (
    <p className="p-3 leading-relaxed" style={{ color: 'hsl(var(--foreground))' }}>
      {config.text}
    </p>
  )
}
