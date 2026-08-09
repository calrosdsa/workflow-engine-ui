import { Code2 } from 'lucide-react'
import { registerWidget } from '../../widget-registry'
import { parseCustomHtmlConfig, createDefaultCustomHtmlConfig } from './schema'
import { CustomHtmlRenderer } from './Renderer'
import { CustomHtmlConfigPanel } from './ConfigPanel'

registerWidget({
  type: 'custom-html',
  label: 'Custom HTML',
  icon: Code2,
  category: 'Embed',
  description: 'Sanitized formatted content, or a sandboxed third-party embed code',
  parseConfig: parseCustomHtmlConfig,
  createDefaultConfig: createDefaultCustomHtmlConfig,
  defaultLayout: { w: 6, h: 4, minW: 2, minH: 2 },
  defaultChrome: 'card',
  Renderer: CustomHtmlRenderer,
  ConfigPanel: CustomHtmlConfigPanel,
})
