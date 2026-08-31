import { SigmaSquare } from 'lucide-react'
import { registerReportBlock } from '../../report-block-registry'
import { emptyGroupBlockConfig, parseGroupBlockConfig } from './schema'
import { GroupBlockPreview } from './Preview'
import { GroupBlockConfigPanel } from './ConfigPanel'

registerReportBlock({
  type: 'group',
  label: 'Group / Subtotal',
  icon: SigmaSquare,
  description: 'Group-by + aggregate rows (sum/count/avg/min/max)',
  parseConfig: parseGroupBlockConfig,
  createDefaultConfig: emptyGroupBlockConfig,
  defaultLayout: { col_span: 12, row_span: 4 },
  Preview: GroupBlockPreview,
  ConfigPanel: GroupBlockConfigPanel,
})
