import {
  Play,
  CircleStop,
  Variable,
  GitBranch,
  Box,
  GitMerge,
  type LucideIcon,
} from 'lucide-react'
import type { NodeType, Port, SetVariableConfig, ConditionConfig } from '../types'

export interface NodeRegistryEntry {
  label: string
  icon: LucideIcon
  color: string          // Tailwind bg class (solid)
  gradient: string       // Tailwind gradient classes for node header
  accent: string         // hex used by minimap / handles
  textColor: string      // Tailwind text class
  ring: string           // soft tint background (palette / picker icon bg)
  description: string
}

export const NODE_REGISTRY: Record<NodeType, NodeRegistryEntry> = {
  entry: {
    label: 'Start', icon: Play,
    color: 'bg-emerald-500', gradient: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
    accent: '#10b981', textColor: 'text-emerald-700', ring: 'bg-emerald-50',
    description: 'Workflow entry point',
  },
  exit: {
    label: 'End', icon: CircleStop,
    color: 'bg-slate-500', gradient: 'bg-gradient-to-br from-slate-500 to-slate-600',
    accent: '#64748b', textColor: 'text-slate-700', ring: 'bg-slate-100',
    description: 'Workflow exit point',
  },
  set_variable: {
    label: 'Set Variable', icon: Variable,
    color: 'bg-blue-500', gradient: 'bg-gradient-to-br from-blue-500 to-blue-600',
    accent: '#3b82f6', textColor: 'text-blue-700', ring: 'bg-blue-50',
    description: 'Assign a variable value',
  },
  condition: {
    label: 'Condition', icon: GitBranch,
    color: 'bg-amber-500', gradient: 'bg-gradient-to-br from-amber-500 to-orange-500',
    accent: '#f59e0b', textColor: 'text-amber-700', ring: 'bg-amber-50',
    description: 'Branch on a boolean expression',
  },
  subflow: {
    label: 'Subflow', icon: Box,
    color: 'bg-violet-500', gradient: 'bg-gradient-to-br from-violet-500 to-purple-600',
    accent: '#8b5cf6', textColor: 'text-violet-700', ring: 'bg-violet-50',
    description: 'Run a nested workflow',
  },
  merge: {
    label: 'Merge', icon: GitMerge,
    color: 'bg-teal-500', gradient: 'bg-gradient-to-br from-teal-500 to-cyan-600',
    accent: '#14b8a6', textColor: 'text-teal-700', ring: 'bg-teal-50',
    description: 'Join parallel branches',
  },
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
