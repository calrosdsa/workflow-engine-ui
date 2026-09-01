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
  configSchema: {
    type: 'object',
    required: ['reportDefinitionId'],
    properties: {
      reportDefinitionId: { type: 'string', description: 'Id of the saved report definition to export.' },
      format: { type: 'string', description: "Export format. Empty string lets the report's own default_format decide; otherwise must be one of the report's allowed formats." },
      argumentModes: {
        type: 'object',
        description: "Per-argument value source, keyed by the report's argument key. 'current_record' binds a reference argument targeting THIS form to the record the action was invoked on; 'prompt' asks the person at click time (the default for any argument with no entry); 'skip' omits an OPTIONAL argument so its filter drops out entirely.",
        additionalProperties: { type: 'string', enum: ['current_record', 'prompt', 'skip'] },
      },
    },
  },
  parseConfig: parseExportReportActionConfig,
  createDefaultConfig: emptyExportReportActionConfig,
  ConfigPanel: ExportReportConfigPanel,
  MenuItem: ExportReportMenuItem,
})
