import type { ThemeConfig } from '@/features/theme/types'
export type { ThemeConfig } from '@/features/theme/types'

export interface ApplicationSettings {
  description?: string
  default_menu_slug?: string
  [k: string]: unknown
}

export interface Application {
  id: string
  client_id: string
  name: string
  slug: string
  settings: ApplicationSettings
  theme: Partial<ThemeConfig>
  published_version: number | null
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface UpdateApplicationSettingsPayload {
  name: string
  settings: ApplicationSettings
}

export interface UpdateApplicationThemePayload {
  theme: Partial<ThemeConfig>
}

export interface PublishResult {
  version_number: number
  major_version: number
  minor_version: number
  published_at: string
}

/** Optionally set the published major version number ("v{Version}.0") —
 *  must be strictly greater than the app's current highest major version;
 *  gaps are fine (3 -> 5). Omit to default to "current + 1". */
export interface PublishPayload {
  version?: number
}

export interface ValidationIssue {
  level: 'error' | 'warning'
  path: string
  message: string
}

export interface PublishValidationError {
  issues: ValidationIssue[]
}

export type VersionKind = 'publish' | 'checkpoint' | 'rollback'

export interface AppVersion {
  id: string
  app_id: string
  version_number: number
  /** Git-tag-style display label ("v{major_version}.{minor_version}") —
   *  major bumps on publish (user-settable), minor bumps on every
   *  checkpoint/rollback/import since the last publish. version_number
   *  remains the real identifier for every route (GetVersion/DiffVersions/
   *  Rollback all still address a version by version_number, not
   *  major.minor) — these two fields are presentational only. */
  major_version: number
  minor_version: number
  kind: VersionKind
  label?: string
  description?: string
  rolled_back_from_version?: number
  published_by: string
  created_at: string
}

/** Everything a whole-app version snapshot captures — the same shape the
 *  backend's AppSnapshot Go struct marshals verbatim (internal/appbuilder/
 *  versions.go). Every field the backend types loosely as opaque JSONB
 *  stays `unknown` here rather than a fabricated shape, matching how this
 *  frontend already treats menu Config/dashboard widgets elsewhere. */
export interface AppSnapshotMeta {
  id: string
  name: string
  slug: string
  settings: ApplicationSettings
}

export interface MenuSnapshotItem {
  id: string
  parent_id: string | null
  menu_type: string
  slug: string
  name: string
  icon?: string
  sort_order: number
  config: unknown
  required_permission?: string
  permission_mode: string
  required_role_ids: string[]
  hidden_from_nav: boolean
}

export interface FormSnapshotItem {
  id: string
  name: string
  slug: string
  description: string
  fields: unknown
  layout?: unknown
  physical_table: string
  parent_form_id?: string
  is_line_items: boolean
  create_user_on_submit: boolean
  create_user_name_field?: string
  create_user_email_field?: string
  create_user_role_field?: string
  line_items_min_rows: number
  line_items_max_rows: number
}

export interface WorkflowSnapshotItem {
  id: string
  name: string
  definition: unknown
  sort_order: number
}

export interface RoleSnapshotItem {
  id: string
  name: string
  permissions: string[]
  hidden_fields?: Record<string, string[]>
}

export interface AgentSnapshotItem {
  id: string
  name: string
  description: string
  instructions: string
  provider_id: string
  knowledge_base_ids: string[]
  tools: unknown
  skills: unknown
  sub_agent_ids: string[]
  channels: unknown
  schedule_workflow_definition_id?: string
  max_parallel_sub_agents: number
  custom_model_routing_enabled: boolean
  session_memory_enabled: boolean
  episodic_memory_enabled: boolean
  web_search_enabled: boolean
  reasoning_enabled: boolean
  tool_call_concurrency: number
  max_iterations: number
  enabled: boolean
  session_ttl_days?: number
}

/** Name/Type only — the backend NEVER includes the decrypted value, only
 *  ciphertext, and even the ciphertext must never be rendered by this
 *  frontend (see the backend's CredentialSnapshotItem doc comment). This
 *  type deliberately omits encrypted_value even though the wire response
 *  technically carries it, so accidentally rendering `credential` directly
 *  can't leak it — read .name/.type explicitly instead. */
export interface CredentialSnapshotItem {
  name: string
  type: string
}

export interface VariableSnapshotItem {
  name: string
  value: unknown
}

/** Forms/Workflows/Roles/Agents/Credentials/Variables are `null` (not `[]`)
 *  on the wire for any version published before whole-app snapshots
 *  existed (snapshot_schema_version < 2, a Go nil slice serializes as
 *  `null`) — every reader of these fields must handle that, not just
 *  assume `.length` is always safe. See isOldSnapshotShape in
 *  VersionHistorySection.tsx. */
export interface AppSnapshot {
  app: AppSnapshotMeta
  menus: MenuSnapshotItem[]
  theme: Partial<ThemeConfig>
  mobile_nav?: unknown
  forms: FormSnapshotItem[] | null
  workflows: WorkflowSnapshotItem[] | null
  roles: RoleSnapshotItem[] | null
  agents: AgentSnapshotItem[] | null
  credentials: CredentialSnapshotItem[] | null
  variables: VariableSnapshotItem[] | null
  snapshot_schema_version: number
}

export interface AppVersionDetail extends AppVersion {
  snapshot: AppSnapshot
}

export interface ResourceDiff {
  added: string[]
  removed: string[]
  changed: string[]
}

export interface VersionDiff {
  from_version: number
  to_version: number
  resources: Record<string, ResourceDiff>
}

export interface SaveVersionPayload {
  label?: string
  description?: string
}

export interface RestoreWarning {
  path: string
  message: string
}

export interface SaveVersionResult extends AppVersion {
  issues?: ValidationIssue[]
}

export interface RollbackResult extends AppVersion {
  warnings?: RestoreWarning[]
}

export interface ImportResult extends AppVersion {
  warnings?: RestoreWarning[]
}

/** Thin listing shape for cross-app views (e.g. the Team page's Roles tab
 *  app selector) that have no single "current app" to read full Application
 *  settings for the way every other /application route does. */
export interface AppSummary {
  id: string
  name: string
  slug: string
}

/** slug is optional — left blank, the backend derives it from name. */
export interface CreateAppPayload {
  name: string
  slug?: string
}
