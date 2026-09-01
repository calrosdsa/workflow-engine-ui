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
  configSchema: {
    type: 'object',
    required: ['tabs'],
    properties: {
      tabs: {
        type: 'array',
        description: 'The grouped tabs. Each entry is a full detail-tab entry — same shape as detail_tab_envelope. Nesting is capped at depth 4.',
        items: { type: 'object' },
      },
    },
  },
  parseConfig: parseGroupTabConfig,
  createDefaultConfig: emptyGroupTabConfig,
  Renderer: GroupTabRenderer,
  ConfigPanel: GroupTabConfigPanel,
})
