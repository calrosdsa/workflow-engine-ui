import { MessageSquare } from 'lucide-react'
import { registerDetailTab } from '../registry'
import { parseCommentTabConfig, emptyCommentTabConfig } from './schema'
import { CommentTabRenderer } from './Renderer'

registerDetailTab({
  type: 'comment',
  label: 'Comments',
  icon: MessageSquare,
  description: 'A comment thread on this record — post, edit, and delete comments.',
  configSchema: { type: 'object', description: 'No configuration.', properties: {} },
  // Platform chrome now — pinned into every record detail page's activity
  // strip by registry.ts's CHROME_ZONES, hideable but not removable.
  builtin: true,
  parseConfig: parseCommentTabConfig,
  createDefaultConfig: emptyCommentTabConfig,
  Renderer: CommentTabRenderer,
})
