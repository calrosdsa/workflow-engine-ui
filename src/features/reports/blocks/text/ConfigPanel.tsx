import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SelectMenu, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select-menu'
import type { ReportBlockConfigPanelProps } from '../../report-block-contract'
import type { TextBlockConfig } from './schema'

const LEVEL_LABELS: Record<NonNullable<TextBlockConfig['level']>, string> = {
  h1: 'Title (large)',
  h2: 'Heading (medium)',
  h3: 'Subheading (small)',
  paragraph: 'Paragraph text',
}

// Config surface for the "text" block type (FR-J1-002 §1): a single text
// area plus a heading-level select — the smallest config panel of any block
// type, matching this block's own "no form, no query" scope (block_text.go).
export function TextBlockConfigPanel({ config, onChange }: ReportBlockConfigPanelProps<TextBlockConfig>) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Style</Label>
        <SelectMenu
          value={config.level ?? 'paragraph'}
          onValueChange={(level) => onChange({ ...config, level: level as TextBlockConfig['level'] })}
        >
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(LEVEL_LABELS) as NonNullable<TextBlockConfig['level']>[]).map((l) => (
              <SelectItem key={l} value={l} className="text-xs">{LEVEL_LABELS[l]}</SelectItem>
            ))}
          </SelectContent>
        </SelectMenu>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">Text</Label>
        <Textarea
          value={config.text}
          onChange={(e) => onChange({ ...config, text: e.target.value })}
          placeholder="Report title, section heading, or a static note…"
          rows={3}
          className="text-sm"
        />
      </div>
    </div>
  )
}
