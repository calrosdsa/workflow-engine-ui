import type { GraphNode, NodeMetadata } from '../types'
import type { JSONSchema, JSONSchemaProperty } from './SchemaForm'

/**
 * Workbench-only information lives in node metadata, never in a built-in
 * node's type-specific configuration. The engine explicitly treats metadata
 * as UI/informational data, which keeps the existing node-form contract and
 * saved configs forward-compatible while server-side execution policies are
 * rolled out separately.
 */
export const WORKBENCH_METADATA_KEY = 'configuration_workbench'

export type ErrorRoutingPolicy = 'stop' | 'continue' | 'route'

export interface NodeExecutionSettings {
  disabled: boolean
  retry: {
    maxAttempts: number
    delayMs: number
  }
  timeoutMs?: number
  continueOnError: boolean
  alwaysOutputData: boolean
  notes: string
  errorRouting: ErrorRoutingPolicy
}

export const DEFAULT_NODE_EXECUTION_SETTINGS: NodeExecutionSettings = {
  disabled: false,
  retry: { maxAttempts: 0, delayMs: 1000 },
  timeoutMs: undefined,
  continueOnError: false,
  alwaysOutputData: false,
  notes: '',
  errorRouting: 'stop',
}

export interface NodeWorkbenchData {
  settings?: Omit<Partial<NodeExecutionSettings>, 'retry'> & { retry?: Partial<NodeExecutionSettings['retry']> }
  mockOutput?: unknown
  pinnedOutput?: unknown
}

export interface FieldValidationIssue {
  /** A stable, form-addressable field path such as parameters.url. */
  path: string
  message: string
}

export type WorkbenchOutputSource = 'live' | 'draft' | 'mock' | 'pinned'

export interface WorkbenchDisplayedOutput {
  value: unknown
  source: WorkbenchOutputSource
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function readNodeWorkbench(node: Pick<GraphNode, 'metadata'>): Omit<NodeWorkbenchData, 'settings'> & { settings: NodeExecutionSettings } {
  const raw = node.metadata?.extra?.[WORKBENCH_METADATA_KEY]
  const data = isRecord(raw) ? raw as NodeWorkbenchData : {}
  return {
    ...data,
    settings: {
      ...DEFAULT_NODE_EXECUTION_SETTINGS,
      ...(data.settings ?? {}),
      retry: { ...DEFAULT_NODE_EXECUTION_SETTINGS.retry, ...(data.settings?.retry ?? {}) },
    },
  }
}

/** Returns a metadata object preserving all application-owned metadata. */
export function nodeMetadataWithWorkbench(
  metadata: NodeMetadata | undefined,
  patch: Partial<NodeWorkbenchData>,
): NodeMetadata {
  const extra = { ...(metadata?.extra ?? {}) }
  const previous = isRecord(extra[WORKBENCH_METADATA_KEY])
    ? extra[WORKBENCH_METADATA_KEY] as NodeWorkbenchData
    : {}
  const mergedSettings: NodeWorkbenchData['settings'] = patch.settings
    ? {
        ...(previous.settings ?? {}),
        ...patch.settings,
        retry: {
          ...(previous.settings?.retry ?? {}),
          ...(patch.settings.retry ?? {}),
        },
      }
    : previous.settings
  const next: NodeWorkbenchData = {
    ...previous,
    ...patch,
    ...(patch.settings ? { settings: mergedSettings } : {}),
  }

  // An explicit undefined is the clear action for mock/pinned output. It is
  // intentionally deleted rather than serialized as a meaningless null.
  if (patch.mockOutput === undefined && Object.prototype.hasOwnProperty.call(patch, 'mockOutput')) delete next.mockOutput
  if (patch.pinnedOutput === undefined && Object.prototype.hasOwnProperty.call(patch, 'pinnedOutput')) delete next.pinnedOutput
  extra[WORKBENCH_METADATA_KEY] = next

  return { ...metadata, extra }
}

export function validateNodeExecutionSettings(settings: NodeExecutionSettings): FieldValidationIssue[] {
  const issues: FieldValidationIssue[] = []
  if (!Number.isInteger(settings.retry.maxAttempts) || settings.retry.maxAttempts < 0 || settings.retry.maxAttempts > 10) {
    issues.push({ path: 'settings.retry.maxAttempts', message: 'Use between 0 and 10 attempts' })
  }
  if (!Number.isFinite(settings.retry.delayMs) || settings.retry.delayMs < 0) {
    issues.push({ path: 'settings.retry.delayMs', message: 'Delay cannot be negative' })
  }
  if (settings.timeoutMs !== undefined && (!Number.isFinite(settings.timeoutMs) || settings.timeoutMs < 100 || settings.timeoutMs > 3_600_000)) {
    issues.push({ path: 'settings.timeoutMs', message: 'Use a timeout between 100 ms and 1 hour' })
  }
  if (settings.notes.length > 1000) {
    issues.push({ path: 'settings.notes', message: 'Keep notes to 1,000 characters or fewer' })
  }
  return issues
}

/** Validates the JSON Schema subset our connector form advertises. */
export function validateSchemaConfiguration(schema: JSONSchema, value: unknown): FieldValidationIssue[] {
  const config = isRecord(value) ? value : {}
  const issues: FieldValidationIssue[] = []
  const required = new Set(schema.required ?? [])

  for (const [key, property] of Object.entries(schema.properties ?? {})) {
    const fieldValue = config[key]
    const path = `parameters.${key}`
    if (required.has(key) && isEmpty(fieldValue)) {
      issues.push({ path, message: 'This field is required' })
      continue
    }
    if (fieldValue === undefined || fieldValue === null || fieldValue === '') continue
    issues.push(...validateSchemaProperty(path, property, fieldValue))
  }
  return issues
}

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '')
}

function validateSchemaProperty(path: string, property: JSONSchemaProperty, value: unknown): FieldValidationIssue[] {
  const issues: FieldValidationIssue[] = []
  const numeric = typeof value === 'number' && Number.isFinite(value)

  if ((property.type === 'number' || property.type === 'integer') && !numeric) {
    issues.push({ path, message: 'Use a number' })
    return issues
  }
  if (property.type === 'integer' && numeric && !Number.isInteger(value)) issues.push({ path, message: 'Use a whole number' })
  if (property.type === 'boolean' && typeof value !== 'boolean') issues.push({ path, message: 'Use true or false' })
  if (property.type === 'string' && typeof value !== 'string') {
    issues.push({ path, message: 'Use text' })
    return issues
  }
  if (property.enum && !property.enum.includes(value as string | number)) issues.push({ path, message: 'Choose one of the available options' })
  if (numeric && property.minimum !== undefined && value < property.minimum) issues.push({ path, message: `Use ${property.minimum} or more` })
  if (numeric && property.maximum !== undefined && value > property.maximum) issues.push({ path, message: `Use ${property.maximum} or less` })
  if (typeof value === 'string') {
    if (property.minLength !== undefined && value.length < property.minLength) issues.push({ path, message: `Use at least ${property.minLength} characters` })
    if (property.maxLength !== undefined && value.length > property.maxLength) issues.push({ path, message: `Use ${property.maxLength} characters or fewer` })
    if (property.pattern) {
      try {
        if (!(new RegExp(property.pattern).test(value))) issues.push({ path, message: 'Use the required format' })
      } catch {
        // A malformed connector manifest is surfaced as an unavailable client
        // rule; it must not make the editor crash or block the whole node.
      }
    }
  }
  return issues
}

const SECRET_KEY = /(?:api[_-]?key|authorization|cookie|password|secret|token|credential|private[_-]?key)/i

/** Safe representation for every configuration viewer and clipboard action. */
export function redactSensitiveData(value: unknown, key = ''): unknown {
  if (SECRET_KEY.test(key)) return '[REDACTED]'
  if (Array.isArray(value)) return value.map((item) => redactSensitiveData(item))
  if (!isRecord(value)) return value
  return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, redactSensitiveData(childValue, childKey)]))
}

export function countDataItems(value: unknown): number {
  if (Array.isArray(value)) return value.length
  if (isRecord(value)) return Object.keys(value).length
  return value === undefined ? 0 : 1
}

/** Pinned data is intentional design-time truth, mock data is the next
 * deliberate override, and a transient live/draft result is the fallback. */
export function selectWorkbenchOutput({
  pinnedOutput,
  mockOutput,
  runOutput,
  runSource,
}: {
  pinnedOutput?: unknown
  mockOutput?: unknown
  runOutput?: unknown
  runSource?: Extract<WorkbenchOutputSource, 'live' | 'draft'>
}): WorkbenchDisplayedOutput | null {
  if (pinnedOutput !== undefined) return { value: pinnedOutput, source: 'pinned' }
  if (mockOutput !== undefined) return { value: mockOutput, source: 'mock' }
  if (runOutput !== undefined) return { value: runOutput, source: runSource ?? 'draft' }
  return null
}

export function isConfigurationStale(capturedFingerprint: string | undefined, currentConfiguration: unknown): boolean {
  return !!capturedFingerprint && capturedFingerprint !== configurationFingerprint(currentConfiguration)
}

export function configurationFingerprint(value: unknown): string {
  try { return JSON.stringify(value) } catch { return String(value) }
}

export function findDataPaths(value: unknown, query: string): string[] {
  if (!query.trim()) return []
  const needle = query.toLowerCase()
  const matches: string[] = []
  const visit = (current: unknown, path: string) => {
    if (matches.length >= 100) return
    const printable = typeof current === 'string' ? current : JSON.stringify(current)
    if (path.toLowerCase().includes(needle) || printable?.toLowerCase().includes(needle)) matches.push(path || '$')
    if (Array.isArray(current)) current.forEach((item, index) => visit(item, `${path}[${index}]`))
    else if (isRecord(current)) Object.entries(current).forEach(([childKey, childValue]) => visit(childValue, path ? `${path}.${childKey}` : childKey))
  }
  visit(value, '')
  return matches
}
