import { Type } from 'lucide-react'
import { registerReportBlock } from '../../report-block-registry'
import { emptyTextBlockConfig, parseTextBlockConfig } from './schema'
import { TextBlockPreview } from './Preview'
import { TextBlockConfigPanel } from './ConfigPanel'

registerReportBlock({
  type: 'text',
  label: 'Text / Header',
  icon: Type,
  description: 'A title, section heading, or static paragraph',
  parseConfig: parseTextBlockConfig,
  createDefaultConfig: emptyTextBlockConfig,
  // Two rows gives every heading level enough room in the Workbook and
  // exports while remaining a compact default semantic region.
  defaultLayout: { col_span: 12, row_span: 2 },
  Preview: TextBlockPreview,
  ConfigPanel: TextBlockConfigPanel,
})
