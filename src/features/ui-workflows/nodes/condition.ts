import { GitBranch } from 'lucide-react'
import { registerUiWorkflowNode } from '../node-registry'
import { parseSteps } from '../parse'
import { ALL_PLATFORMS, type ConditionStepConfig, type UiWorkflowStep } from '../types'
import type { FilterGroup } from '@/features/workflows/types'

export function emptyConditionConfig(): ConditionStepConfig {
  return {
    when: { combinator: 'and', conditions: [], groups: [] },
    then: [],
    else: [],
  }
}

/** Never throws (registry contract). An empty/absent `when` heals to a group
 *  that matches everything, mirroring FilterGroup.IsEmpty() compiling to the
 *  literal `true` everywhere else in this codebase — "constrains nothing" is
 *  the established meaning of an empty filter here, not "matches nothing". */
export function parseConditionConfig(raw: unknown): ConditionStepConfig {
  const empty = emptyConditionConfig()
  if (!raw || typeof raw !== 'object') return empty
  const r = raw as Record<string, unknown>
  const when = r.when && typeof r.when === 'object' ? (r.when as FilterGroup) : empty.when
  return {
    when: {
      combinator: when.combinator === 'or' ? 'or' : 'and',
      conditions: Array.isArray(when.conditions) ? when.conditions : [],
      groups: Array.isArray(when.groups) ? when.groups : [],
      ...(when.id ? { id: when.id } : {}),
    },
    then: parseSteps(r.then),
    else: parseSteps(r.else),
  }
}

registerUiWorkflowNode({
  type: 'condition',
  label: 'If',
  icon: GitBranch,
  description:
    'Runs one branch of steps or the other, depending on a condition over the current record and the workflow’s own variables.',
  category: 'flow',
  // Same type string and the same FilterGroup grammar as the server's
  // `condition` node, so an author's mental model transfers — but evaluated
  // entirely on the client (lib/filter-eval), with no round-trip. That is the
  // whole point of choosing structured trees over Expr strings: an Expr
  // condition would make every branch a blocking network call.
  platforms: ALL_PLATFORMS,
  configSchema: {
    type: 'object',
    description:
      'Branch on a FilterGroup evaluated client-side. Same filter grammar as menus, saved views and workflow nodes.',
    required: ['when'],
    properties: {
      when: {
        type: 'object',
        description:
          'FilterGroup. Operators are limited to the client-evaluable set (no full-text `search`, no expression value mode) so a branch never needs a server round-trip. An empty group matches everything.',
      },
      then: { type: 'array', description: 'Steps to run when the condition matches.' },
      else: { type: 'array', description: 'Steps to run when it does not.' },
    },
  },
  parseConfig: parseConditionConfig,
  createDefaultConfig: emptyConditionConfig,
  childStepLists: (config): UiWorkflowStep[][] => {
    const c = config as ConditionStepConfig | null
    return [c?.then ?? [], c?.else ?? []]
  },
})
