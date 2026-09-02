import { Link as LinkIcon } from 'lucide-react'
import { registerWidget } from '../../widget-registry'
import { parseQuickLinksConfig, createDefaultQuickLinksConfig , QUICK_LINKS_CONFIG_SCHEMA } from './schema'
import { QuickLinksRenderer } from './Renderer'
import { QuickLinksConfigPanel } from './ConfigPanel'

registerWidget({
  type: 'quick-links',
  label: 'Quick Links',
  icon: LinkIcon,
  category: 'Navigation',
  description: 'Shortcuts to menus, forms, or external URLs',
  configSchema: QUICK_LINKS_CONFIG_SCHEMA,
  parseConfig: parseQuickLinksConfig,
  createDefaultConfig: createDefaultQuickLinksConfig,
  defaultLayout: { w: 3, h: 4, minW: 2, minH: 2 },
  defaultChrome: 'card',
  Renderer: QuickLinksRenderer,
  ConfigPanel: QuickLinksConfigPanel,
})
