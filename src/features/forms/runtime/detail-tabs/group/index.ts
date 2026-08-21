import { FolderTree } from 'lucide-react'
import { registerDetailTab } from '../registry'
import { parseGroupTabConfig, emptyGroupTabConfig } from './schema'
import { GroupTabRenderer } from './Renderer'
import { GroupTabConfigPanel } from './ConfigPanel'

registerDetailTab({
  type: 'group',
  label: 'Tab Group',
  icon: FolderTree,
  description: 'Nested tabs — group several tabs together under one, e.g. "Comments" and "History" inside "Details".',
  parseConfig: parseGroupTabConfig,
  createDefaultConfig: emptyGroupTabConfig,
  Renderer: GroupTabRenderer,
  ConfigPanel: GroupTabConfigPanel,
})
