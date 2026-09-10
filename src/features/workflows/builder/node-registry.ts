import type { ComponentType } from 'react'
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
  Bell,
  Mail,
  BookOpen,
  BookOpenCheck,
  Bug,
  Bot,
  MessageCircle,
  FileBarChart,
  type LucideIcon,
} from 'lucide-react'
import type {
  NodeType, Port, VariableDecl, SetVariableConfig, ConditionConfig, FetchRecordsConfig, IteratorConfig,
  UpsertRecordsConfig, UpdateRecordsConfig, DeleteRecordsConfig, HttpRequestConfig,
  TriggerConfig, ShowMessageConfig, TransformConfig, SaveRecordsConfig, NotificationConfig, EmailConfig,
  KnowledgeRetrievalConfig, KnowledgeIngestConfig, DebugConfig, SubflowConfig,
  RunAgentConfig, SendToSessionConfig, ReportGenerateConfig,
} from '../types'
import type { NodeOutputSchema } from './node-output-schema'
import { TriggerForm, normaliseTriggerConfig } from './node-forms/TriggerForm'
import { ShowMessageForm, normaliseShowMessageConfig } from './node-forms/ShowMessageForm'
import { SetVariableForm, normaliseSetVariableConfig } from './node-forms/SetVariableForm'
import { ConditionForm, normaliseConditionConfig } from './node-forms/ConditionForm'
import { SubflowForm, normaliseSubflowConfig } from './node-forms/SubflowForm'
import { FetchRecordsForm, normaliseFetchRecordsConfig } from './node-forms/FetchRecordsForm'
import { UpsertRecordsForm, normaliseUpsertRecordsConfig } from './node-forms/UpsertRecordsForm'
import { UpdateRecordsForm, normaliseUpdateRecordsConfig } from './node-forms/UpdateRecordsForm'
import { DeleteRecordsForm, normaliseDeleteRecordsConfig } from './node-forms/DeleteRecordsForm'
import { TransformForm, normaliseTransformConfig } from './node-forms/TransformForm'
import { SaveRecordsForm, normaliseSaveRecordsConfig } from './node-forms/SaveRecordsForm'
import { IteratorForm, normaliseIteratorConfig } from './node-forms/IteratorForm'
import { HttpRequestForm, normaliseHttpRequestConfig } from './node-forms/HttpRequestForm'
import { NotificationForm, normaliseNotificationConfig } from './node-forms/NotificationForm'
import { EmailForm, normaliseEmailConfig } from './node-forms/EmailForm'
import { KnowledgeRetrievalForm, normaliseKnowledgeRetrievalConfig } from './node-forms/KnowledgeRetrievalForm'
import { KnowledgeIngestForm, normaliseKnowledgeIngestConfig } from './node-forms/KnowledgeIngestForm'
import { DebugForm, normaliseDebugConfig } from './node-forms/DebugForm'
import { RunAgentForm, normaliseRunAgentConfig } from './node-forms/RunAgentForm'
import { SendToSessionForm, normaliseSendToSessionConfig } from './node-forms/SendToSessionForm'
import { GenerateReportForm, normaliseReportGenerateConfig } from './node-forms/GenerateReportForm'
import { NoAdditionalConfig, LoopEndNoConfig } from './node-forms/NoConfigNeeded'

// The fixed prop shape every node type's config form receives — unused props
// are simply unused by an individual form (e.g. ShowMessageForm ignores
// nodeContext). `config`/`onChange` are opaque here because each node type's
// concrete Config differs; the registry entry's own `form`/`normalise` pair
// narrows to the real type internally, and a form component typed to a
// narrower/concrete props shape is still assignable to ComponentType<
// NodeFormProps> (verified: React's prop contravariance permits a component
// accepting fewer/narrower props than a generic caller supplies).
export interface NodeFormProps {
  config: unknown
  variables: VariableDecl[]
  nodeContext: NodeOutputSchema[]
  onChange: (c: unknown) => void
}

// A category id from the SHARED vocabulary, which lives in Go
// (internal/graph's categoryCatalog) and is served via /meta/node-taxonomy —
// see node-taxonomy.ts for the full rationale.
//
// Deliberately `string`, not a union of the ids this build happens to know.
// A union here is what this replaced: it drifted from the backend's list in
// both directions, and made a category added server-side unrepresentable
// without a frontend release. The value below is a FALLBACK used until the
// taxonomy fetch lands; the server's answer wins from then on, so an id this
// build has never seen must be expressible.
export type NodeCategory = string

export interface NodeRegistryEntry {
  label: string
  icon: LucideIcon
  color: string          // Tailwind bg class (solid)
  gradient: string       // Tailwind gradient classes for node header
  accent: string         // hex used by minimap / handles
  textColor: string      // Tailwind text class
  ring: string           // soft tint background (palette / picker icon bg)
  description: string
  /** Renders this node type's config panel body. */
  form: ComponentType<NodeFormProps>
  /** Normalises a raw (possibly legacy/partial) stored config into this
   *  type's well-formed shape. Identity for types whose config shape has
   *  been stable since the DAG redesign (condition/subflow/iterator). */
  normalise: (raw: unknown) => unknown
  /** Fallback category for this type, used until /meta/node-taxonomy loads
   *  (and on a backend that predates it). Required for every PALETTE_NODES
   *  member — enforced by assertPaletteCategories below — so the picker's
   *  tabs can never drift out of sync with the palette the way they once
   *  did (FR-C5-012).
   *
   *  Not authoritative: the served taxonomy overrides it, which is how a
   *  node can be re-grouped without a frontend release. Lining the two up
   *  for the first time found generate_report filed here under 'Knowledge'
   *  while the backend had always called it 'output'. */
  category?: NodeCategory
}

export const NODE_REGISTRY: Record<NodeType, NodeRegistryEntry> = {
  entry: {
    label: 'Start', icon: Play,
    color: 'bg-emerald-500', gradient: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
    accent: '#10b981', textColor: 'text-emerald-700', ring: 'bg-emerald-50',
    description: 'Workflow entry point (legacy)',
    form: NoAdditionalConfig as ComponentType<NodeFormProps>,
    normalise: (raw) => raw,
  },
  trigger: {
    label: 'Trigger', icon: Zap,
    color: 'bg-emerald-500', gradient: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
    accent: '#10b981', textColor: 'text-emerald-700', ring: 'bg-emerald-50',
    description: 'Entry point — on demand, scheduled, or on a record change',
    form: TriggerForm as unknown as ComponentType<NodeFormProps>,
    normalise: (raw) => normaliseTriggerConfig(raw),
  },
  exit: {
    label: 'End', icon: CircleStop,
    color: 'bg-slate-500', gradient: 'bg-gradient-to-br from-slate-500 to-slate-600',
    accent: '#64748b', textColor: 'text-slate-700', ring: 'bg-slate-100',
    description: 'Workflow exit point',
    form: NoAdditionalConfig as ComponentType<NodeFormProps>,
    normalise: (raw) => raw,
  },
  set_variable: {
    label: 'Set Variable', icon: Variable,
    color: 'bg-blue-500', gradient: 'bg-gradient-to-br from-blue-500 to-blue-600',
    accent: '#3b82f6', textColor: 'text-blue-700', ring: 'bg-blue-50',
    description: 'Assign a variable value',
    form: SetVariableForm as unknown as ComponentType<NodeFormProps>,
    normalise: (raw) => normaliseSetVariableConfig(raw),
    category: 'data',
  },
  condition: {
    label: 'Condition', icon: GitBranch,
    color: 'bg-amber-500', gradient: 'bg-gradient-to-br from-amber-500 to-orange-500',
    accent: '#f59e0b', textColor: 'text-amber-700', ring: 'bg-amber-50',
    description: 'Continue only when a condition holds (optionally branch true/false)',
    form: ConditionForm as unknown as ComponentType<NodeFormProps>,
    normalise: (raw) => normaliseConditionConfig(raw),
    category: 'logic',
  },
  subflow: {
    label: 'Execute Workflow', icon: Box,
    color: 'bg-violet-500', gradient: 'bg-gradient-to-br from-violet-500 to-purple-600',
    accent: '#8b5cf6', textColor: 'text-violet-700', ring: 'bg-violet-50',
    description: 'Run another saved workflow, with input/output mapping',
    form: SubflowForm as unknown as ComponentType<NodeFormProps>,
    normalise: (raw) => normaliseSubflowConfig(raw),
    category: 'logic',
  },
  merge: {
    label: 'Merge', icon: GitMerge,
    color: 'bg-teal-500', gradient: 'bg-gradient-to-br from-teal-500 to-cyan-600',
    accent: '#14b8a6', textColor: 'text-teal-700', ring: 'bg-teal-50',
    description: 'Join parallel branches',
    form: NoAdditionalConfig as ComponentType<NodeFormProps>,
    normalise: (raw) => raw,
    category: 'logic',
  },
  fetch_records: {
    label: 'Fetch Records', icon: Database,
    color: 'bg-rose-500', gradient: 'bg-gradient-to-br from-rose-500 to-pink-600',
    accent: '#f43f5e', textColor: 'text-rose-700', ring: 'bg-rose-50',
    description: 'Query records from a form',
    form: FetchRecordsForm as unknown as ComponentType<NodeFormProps>,
    normalise: (raw) => normaliseFetchRecordsConfig(raw),
    category: 'data',
  },
  upsert_records: {
    label: 'Upsert Record', icon: DatabaseZap,
    color: 'bg-indigo-500', gradient: 'bg-gradient-to-br from-indigo-500 to-blue-600',
    accent: '#6366f1', textColor: 'text-indigo-700', ring: 'bg-indigo-50',
    description: 'Create or update a record by its unique fields',
    form: UpsertRecordsForm as unknown as ComponentType<NodeFormProps>,
    normalise: (raw) => normaliseUpsertRecordsConfig(raw),
    category: 'data',
  },
  update_records: {
    label: 'Update Records', icon: Pencil,
    color: 'bg-sky-500', gradient: 'bg-gradient-to-br from-sky-500 to-cyan-600',
    accent: '#0ea5e9', textColor: 'text-sky-700', ring: 'bg-sky-50',
    description: 'Update record(s) matching a filter',
    form: UpdateRecordsForm as unknown as ComponentType<NodeFormProps>,
    normalise: (raw) => normaliseUpdateRecordsConfig(raw),
    category: 'data',
  },
  delete_records: {
    label: 'Delete Records', icon: Trash2,
    color: 'bg-red-500', gradient: 'bg-gradient-to-br from-red-500 to-rose-600',
    accent: '#ef4444', textColor: 'text-red-700', ring: 'bg-red-50',
    description: 'Delete record(s) matching a filter',
    form: DeleteRecordsForm as unknown as ComponentType<NodeFormProps>,
    normalise: (raw) => normaliseDeleteRecordsConfig(raw),
    category: 'data',
  },
  iterator: {
    label: 'Iterator', icon: Repeat,
    color: 'bg-amber-500', gradient: 'bg-gradient-to-br from-amber-500 to-yellow-600',
    accent: '#f59e0b', textColor: 'text-amber-700', ring: 'bg-amber-50',
    description: 'Loop over a list, running the body per item',
    form: IteratorForm as unknown as ComponentType<NodeFormProps>,
    normalise: (raw) => normaliseIteratorConfig(raw),
    category: 'logic',
  },
  loop_end: {
    label: 'Loop End', icon: FlagOff,
    color: 'bg-slate-400', gradient: 'bg-gradient-to-br from-slate-400 to-slate-500',
    accent: '#94a3b8', textColor: 'text-slate-600', ring: 'bg-slate-100',
    description: 'Marks the end of a loop body',
    form: LoopEndNoConfig as ComponentType<NodeFormProps>,
    normalise: (raw) => raw,
  },
  http_request: {
    label: 'HTTP Request', icon: Globe,
    color: 'bg-cyan-500', gradient: 'bg-gradient-to-br from-cyan-500 to-blue-600',
    accent: '#06b6d4', textColor: 'text-cyan-700', ring: 'bg-cyan-50',
    description: 'Make an outbound HTTP call',
    form: HttpRequestForm as unknown as ComponentType<NodeFormProps>,
    normalise: (raw) => normaliseHttpRequestConfig(raw),
    category: 'integration',
  },
  show_message: {
    label: 'Show Message', icon: MessageSquare,
    color: 'bg-fuchsia-500', gradient: 'bg-gradient-to-br from-fuchsia-500 to-pink-600',
    accent: '#d946ef', textColor: 'text-fuchsia-700', ring: 'bg-fuchsia-50',
    description: 'Publish a success/error/info message',
    form: ShowMessageForm as unknown as ComponentType<NodeFormProps>,
    normalise: (raw) => normaliseShowMessageConfig(raw),
    category: 'notify',
  },
  transform: {
    label: 'Transform', icon: Wand2,
    color: 'bg-purple-500', gradient: 'bg-gradient-to-br from-purple-500 to-fuchsia-600',
    accent: '#a855f7', textColor: 'text-purple-700', ring: 'bg-purple-50',
    description: 'Map a source list into a target form’s schema',
    form: TransformForm as unknown as ComponentType<NodeFormProps>,
    normalise: (raw) => normaliseTransformConfig(raw),
    category: 'data',
  },
  save_records: {
    label: 'Save Records', icon: Save,
    color: 'bg-indigo-600', gradient: 'bg-gradient-to-br from-indigo-600 to-violet-700',
    accent: '#4f46e5', textColor: 'text-indigo-700', ring: 'bg-indigo-50',
    description: 'Bulk upsert a list of records at once',
    form: SaveRecordsForm as unknown as ComponentType<NodeFormProps>,
    normalise: (raw) => normaliseSaveRecordsConfig(raw),
    category: 'data',
  },
  notification: {
    label: 'Notification', icon: Bell,
    color: 'bg-fuchsia-600', gradient: 'bg-gradient-to-br from-fuchsia-600 to-purple-700',
    accent: '#c026d3', textColor: 'text-fuchsia-700', ring: 'bg-fuchsia-50',
    description: 'Notify a user — appears in their notification center',
    form: NotificationForm as unknown as ComponentType<NodeFormProps>,
    normalise: (raw) => normaliseNotificationConfig(raw),
    category: 'notify',
  },
  email: {
    label: 'Send Email', icon: Mail,
    color: 'bg-rose-600', gradient: 'bg-gradient-to-br from-rose-600 to-pink-700',
    accent: '#e11d48', textColor: 'text-rose-700', ring: 'bg-rose-50',
    description: 'Send a real email off-platform, unlike an in-app notification',
    form: EmailForm as unknown as ComponentType<NodeFormProps>,
    normalise: (raw) => normaliseEmailConfig(raw),
    category: 'notify',
  },
  knowledge_retrieval: {
    label: 'Knowledge Retrieval', icon: BookOpenCheck,
    color: 'bg-teal-600', gradient: 'bg-gradient-to-br from-teal-600 to-cyan-700',
    accent: '#0d9488', textColor: 'text-teal-700', ring: 'bg-teal-50',
    description: 'Query a knowledge base for context or a grounded answer',
    form: KnowledgeRetrievalForm as unknown as ComponentType<NodeFormProps>,
    normalise: (raw) => normaliseKnowledgeRetrievalConfig(raw),
    category: 'ai',
  },
  knowledge_ingest: {
    label: 'Knowledge Ingest', icon: BookOpen,
    color: 'bg-teal-500', gradient: 'bg-gradient-to-br from-teal-500 to-emerald-600',
    accent: '#14b8a6', textColor: 'text-teal-700', ring: 'bg-teal-50',
    description: 'Insert text into a knowledge base for asynchronous indexing',
    form: KnowledgeIngestForm as unknown as ComponentType<NodeFormProps>,
    normalise: (raw) => normaliseKnowledgeIngestConfig(raw),
    category: 'ai',
  },
  debug: {
    label: 'Debug', icon: Bug,
    color: 'bg-lime-600', gradient: 'bg-gradient-to-br from-lime-600 to-green-700',
    accent: '#65a30d', textColor: 'text-lime-700', ring: 'bg-lime-50',
    description: 'Capture a variable snapshot at this point in the graph',
    form: DebugForm as unknown as ComponentType<NodeFormProps>,
    normalise: (raw) => normaliseDebugConfig(raw),
    category: 'logic',
  },
  run_agent: {
    label: 'Run Agent', icon: Bot,
    color: 'bg-indigo-600', gradient: 'bg-gradient-to-br from-indigo-600 to-violet-700',
    accent: '#4f46e5', textColor: 'text-indigo-700', ring: 'bg-indigo-50',
    description: 'Start an Agent run and wait for its result',
    form: RunAgentForm as unknown as ComponentType<NodeFormProps>,
    normalise: (raw) => normaliseRunAgentConfig(raw),
    category: 'ai',
  },
  send_to_session: {
    label: 'Send to Session', icon: MessageCircle,
    color: 'bg-indigo-500', gradient: 'bg-gradient-to-br from-indigo-500 to-blue-600',
    accent: '#6366f1', textColor: 'text-indigo-700', ring: 'bg-indigo-50',
    description: 'Post a message into an existing Agent session',
    form: SendToSessionForm as unknown as ComponentType<NodeFormProps>,
    normalise: (raw) => normaliseSendToSessionConfig(raw),
    category: 'ai',
  },
  generate_report: {
    label: 'Generate Report', icon: FileBarChart,
    color: 'bg-sky-600', gradient: 'bg-gradient-to-br from-sky-600 to-blue-700',
    accent: '#0284c7', textColor: 'text-sky-700', ring: 'bg-sky-50',
    description: 'Generate a report and get back a downloadable file',
    form: GenerateReportForm as unknown as ComponentType<NodeFormProps>,
    normalise: (raw) => normaliseReportGenerateConfig(raw),
    // Was 'Knowledge' here while the backend had always classified it
    // 'output' — a live instance of the drift the shared vocabulary exists
    // to remove, found by lining the two lists up for the first time.
    category: 'output',
  },
}

// These three accept NodeType | (string & {}) — see store.ts's addNode doc
// comment for why this shape (rather than plain `string`) keeps built-in
// callers' literal-type autocomplete intact. A package type string is
// never a real NodeType, so every switch below keeps exhaustiveness
// checking on the closed union unaffected — TypeScript still errors if a
// built-in `case` is missing; only the `default:` branch (already the
// deliberate "safe generic fallback" per each function's own doc comment)
// is reached for a package type.
export function defaultLabel(type: NodeType | (string & {})): string {
  return NODE_REGISTRY[type as NodeType]?.label ?? type
}

export function defaultPorts(type: NodeType | (string & {})): { inputs: Port[]; outputs: Port[] } {
  switch (type) {
    case 'entry':
    case 'trigger':
      return { inputs: [], outputs: [{ id: 'out', label: 'out', kind: 'control' }] }
    case 'exit':
      return { inputs: [{ id: 'in', label: 'in', kind: 'control' }], outputs: [] }
    case 'condition':
      // Gate by default: ONE output, followed only when the condition is
      // true — no false path to wire. The config panel's "two-path branch"
      // toggle adds the false port back for an explicit if/else
      // (setConditionFalseBranch in the store). Stored nodes keep whatever
      // ports they were saved with; loadDefinition infers two ports for
      // legacy port-less nodes that have a false-handle edge.
      return {
        inputs:  [{ id: 'in',   label: 'in',      kind: 'control' }],
        outputs: [{ id: 'true', label: 'if true', kind: 'control' }],
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

export function defaultConfig(type: NodeType | (string & {})):
  | SetVariableConfig | ConditionConfig | FetchRecordsConfig | IteratorConfig
  | UpsertRecordsConfig | UpdateRecordsConfig | DeleteRecordsConfig | HttpRequestConfig
  | TriggerConfig | ShowMessageConfig | TransformConfig | SaveRecordsConfig | NotificationConfig | EmailConfig
  | KnowledgeRetrievalConfig | KnowledgeIngestConfig | DebugConfig | SubflowConfig
  | RunAgentConfig | SendToSessionConfig | ReportGenerateConfig
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
    case 'subflow':
      return { definition_id: '', sync: true, input_mappings: [], output_mappings: [] } satisfies SubflowConfig
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
    case 'notification':
      return { recipient_mode: 'static', title: '', severity: 'info' } satisfies NotificationConfig
    case 'email':
      return { to: '', reply_to: '', subject: '', body: '' } satisfies EmailConfig
    case 'knowledge_retrieval':
      return {
        kb_id: '', mode: 'mix', query_mode: 'static', query: '', include_answer: true, output_var: '',
      } satisfies KnowledgeRetrievalConfig
    case 'knowledge_ingest':
      return {
        kb_id: '', content_mode: 'static', content: '', file_name_mode: 'static', output_var: '',
      } satisfies KnowledgeIngestConfig
    case 'debug':
      return {} satisfies DebugConfig
    case 'run_agent':
      return { agent_id: '', task_mode: 'literal', task: '', output_var: '' } satisfies RunAgentConfig
    case 'send_to_session':
      return { session_id_mode: 'static', session_id: '', content_mode: 'static', content: '' } satisfies SendToSessionConfig
    case 'generate_report':
      return {
        report_definition_id: '', format: '', parameters_mode: 'static', parameters: {}, output_var: '',
      } satisfies ReportGenerateConfig
    default:
      return {}
  }
}

// Node types available from the drag-and-drop palette (trigger/entry/exit and
// loop_end are added automatically — loop_end is auto-paired when an iterator
// is added; trigger/entry is seeded once when a new workflow is created).
//
// 'subflow' (Execute Workflow) was previously excluded here (FR-B2-003): it
// had no execution-time dispatch in the backend, so a saved workflow
// reaching that node failed at runtime with a generic "unknown node type"
// error, and the backend hard-rejected it at save time. Real dispatch now
// exists (input/output variable mapping, cross-definition cycle detection,
// sync/async — see internal/graph.SubflowConfig and internal/subflow), so
// it's back in the palette.
export const PALETTE_NODES: NodeType[] = [
  'set_variable', 'condition', 'fetch_records', 'upsert_records', 'update_records',
  'delete_records', 'transform', 'save_records', 'iterator', 'http_request', 'show_message',
  'notification', 'email', 'knowledge_retrieval', 'knowledge_ingest', 'merge', 'debug', 'subflow',
  'run_agent', 'send_to_session', 'generate_report',
]

// Every PALETTE_NODES member must carry a fallback `category`; a missing one
// is a registry authoring bug, not a runtime condition to degrade gracefully
// from, so it throws immediately at module load rather than silently
// omitting that type from every tab.
//
// What is NOT here any more is the tab list itself. It used to be built from
// a hand-written CATEGORY_ORDER array — a second list to maintain, and the
// one that had drifted from the backend's vocabulary (it named tabs Go had
// never heard of, and omitted categories Go had). Tab construction now lives
// in node-taxonomy.ts's groupByCategory, driven by the served vocabulary, so
// the ordering is decided in exactly one place: Go.
function assertPaletteCategories() {
  for (const type of PALETTE_NODES) {
    if (!NODE_REGISTRY[type].category) {
      throw new Error(`node-registry: PALETTE_NODES member "${type}" has no category`)
    }
  }
}
assertPaletteCategories()

/** Fallback category for a built-in type, for use before the served taxonomy
 *  arrives. Callers should prefer the taxonomy's answer when they have it. */
export function fallbackCategory(type: NodeType): NodeCategory {
  return NODE_REGISTRY[type]?.category ?? 'logic'
}
