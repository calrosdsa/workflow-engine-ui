import { Table2 } from 'lucide-react'
import { registerReportBlock } from '../../report-block-registry'
import { emptyTableBlockConfig, parseTableBlockConfig } from './schema'
import { TableBlockPreview } from './Preview'
import { TableBlockConfigPanel } from './ConfigPanel'

registerReportBlock({
  type: 'table',
  label: 'Table',
  icon: Table2,
  description: "A form's records as rows/columns",
  parseConfig: parseTableBlockConfig,
  createDefaultConfig: emptyTableBlockConfig,
  defaultLayout: { col_span: 12, row_span: 4 },
  Preview: TableBlockPreview,
  ConfigPanel: TableBlockConfigPanel,
})
