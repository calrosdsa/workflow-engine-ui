import { Minus } from 'lucide-react'
import { registerWidget } from '../../widget-registry'
import { DividerRenderer } from './Renderer'
import { DividerConfigPanel } from './ConfigPanel'

registerWidget<Record<string, never>>({
  type: 'divider',
  label: 'Divider',
  icon: Minus,
  category: 'Content',
  description: 'Horizontal line',
  parseConfig: () => ({}),
  createDefaultConfig: () => ({}),
  defaultLayout: { w: 6, h: 1, minW: 2, minH: 1 },
  defaultChrome: 'plain',
  Renderer: DividerRenderer,
  ConfigPanel: DividerConfigPanel,
})
