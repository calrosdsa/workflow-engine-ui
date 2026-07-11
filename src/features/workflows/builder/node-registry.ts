import {
  Play,
  CircleStop,
  Zap,
  Variable,
  GitBranch,
  Box,
  GitMerge,
  Database,
  Repeat,
  FlagOff,
  DatabaseZap,
  Pencil,
  Trash2,
  Globe,
  MessageSquare,
  Wand2,
  Save,
  type LucideIcon,
} from 'lucide-react'
import type {
  NodeType, Port, SetVariableConfig, ConditionConfig, FetchRecordsConfig, IteratorConfig,
  UpsertRecordsConfig, UpdateRecordsConfig, DeleteRecordsConfig, HttpRequestConfig,
  TriggerConfig, ShowMessageConfig, TransformConfig, SaveRecordsConfig,
} from '../types'

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
    description: 'Workflow entry point (legacy)',
  },
  trigger: {
    label: 'Trigger', icon: Zap,
    color: 'bg-emerald-500', gradient: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
    accent: '#10b981', textColor: 'text-emerald-700', ring: 'bg-emerald-50',
    description: 'Entry point — on demand, scheduled, or on a record change',
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
  fetch_records: {
    label: 'Fetch Records', icon: Database,
    color: 'bg-rose-500', gradient: 'bg-gradient-to-br from-rose-500 to-pink-600',
    accent: '#f43f5e', textColor: 'text-rose-700', ring: 'bg-rose-50',
    description: 'Query records from a form',
  },
  upsert_records: {
    label: 'Upsert Record', icon: DatabaseZap,
    color: 'bg-indigo-500', gradient: 'bg-gradient-to-br from-indigo-500 to-blue-600',
    accent: '#6366f1', textColor: 'text-indigo-700', ring: 'bg-indigo-50',
    description: 'Create or update a record by its unique fields',
  },
  update_records: {
    label: 'Update Records', icon: Pencil,
    color: 'bg-sky-500', gradient: 'bg-gradient-to-br from-sky-500 to-cyan-600',
    accent: '#0ea5e9', textColor: 'text-sky-700', ring: 'bg-sky-50',
    description: 'Update record(s) matching a filter',
  },
  delete_records: {
    label: 'Delete Records', icon: Trash2,
    color: 'bg-red-500', gradient: 'bg-gradient-to-br from-red-500 to-rose-600',
    accent: '#ef4444', textColor: 'text-red-700', ring: 'bg-red-50',
    description: 'Delete record(s) matching a filter',
  },
  iterator: {
    label: 'Iterator', icon: Repeat,
    color: 'bg-amber-500', gradient: 'bg-gradient-to-br from-amber-500 to-yellow-600',
    accent: '#f59e0b', textColor: 'text-amber-700', ring: 'bg-amber-50',
    description: 'Loop over a list, running the body per item',
  },
  loop_end: {
    label: 'Loop End', icon: FlagOff,
    color: 'bg-slate-400', gradient: 'bg-gradient-to-br from-slate-400 to-slate-500',
    accent: '#94a3b8', textColor: 'text-slate-600', ring: 'bg-slate-100',
    description: 'Marks the end of a loop body',
  },
  http_request: {
    label: 'HTTP Request', icon: Globe,
    color: 'bg-cyan-500', gradient: 'bg-gradient-to-br from-cyan-500 to-blue-600',
    accent: '#06b6d4', textColor: 'text-cyan-700', ring: 'bg-cyan-50',
    description: 'Make an outbound HTTP call',
  },
  show_message: {
    label: 'Show Message', icon: MessageSquare,
    color: 'bg-fuchsia-500', gradient: 'bg-gradient-to-br from-fuchsia-500 to-pink-600',
    accent: '#d946ef', textColor: 'text-fuchsia-700', ring: 'bg-fuchsia-50',
    description: 'Publish a success/error/info message',
  },
  transform: {
    label: 'Transform', icon: Wand2,
    color: 'bg-purple-500', gradient: 'bg-gradient-to-br from-purple-500 to-fuchsia-600',
    accent: '#a855f7', textColor: 'text-purple-700', ring: 'bg-purple-50',
    description: 'Map a source list into a target form’s schema',
  },
  save_records: {
    label: 'Save Records', icon: Save,
    color: 'bg-indigo-600', gradient: 'bg-gradient-to-br from-indigo-600 to-violet-700',
    accent: '#4f46e5', textColor: 'text-indigo-700', ring: 'bg-indigo-50',
    description: 'Bulk upsert a list of records at once',
  },
}

export function defaultLabel(type: NodeType): string {
  return NODE_REGISTRY[type]?.label ?? type
}

export function defaultPorts(type: NodeType): { inputs: Port[]; outputs: Port[] } {
  switch (type) {
    case 'entry':
    case 'trigger':
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

export function defaultConfig(type: NodeType):
  | SetVariableConfig | ConditionConfig | FetchRecordsConfig | IteratorConfig
  | UpsertRecordsConfig | UpdateRecordsConfig | DeleteRecordsConfig | HttpRequestConfig
  | TriggerConfig | ShowMessageConfig | TransformConfig | SaveRecordsConfig
  | Record<string, never> {
  switch (type) {
    case 'trigger':
      return { mode: 'on_demand', enabled: true } satisfies TriggerConfig
    case 'show_message':
      return { message: '', message_type: 'info' } satisfies ShowMessageConfig
    case 'set_variable':
      return { assignments: [] } satisfies SetVariableConfig
    case 'condition':
      return { expression: '' } satisfies ConditionConfig
    case 'fetch_records':
      return {
        form_id: '', mode: 'many',
        filter: { combinator: 'and', conditions: [], groups: [] },
        sort: [], limit: 0, output_var: '',
      } satisfies FetchRecordsConfig
    case 'upsert_records':
      return { form_id: '', values: [] } satisfies UpsertRecordsConfig
    case 'update_records':
      return {
        form_id: '', mode: 'one',
        filter: { combinator: 'and', conditions: [], groups: [] },
        values: [],
      } satisfies UpdateRecordsConfig
    case 'delete_records':
      return {
        form_id: '', mode: 'one',
        filter: { combinator: 'and', conditions: [], groups: [] },
      } satisfies DeleteRecordsConfig
    case 'iterator':
      return {
        source_expr: '', item_var: 'item', index_var: 'index',
        filter_expr: '', stop_expr: '', max_iters: 0, loop_end_id: '',
      } satisfies IteratorConfig
    case 'http_request':
      return {
        method: 'GET', url: '', params: [], headers: [], body_mode: 'none', body_form: [],
        auth_type: 'none',
      } satisfies HttpRequestConfig
    case 'transform':
      return { source_expr: '', form_id: '', mappings: [] } satisfies TransformConfig
    case 'save_records':
      return { source_expr: '', form_id: '' } satisfies SaveRecordsConfig
    default:
      return {}
  }
}

// Node types available from the drag-and-drop palette (trigger/entry/exit and
// loop_end are added automatically — loop_end is auto-paired when an iterator
// is added; trigger/entry is seeded once when a new workflow is created).
export const PALETTE_NODES: NodeType[] = [
  'set_variable', 'condition', 'fetch_records', 'upsert_records', 'update_records',
  'delete_records', 'transform', 'save_records', 'iterator', 'http_request', 'show_message',
  'merge', 'subflow',
]
