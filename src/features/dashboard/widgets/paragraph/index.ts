import { Pilcrow } from 'lucide-react'
import { registerWidget } from '../../widget-registry'
import { parseParagraphConfig, createDefaultParagraphConfig , PARAGRAPH_CONFIG_SCHEMA } from './schema'
import { ParagraphRenderer } from './Renderer'
import { ParagraphConfigPanel } from './ConfigPanel'

registerWidget({
  type: 'paragraph',
  label: 'Paragraph',
  icon: Pilcrow,
  category: 'Content',
  description: 'Static text block',
  configSchema: PARAGRAPH_CONFIG_SCHEMA,
  parseConfig: parseParagraphConfig,
  createDefaultConfig: createDefaultParagraphConfig,
  defaultLayout: { w: 6, h: 3, minW: 2, minH: 2 },
  defaultChrome: 'plain',
  Renderer: ParagraphRenderer,
  ConfigPanel: ParagraphConfigPanel,
})
