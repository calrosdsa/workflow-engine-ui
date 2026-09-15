import Markdown from 'react-markdown'
import type { Components } from 'react-markdown'
import { useTranslation } from '@/features/i18n/I18nProvider'
import type { WidgetRendererProps } from '../../widget-contract'
import type { RichTextWidgetConfig } from './schema'

// react-markdown renders no raw HTML by default (rehype-raw is opt-in and
// not installed here) — the only sanitization this needs, since Markdown
// syntax itself has no script/event-handler vector. This is deliberately
// the SAFE alternative to the custom-HTML widget (Phase 6): richtext is for
// authored formatted content, custom-HTML is the (permission-gated,
// sandboxed) escape hatch for raw markup.
//
// No @tailwindcss/typography plugin in this project, so element styling is
// explicit per tag via the `components` prop — same manual-styling
// convention features/menus/runtime/CustomMenuRuntime.tsx's RuntimeComponent
// already uses for heading/paragraph, just extended to the fuller markdown
// element set.
const MARKDOWN_COMPONENTS: Components = {
  h1: (props) => <h1 className="mb-2 text-2xl font-semibold" style={{ color: 'hsl(var(--foreground))' }} {...props} />,
  h2: (props) => <h2 className="mb-2 text-xl font-semibold" style={{ color: 'hsl(var(--foreground))' }} {...props} />,
  h3: (props) => <h3 className="mb-1.5 text-lg font-semibold" style={{ color: 'hsl(var(--foreground))' }} {...props} />,
  p: (props) => <p className="mb-3 leading-relaxed last:mb-0" style={{ color: 'hsl(var(--foreground))' }} {...props} />,
  ul: (props) => <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0" {...props} />,
  ol: (props) => <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0" {...props} />,
  li: (props) => <li style={{ color: 'hsl(var(--foreground))' }} {...props} />,
  a: (props) => <a className="underline" style={{ color: 'hsl(var(--primary))' }} target="_blank" rel="noopener noreferrer" {...props} />,
  strong: (props) => <strong className="font-semibold" {...props} />,
  code: (props) => <code className="rounded px-1 py-0.5 font-mono text-[0.9em]" style={{ backgroundColor: 'hsl(var(--muted))' }} {...props} />,
  blockquote: (props) => <blockquote className="mb-3 border-l-2 pl-3 italic last:mb-0" style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }} {...props} />,
}

export function RichTextRenderer({ config, mode }: WidgetRendererProps<RichTextWidgetConfig>) {
  const t = useTranslation()
  // Same builder-only empty-state reasoning as HeadingRenderer/ParagraphRenderer
  // — empty markdown renders zero visible pixels ('plain' chrome), which is
  // fine at runtime but leaves a builder tile impossible to locate by eye.
  if (!config.markdown.trim() && mode === 'builder') {
    return <p className="p-3 text-sm italic text-[hsl(var(--muted-foreground))]">{t('builder.dashboard_richtext.empty_hint')}</p>
  }
  return (
    <div className="p-3 text-sm">
      <Markdown components={MARKDOWN_COMPONENTS}>{config.markdown}</Markdown>
    </div>
  )
}
