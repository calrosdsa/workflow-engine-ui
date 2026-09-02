import { GitBranch } from 'lucide-react'
import { FilterBuilder } from '@/features/workflows/builder/FilterBuilder'
import { registerUiWorkflowNode, type UiWorkflowNodeConfigPanelProps } from '../node-registry'
import { parseSteps } from '../parse'
import { evaluateFilterGroup } from '@/lib/filter-eval'
import { conditionValues } from '../values'
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

function ConditionPanel({ config, onChange, fields }: UiWorkflowNodeConfigPanelProps<ConditionStepConfig>) {
  return (
    <FilterBuilder
      group={config.when}
      fields={fields}
      variables={[]}
      onChange={(when) => onChange({ ...config, when })}
      // The operators a client cannot decide are hidden rather than offered
      // and then failing at runtime: `search` is full-text with no in-memory
      // equivalent, and an expression value would need the Go evaluator. Both
      // would turn a branch into a blocking network call — the exact thing
      // structured trees were chosen to avoid.
      hideExpressions
    />
  )
}

registerUiWorkflowNode({
  ConfigPanel: ConditionPanel,
  childStepLabels: ['If true', 'Otherwise'],
  childStepListKeys: ['then', 'else'],
  setChildStepList: (config, index, steps) => {
    const c = config as ConditionStepConfig
    return index === 0 ? { ...c, then: steps } : { ...c, else: steps }
  },
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
  execute: ({ config, ctx }) => {
    // Evaluated locally — no round-trip. matches is only trustworthy when
    // nothing was undecidable, and an undecidable condition here means the
    // SAME thing it means for Advanced Settings: the rule did not match.
    // Most often that is just an empty field with nothing to compare yet,
    // not a reason to guess.
    const { matches } = evaluateFilterGroup(config.when, { values: conditionValues(ctx) })
    // Nullish-guarded: an unparsed config may carry no branches at all, and
    // an absent branch means "nothing to run", not a crash.
    return { kind: 'enter', steps: (matches ? config.then : config.else) ?? [] }
  },
  parseConfig: parseConditionConfig,
  createDefaultConfig: emptyConditionConfig,
  childStepLists: (config): UiWorkflowStep[][] => {
    const c = config as ConditionStepConfig | null
    return [c?.then ?? [], c?.else ?? []]
  },
})
