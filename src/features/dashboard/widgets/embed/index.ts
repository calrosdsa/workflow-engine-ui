import { Globe } from 'lucide-react'
import { registerWidget } from '../../widget-registry'
import { parseEmbedConfig, createDefaultEmbedConfig , EMBED_CONFIG_SCHEMA } from './schema'
import { EmbedRenderer } from './Renderer'
import { EmbedConfigPanel } from './ConfigPanel'

registerWidget({
  type: 'embed',
  label: 'Embed',
  icon: Globe,
  category: 'Embed',
  description: 'An external webpage, optionally single-signed-on via a registered integration',
  configSchema: EMBED_CONFIG_SCHEMA,
  parseConfig: parseEmbedConfig,
  createDefaultConfig: createDefaultEmbedConfig,
  defaultLayout: { w: 6, h: 6, minW: 3, minH: 3 },
  defaultChrome: 'card',
  Renderer: EmbedRenderer,
  ConfigPanel: EmbedConfigPanel,
})
