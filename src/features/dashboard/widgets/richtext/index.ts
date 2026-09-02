import { FileText } from 'lucide-react'
import { registerWidget } from '../../widget-registry'
import { parseRichTextConfig, createDefaultRichTextConfig , RICHTEXT_CONFIG_SCHEMA } from './schema'
import { RichTextRenderer } from './Renderer'
import { RichTextConfigPanel } from './ConfigPanel'

registerWidget({
  type: 'richtext',
  label: 'Rich Text',
  icon: FileText,
  category: 'Content',
  description: 'Formatted text written in Markdown',
  configSchema: RICHTEXT_CONFIG_SCHEMA,
  parseConfig: parseRichTextConfig,
  createDefaultConfig: createDefaultRichTextConfig,
  defaultLayout: { w: 6, h: 4, minW: 2, minH: 2 },
  defaultChrome: 'plain',
  Renderer: RichTextRenderer,
  ConfigPanel: RichTextConfigPanel,
})
