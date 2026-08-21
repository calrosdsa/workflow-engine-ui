import { GitBranch } from 'lucide-react'
import { registerDetailTab } from '../registry'
import { parseRelatedFormConfig, emptyRelatedFormConfig } from './schema'
import { RelatedFormTabRenderer } from './Renderer'
import { RelatedFormConfigPanel } from './ConfigPanel'

registerDetailTab({
  type: 'related_form',
  label: 'Related Form',
  icon: GitBranch,
  description: 'A filtered, sorted view of records from another form that reference this one.',
  parseConfig: parseRelatedFormConfig,
  createDefaultConfig: emptyRelatedFormConfig,
  Renderer: RelatedFormTabRenderer,
  ConfigPanel: RelatedFormConfigPanel,
})
