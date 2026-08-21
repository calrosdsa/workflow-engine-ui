import { LayoutDashboard } from 'lucide-react'
import { registerDetailTab } from '../registry'
import { parseCustomTabConfig, emptyCustomTabConfig } from './schema'
import { CustomTabRenderer } from './Renderer'
import { CustomTabConfigPanel } from './ConfigPanel'

registerDetailTab({
  type: 'custom',
  label: 'Custom',
  icon: LayoutDashboard,
  description: 'A widget grid — the same Table/Chart/etc. widgets a Dashboard menu uses.',
  parseConfig: parseCustomTabConfig,
  createDefaultConfig: emptyCustomTabConfig,
  Renderer: CustomTabRenderer,
  ConfigPanel: CustomTabConfigPanel,
})
