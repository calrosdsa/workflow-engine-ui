// The fake tenant the mocked suite runs in: one client, one app, a signed-in
// Super Admin by default. Fixed ids and dates, so screenshots never change
// between runs. Types come from src/, so a change to what the UI expects
// breaks this file at compile time instead of drifting silently.
import type { Me, Membership } from '../../src/features/auth/types'
import type { MfaStatus } from '../../src/features/auth/mfa/api'
import type { Application, AppSummary, AppVersion } from '../../src/features/applications/types'
import type { EnvironmentLinkStatus } from '../../src/features/environment/types'
import type { TeamUser } from '../../src/features/users/types'
import type { Invitation } from '../../src/features/invitations/types'
import type { FormDefinition, FormRecord } from '../../src/features/forms/types'
import type { WorkflowDefinition } from '../../src/features/workflows/types'
import type { Execution, ExecutionLogsResponse } from '../../src/features/executions/types'
import { reply, type FakeBackend } from './fake-backend'

export const CLIENT_ID = '11111111-1111-4111-8111-111111111111'
export const APP_ID = '22222222-2222-4222-8222-222222222222'
export const USER_ID = '33333333-3333-4333-8333-333333333333'
export const FIXED_NOW = new Date('2026-09-01T12:00:00Z')
const T = '2026-08-20T09:30:00Z'

export const superAdmin: Membership = {
  client_id: CLIENT_ID,
  client_name: 'Acme Field Services',
  app_id: APP_ID,
  app_name: 'Service Desk',
  role_id: '44444444-4444-4444-8444-444444444444',
  role: 'Super Admin',
  permissions: ['*'],
}

export const me: Me = {
  user_id: USER_ID,
  email: 'dana@acme.test',
  first_name: 'Dana',
  last_name: 'Reyes',
  memberships: [superAdmin],
}

/** Signed out: /auth/me answers 401, as the engine does for no session. */
export function signedOut(backend: FakeBackend) {
  backend.on('GET', '/auth/me', () => reply(401, { error: 'unauthorized' }))
}

export const application: Application = {
  id: APP_ID,
  client_id: CLIENT_ID,
  name: 'Service Desk',
  slug: 'service-desk',
  settings: { description: 'Tickets and field visits' },
  theme: {},
  published_version: 3,
  published_at: T,
  created_at: T,
  updated_at: T,
}

const apps: AppSummary[] = [{ id: APP_ID, name: 'Service Desk', slug: 'service-desk' }]
const versions: AppVersion[] = []
const environmentLink: EnvironmentLinkStatus = { linked: false }
const mfaStatus: MfaStatus = { enrolled: true, required: false, blocking: false, recovery_codes_remaining: 8 }

const membershipOf = (role: string): TeamUser['memberships'] => [
  { app_id: APP_ID, app_name: 'Service Desk', role_id: `role-${role}`, role_name: role },
]
export const teamUsers: TeamUser[] = [
  { id: USER_ID, email: 'dana@acme.test', first_name: 'Dana', last_name: 'Reyes', status: 'active', is_super_admin: true, mfa_enabled: true, memberships: [] },
  { id: '55555555-5555-4555-8555-555555555555', email: 'omar@acme.test', first_name: 'Omar', last_name: 'Haddad', status: 'active', is_super_admin: false, mfa_enabled: false, memberships: membershipOf('Dispatcher') },
  { id: '66666666-6666-4666-8666-666666666666', email: 'lin@acme.test', first_name: 'Lin', last_name: 'Park', status: 'active', is_super_admin: false, mfa_enabled: true, memberships: membershipOf('Technician') },
]
const invitations: Invitation[] = []

export const FORM_ID = '77777777-7777-4777-8777-777777777777'
export const ticketsForm: FormDefinition = {
  id: FORM_ID,
  name: 'Tickets',
  slug: 'tickets',
  description: 'Customer requests',
  fields: [
    { name: 'title', label: 'Title', type: 'string', required: true, is_record_title: true, searchable: true },
    { name: 'status', label: 'Status', type: 'enum', enum_values: ['open', 'in_progress', 'done'] },
    { name: 'due', label: 'Due date', type: 'date' },
  ],
  created_at: T,
  updated_at: T,
}
const sitesForm: FormDefinition = {
  id: '88888888-8888-4888-8888-888888888888',
  name: 'Sites',
  slug: 'sites',
  fields: [{ name: 'name', label: 'Name', type: 'string', required: true, is_record_title: true, searchable: true }],
  created_at: T,
  updated_at: T,
}
export const records: FormRecord[] = [
  { id: 'a1b2c3d4-0000-4000-8000-000000000001', title: 'Printer jammed on floor 2', status: 'open', due: '2026-09-03', created_at: T, updated_at: T },
  { id: 'a1b2c3d4-0000-4000-8000-000000000002', title: 'Replace badge reader', status: 'in_progress', due: '2026-09-10', created_at: T, updated_at: T },
  { id: 'a1b2c3d4-0000-4000-8000-000000000003', title: 'Quarterly HVAC check', status: 'done', due: '2026-08-28', created_at: T, updated_at: T },
]

export const WORKFLOW_ID = '99999999-9999-4999-8999-999999999999'
export const workflow: WorkflowDefinition = {
  id: WORKFLOW_ID,
  name: 'Notify dispatcher',
  sort_order: 0,
  created_at: T,
  updated_at: T,
  last_execution_status: 'COMPLETED',
  last_execution_at: T,
  definition: {
    id: WORKFLOW_ID,
    variables: [{ name: 'msg', type: 'string' }],
    nodes: [
      { id: 'trigger', type: 'trigger', label: 'Trigger', position: { x: 0, y: 0 }, configuration: { mode: 'on_demand' }, inputs: [], outputs: [] },
      { id: 'set', type: 'set_variable', label: 'Set message', position: { x: 0, y: 160 }, configuration: {}, inputs: [], outputs: [] },
    ],
    edges: [{ id: 'e1', source: 'trigger', target: 'set', source_handle: 'out', target_handle: 'in' }],
    metadata: { version: 1 },
  },
}

export const EXECUTION_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
export const execution: Execution = {
  execution_id: EXECUTION_ID,
  workflow_definition_id: WORKFLOW_ID,
  status: 'COMPLETED',
  final_variables: { msg: 'ok' },
  node_statuses: { trigger: 'COMPLETED', set: 'COMPLETED' } as Execution['node_statuses'],
  created_at: T,
  started_at: T,
  finished_at: '2026-08-20T09:30:02Z',
}

const log = (node: string, type: string, kind: 'node' | 'trigger', ms: number) => ({
  id: `log-${node}`, execution_id: EXECUTION_ID, node_id: node, node_type: type, kind, attempt: 1,
  status: 'COMPLETED' as const, started_at: T, finished_at: T, duration_ms: ms, input: null, output: null,
  error_message: null, dropped_payload: false, chunk_index: null, chunk_count: null,
  item_count: null, failed_item_count: null, trace_id: null, span_id: null,
})
const executionLogs: ExecutionLogsResponse = {
  logs: [log('trigger', 'trigger', 'trigger', 3), log('set', 'set_variable', 'node', 12)],
  total: 2, page: 1, page_size: 50,
}

/** The default world: a signed-in Super Admin. Tests override pieces with backend.on(...). */
export function installWorld(backend: FakeBackend, who: Me = me) {
  backend
    .on('GET', '/auth/me', () => who)
    .on('GET', '/auth/mfa/status', () => mfaStatus)
    .on('GET', '/apps', () => apps)
    .on('GET', '/application', () => application)
    .on('GET', '/application/versions', () => versions)
    .on('GET', '/application/environment-link', () => environmentLink)
    .on('GET', '/users', () => teamUsers)
    .on('GET', '/invitations', () => invitations)
    .on('GET', '/forms', () => [ticketsForm, sitesForm])
    .on('GET', '/forms/:id', ({ params }) => [ticketsForm, sitesForm].find((f) => f.id === params.id) ?? reply(404, { error: 'form not found' }))
    .on('GET', '/forms/:id/records', ({ params }) => (params.id === FORM_ID ? records : []))
    .on('GET', '/workflows', () => [workflow])
    .on('GET', '/executions/:id/logs', () => executionLogs)
    .on('GET', '/executions/:id', ({ params }) => (params.id === EXECUTION_ID ? execution : reply(404, { error: 'execution not found' })))
}
