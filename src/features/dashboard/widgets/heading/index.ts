import { Heading } from 'lucide-react'
import { registerWidget } from '../../widget-registry'
import { parseHeadingConfig, createDefaultHeadingConfig , HEADING_CONFIG_SCHEMA } from './schema'
import { HeadingRenderer } from './Renderer'
import { HeadingConfigPanel } from './ConfigPanel'

registerWidget({
  type: 'heading',
  label: 'Heading',
  icon: Heading,
  category: 'Content',
  description: 'Section heading',
  configSchema: HEADING_CONFIG_SCHEMA,
  parseConfig: parseHeadingConfig,
  createDefaultConfig: createDefaultHeadingConfig,
  defaultLayout: { w: 6, h: 2, minW: 2, minH: 1 },
  defaultChrome: 'plain',
  Renderer: HeadingRenderer,
  ConfigPanel: HeadingConfigPanel,
})
