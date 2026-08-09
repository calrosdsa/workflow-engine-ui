import { BarChart3 } from 'lucide-react'
import { registerWidget } from '../../widget-registry'
import { parseChartConfig, createDefaultChartConfig } from './schema'
import { ChartRenderer } from './Renderer'
import { ChartConfigPanel } from './ConfigPanel'

registerWidget({
  type: 'chart',
  label: 'Chart',
  icon: BarChart3,
  category: 'Data',
  description: 'Bar, line, area, pie, or a single stat, from form data',
  parseConfig: parseChartConfig,
  createDefaultConfig: createDefaultChartConfig,
  defaultLayout: { w: 6, h: 6, minW: 3, minH: 3 },
  defaultChrome: 'card',
  Renderer: ChartRenderer,
  ConfigPanel: ChartConfigPanel,
})
