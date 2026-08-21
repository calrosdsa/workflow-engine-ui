import { MessageSquare } from 'lucide-react'
import { registerDetailTab } from '../registry'
import { parseCommentTabConfig, emptyCommentTabConfig } from './schema'
import { CommentTabRenderer } from './Renderer'

registerDetailTab({
  type: 'comment',
  label: 'Comments',
  icon: MessageSquare,
  description: 'A comment thread on this record — post, edit, and delete comments.',
  parseConfig: parseCommentTabConfig,
  createDefaultConfig: emptyCommentTabConfig,
  Renderer: CommentTabRenderer,
})
