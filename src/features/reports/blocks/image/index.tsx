import { ImageIcon } from 'lucide-react'
import { registerReportBlock } from '../../report-block-registry'
import { emptyImageBlockConfig, parseImageBlockConfig } from './schema'
import { ImageBlockPreview } from './Preview'
import { ImageBlockConfigPanel } from './ConfigPanel'

registerReportBlock({
  type: 'image',
  label: 'Image',
  icon: ImageIcon,
  description: 'A logo or picture — from a URL or an upload',
  parseConfig: parseImageBlockConfig,
  createDefaultConfig: emptyImageBlockConfig,
  defaultLayout: { col_span: 4, row_span: 4 },
  Preview: ImageBlockPreview,
  ConfigPanel: ImageBlockConfigPanel,
})
