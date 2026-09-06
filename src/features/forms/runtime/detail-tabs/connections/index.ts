import { Grid2x2 } from 'lucide-react'
import { registerDetailTab } from '../registry'
import { parseConnectionsConfig, emptyConnectionsConfig } from './schema'
import { ConnectionsTabRenderer } from './Renderer'
import { ConnectionsConfigPanel } from './ConfigPanel'

registerDetailTab({
  type: 'connections',
  label: 'Connections',
  icon: Grid2x2,
  description: 'A grid of tiles — one per linked form — grouped under named categories, each with a record count and a quick-create button.',
  configSchema: {
    type: 'object',
    required: ['connections'],
    properties: {
      connections: {
        type: 'array',
        description: 'One entry per tile.',
        items: {
          type: 'object',
          required: ['targetFormId', 'targetFieldName'],
          properties: {
            targetFormId: { type: 'string', description: 'Id of the OTHER form this tile links to.' },
            targetFieldName: { type: 'string', description: 'A reference field ON the target form that points back at this form.' },
            label: { type: 'string', description: "Overrides the target form's name as the tile title." },
            category: { type: 'string', description: 'Groups this tile under a named section header (e.g. "Buy", "Sell"). Omit to render ungrouped.' },
            targetMenuId: { type: 'string', description: 'A Search-type menu (its own form must equal targetFormId) to navigate to on click, with the relationship filter applied. Omit to expand an inline list instead.' },
            quickCreate: {
              type: 'string',
              enum: ['dialog', 'page', 'off'],
              description: "How the tile's + button works. 'dialog' (default): inline prefilled modal, never navigates away. 'page': full create page, unprefilled — use for a large/complex target form. 'off': no + button.",
            },
          },
        },
      },
      categoryOrder: {
        type: 'array',
        items: { type: 'string' },
        description: 'Explicit category display order; a category used by an entry above but absent here is appended after the named ones.',
      },
    },
  },
  parseConfig: parseConnectionsConfig,
  createDefaultConfig: emptyConnectionsConfig,
  Renderer: ConnectionsTabRenderer,
  ConfigPanel: ConnectionsConfigPanel,
})
