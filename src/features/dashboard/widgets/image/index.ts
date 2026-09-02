import { Image as ImageIcon } from 'lucide-react'
import { registerWidget } from '../../widget-registry'
import { parseImageConfig, createDefaultImageConfig , IMAGE_CONFIG_SCHEMA } from './schema'
import { ImageRenderer } from './Renderer'
import { ImageConfigPanel } from './ConfigPanel'

registerWidget({
  type: 'image',
  label: 'Image',
  icon: ImageIcon,
  category: 'Content',
  description: 'A static image',
  configSchema: IMAGE_CONFIG_SCHEMA,
  parseConfig: parseImageConfig,
  createDefaultConfig: createDefaultImageConfig,
  defaultLayout: { w: 4, h: 4, minW: 2, minH: 2 },
  defaultChrome: 'plain',
  Renderer: ImageRenderer,
  ConfigPanel: ImageConfigPanel,
})
