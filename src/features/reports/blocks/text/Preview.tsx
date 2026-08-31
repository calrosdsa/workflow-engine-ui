import type { ReportBlockRendererProps } from '../../report-block-contract'
import type { TextBlockConfig } from './schema'

const SIZES: Record<NonNullable<TextBlockConfig['level']>, string> = {
  h1: 'text-2xl font-bold',
  h2: 'text-xl font-semibold',
  h3: 'text-base font-semibold',
  paragraph: 'text-sm',
}

// Design-time preview — renders the actual text at its actual visual
// weight, unlike table/group/related's structure-only previews, since a
// text block's whole content IS what's shown here (no server-side
// resolution step separates "preview" from "real content" the way a query
// does for other block types).
export function TextBlockPreview({ config }: ReportBlockRendererProps<TextBlockConfig>) {
  if (!config.text) {
    return <p className="p-3 text-xs italic text-[hsl(var(--muted-foreground))]">Empty text block — click to add content</p>
  }
  const level = config.level ?? 'paragraph'
  return (
    <p className={`p-3 ${SIZES[level]} text-[hsl(var(--foreground))]`}>{config.text}</p>
  )
}
