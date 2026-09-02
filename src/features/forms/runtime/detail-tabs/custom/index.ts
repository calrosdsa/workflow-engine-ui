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
  configSchema: {
    type: 'object',
    required: ['schema'],
    properties: {
      schema: { type: 'object', description: 'DashboardSchema — the widget grid, same shape a dashboard menu stores; authored against this catalog’s `dashboards` section (envelope, widget_envelope, widgets). Widgets rendering here may read the record context — e.g. the table widget’s scopeToRecord.' },
    },
  },
  parseConfig: parseCustomTabConfig,
  createDefaultConfig: emptyCustomTabConfig,
  Renderer: CustomTabRenderer,
  ConfigPanel: CustomTabConfigPanel,
})
