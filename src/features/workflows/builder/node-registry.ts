import type { NodeType, Port, SetVariableConfig, ConditionConfig } from '../types'

export interface NodeRegistryEntry {
  label: string
  color: string          // Tailwind bg class
  textColor: string      // Tailwind text class
  description: string
}

export const NODE_REGISTRY: Record<NodeType, NodeRegistryEntry> = {
  entry:        { label: 'Start',         color: 'bg-emerald-500', textColor: 'text-emerald-700', description: 'Workflow entry point' },
  exit:         { label: 'End',           color: 'bg-gray-400',    textColor: 'text-gray-600',    description: 'Workflow exit point' },
  set_variable: { label: 'Set Variable',  color: 'bg-blue-500',    textColor: 'text-blue-700',    description: 'Assign a variable value' },
  condition:    { label: 'Condition',     color: 'bg-amber-500',   textColor: 'text-amber-700',   description: 'Branch on a boolean expression' },
  subflow:      { label: 'Subflow',       color: 'bg-purple-500',  textColor: 'text-purple-700',  description: 'Run a nested workflow' },
  merge:        { label: 'Merge',         color: 'bg-teal-500',    textColor: 'text-teal-700',    description: 'Join parallel branches' },
}

export function defaultLabel(type: NodeType): string {
  return NODE_REGISTRY[type]?.label ?? type
}

export function defaultPorts(type: NodeType): { inputs: Port[]; outputs: Port[] } {
  switch (type) {
    case 'entry':
      return { inputs: [], outputs: [{ id: 'out', label: 'out', kind: 'control' }] }
    case 'exit':
      return { inputs: [{ id: 'in', label: 'in', kind: 'control' }], outputs: [] }
    case 'condition':
      return {
        inputs:  [{ id: 'in',    label: 'in',    kind: 'control' }],
        outputs: [
          { id: 'true',  label: 'true',  kind: 'control' },
          { id: 'false', label: 'false', kind: 'control' },
        ],
      }
    case 'merge':
      return {
        inputs:  [{ id: 'a', label: 'a', kind: 'control' }, { id: 'b', label: 'b', kind: 'control' }],
        outputs: [{ id: 'out', label: 'out', kind: 'control' }],
      }
    default:
      return {
        inputs:  [{ id: 'in',  label: 'in',  kind: 'control' }],
        outputs: [{ id: 'out', label: 'out', kind: 'control' }],
      }
  }
}

export function defaultConfig(type: NodeType): SetVariableConfig | ConditionConfig | Record<string, never> {
  switch (type) {
    case 'set_variable':
      return { variable_name: '', mode: 'literal', literal_value: '' } satisfies SetVariableConfig
    case 'condition':
      return { expression: '' } satisfies ConditionConfig
    default:
      return {}
  }
}

// Node types available from the drag-and-drop palette (excludes entry/exit added automatically)
export const PALETTE_NODES: NodeType[] = ['set_variable', 'condition', 'merge', 'subflow']
