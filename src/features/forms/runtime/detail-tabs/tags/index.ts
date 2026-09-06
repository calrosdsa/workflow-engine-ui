import { Tag } from 'lucide-react'
import { registerDetailTab } from '../registry'
import { parseTagsTabConfig, emptyTagsTabConfig } from './schema'
import { TagsTabRenderer } from './Renderer'

registerDetailTab({
  type: 'tags',
  label: 'Tags',
  icon: Tag,
  description: 'Free-text labels attached to this record.',
  configSchema: { type: 'object', description: 'No configuration.', properties: {} },
  // See attachments/index.ts's identical comment — backfilled via
  // registry.ts's ALWAYS_PRESENT_TYPES.
  builtin: true,
  parseConfig: parseTagsTabConfig,
  createDefaultConfig: emptyTagsTabConfig,
  Renderer: TagsTabRenderer,
})
