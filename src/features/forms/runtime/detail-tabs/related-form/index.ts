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
  configSchema: {
    type: 'object',
    required: ['targetFormId', 'targetFieldName'],
    properties: {
      targetFormId: { type: 'string', description: 'Id of the OTHER form whose records to show.' },
      targetFieldName: { type: 'string', description: 'A reference field ON the target form that points back at this form — how its records are matched to this record.' },
      additionalFilter: { type: 'object', description: 'A FilterGroup ANDed onto the reference match. Same filter grammar workflow nodes use.' },
      sort: { type: 'array', description: 'SortRule list: [{"field", "dir"}].', items: { type: 'object' } },
      columns: { type: 'array', description: "Field keys of the TARGET form to show as columns, in order. Absent shows the target's defaults.", items: { type: 'string' } },
      hideWhenEmpty: { type: 'boolean', description: 'Hide the whole tab when no records match — resolved after fetch.' },
    },
  },
  parseConfig: parseRelatedFormConfig,
  createDefaultConfig: emptyRelatedFormConfig,
  Renderer: RelatedFormTabRenderer,
  ConfigPanel: RelatedFormConfigPanel,
})
