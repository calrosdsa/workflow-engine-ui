import { Paperclip } from 'lucide-react'
import { registerDetailTab } from '../registry'
import { parseAttachmentsTabConfig, emptyAttachmentsTabConfig } from './schema'
import { AttachmentsTabRenderer } from './Renderer'

registerDetailTab({
  type: 'attachments',
  label: 'Attachments',
  icon: Paperclip,
  description: 'Files attached to this record — upload, download, and delete.',
  configSchema: { type: 'object', description: 'No configuration.', properties: {} },
  // Backfilled onto every form regardless of its saved tab list — see
  // registry.ts's ALWAYS_PRESENT_TYPES. builtin: true here is what makes
  // that actually mean something: removing the entry (TabCard.tsx's
  // Remove button) doesn't stick, only hiding it does.
  builtin: true,
  parseConfig: parseAttachmentsTabConfig,
  createDefaultConfig: emptyAttachmentsTabConfig,
  Renderer: AttachmentsTabRenderer,
})
