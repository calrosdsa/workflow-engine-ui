import { FileDown } from 'lucide-react'
import { registerCustomAction } from '../registry'
import { emptyExportReportActionConfig, parseExportReportActionConfig } from './schema'
import { ExportReportConfigPanel } from './ConfigPanel'
import { ExportReportMenuItem } from './MenuItem'

registerCustomAction({
  type: 'export_report',
  label: 'Export Report',
  icon: FileDown,
  description: 'Generate a report scoped to this record and download it (FR-D2-018).',
  parseConfig: parseExportReportActionConfig,
  createDefaultConfig: emptyExportReportActionConfig,
  ConfigPanel: ExportReportConfigPanel,
  MenuItem: ExportReportMenuItem,
})
