import { Link as LinkIcon } from 'lucide-react'
import { registerWidget } from '../../widget-registry'
import { parseQuickLinksConfig, createDefaultQuickLinksConfig } from './schema'
import { QuickLinksRenderer } from './Renderer'
import { QuickLinksConfigPanel } from './ConfigPanel'

registerWidget({
  type: 'quick-links',
  label: 'Quick Links',
  icon: LinkIcon,
  category: 'Navigation',
  description: 'Shortcuts to menus, forms, or external URLs',
  parseConfig: parseQuickLinksConfig,
  createDefaultConfig: createDefaultQuickLinksConfig,
  defaultLayout: { w: 3, h: 4, minW: 2, minH: 2 },
  defaultChrome: 'card',
  Renderer: QuickLinksRenderer,
  ConfigPanel: QuickLinksConfigPanel,
})
