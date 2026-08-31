import { Rows3 } from 'lucide-react'
import { registerReportBlock } from '../../report-block-registry'
import { emptyRelatedBlockConfig, parseRelatedBlockConfig } from './schema'
import { RelatedBlockPreview } from './Preview'
import { RelatedBlockConfigPanel } from './ConfigPanel'

registerReportBlock({
  type: 'related',
  label: 'Related Records',
  icon: Rows3,
  description: 'A nested child table per parent row (e.g. Invoice → Line Items)',
  parseConfig: parseRelatedBlockConfig,
  createDefaultConfig: emptyRelatedBlockConfig,
  defaultLayout: { col_span: 12, row_span: 6 },
  Preview: RelatedBlockPreview,
  ConfigPanel: RelatedBlockConfigPanel,
})
