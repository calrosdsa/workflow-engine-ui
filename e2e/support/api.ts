// API access for test data. Tests create what they need over HTTP (fast, and
// independent of the screens under test) and delete it afterwards.
//
// It reuses the browser session auth.setup saved for a role rather than
// signing in again: sign-in is rate limited to 5 requests per 10 seconds.
import { expect, request, type APIRequestContext, type APIResponse } from '@playwright/test'
import { apiURL, storageState, tenant, type Role } from './env'

export type Api = APIRequestContext

export async function apiAs(role: Role): Promise<Api> {
  const { clientId, appId } = tenant()
  return request.newContext({
    baseURL: `${apiURL}/`,
    storageState: storageState(role),
    extraHTTPHeaders: { 'X-Client-ID': clientId, 'X-App-ID': appId, Accept: 'application/json' },
  })
}

async function ok<T>(res: APIResponse, what: string): Promise<T> {
  if (!res.ok()) throw new Error(`${what}: HTTP ${res.status()} ${await res.text()}`)
  return (res.status() === 204 ? undefined : await res.json()) as T
}

/** Deletes, treating "already gone" as done: a retry or another run may have got there first. */
async function remove(api: Api, path: string, what: string) {
  const res = await api.delete(path)
  if (res.ok() || res.status() === 404) return
  throw new Error(`${what}: HTTP ${res.status()} ${await res.text()}`)
}

// ---------------------------------------------------------------- forms

export interface Form { id: string; name: string; slug: string }

/** A form with a required string "title" (its record title) and an enum "status" (open/done). */
export async function createTicketForm(api: Api, name: string): Promise<Form> {
  return ok(await api.post('forms', {
    data: {
      name,
      slug: name.replace(/[^a-z0-9]+/gi, '_').toLowerCase(),
      fields: [
        { name: 'title', label: 'Title', type: 'string', required: true, is_record_title: true, searchable: true },
        { name: 'status', label: 'Status', type: 'enum', enum_values: ['open', 'done'] },
      ],
    },
  }), `create form ${name}`)
}

export const getForm = async (api: Api, id: string) => ok<Form & Record<string, unknown>>(await api.get(`forms/${id}`), 'get form')
export const deleteForm = (api: Api, id: string) => remove(api, `forms/${id}`, 'delete form')
export const listForms = async (api: Api) => ok<Array<Form & { created_at?: string }>>(await api.get('forms'), 'list forms')

// -------------------------------------------------------------- records

export type Values = Record<string, unknown>

export const createRecord = async (api: Api, formId: string, values: Values) =>
  ok<Values & { id: string }>(await api.post(`forms/${formId}/records`, { data: values }), 'create record')
export const getRecord = async (api: Api, formId: string, id: string) =>
  ok<Values & { id: string }>(await api.get(`forms/${formId}/records/${id}`), 'get record')
export const listRecords = async (api: Api, formId: string) =>
  ok<Array<Values & { id: string }>>(await api.get(`forms/${formId}/records`), 'list records')

// ---------------------------------------------------------------- menus

export interface Menu { id: string; slug: string }

export async function createSearchMenu(api: Api, name: string, formId: string): Promise<Menu> {
  return ok(await api.post('menus', {
    data: { menu_type: 'search', slug: name.replace(/[^a-z0-9]+/gi, '-').toLowerCase(), name, config: { form_id: formId } },
  }), `create menu ${name}`)
}

/** Delete menus BEFORE the forms they point at: a live menu on a deleted form fails every later publish of the app. */
export const deleteMenu = (api: Api, id: string) => remove(api, `menus/${id}`, 'delete menu')
export const listMenus = async (api: Api) => ok<Array<Menu & { name: string; created_at?: string }>>(await api.get('menus'), 'list menus')

export async function publish(api: Api) {
  return ok<{ version_number: number }>(await api.post('application/publish'), 'publish')
}

// ------------------------------------------------------------ workflows

export interface Workflow { id: string; name: string }

/** An on-demand workflow with one set_variable step: runs in the engine without any outside service. */
export async function createNoopWorkflow(api: Api, name: string): Promise<Workflow> {
  return ok(await api.post('workflows', {
    data: {
      name,
      flow: {
        trigger: { mode: 'on_demand' },
        variables: [{ name: 'msg', type: 'string' }],
        steps: [{ type: 'set_variable', config: { assignments: [{ variable_name: 'msg', mode: 'literal', literal_value: 'ok' }] } }],
      },
    },
  }), `create workflow ${name}`)
}

export const deleteWorkflow = (api: Api, id: string) => remove(api, `workflows/${id}`, 'delete workflow')
export const listWorkflows = async (api: Api) => ok<Array<Workflow & { created_at?: string }>>(await api.get('workflows'), 'list workflows')

export interface Execution { id?: string; execution_id?: string; status: string; error_message?: string }

export const listExecutions = async (api: Api, workflowId: string) =>
  (await ok<{ executions: Execution[] }>(await api.get(`executions?workflow_definition_id=${workflowId}`), 'list executions')).executions

/** Waits for a run to finish. A run stays PENDING forever when the worker is down, hence the bound. */
export async function expectExecutionCompletes(api: Api, executionId: string) {
  let last: Execution | undefined
  await expect.poll(async () => {
    last = await ok<Execution>(await api.get(`executions/${executionId}`), 'get execution')
    return last.status
  }, { timeout: 60_000, intervals: [500, 1000, 2000] }).toMatch(/^(COMPLETED|FAILED|CANCELLED)$/)
  expect(last?.status, last?.error_message).toBe('COMPLETED')
}

// ---------------------------------------------------------------- roles

interface RoleRow { id: string; name: string; permissions: string[] }

const PER_FORM_KEY = /^forms:([0-9a-f-]{36}):/

/**
 * Changes the per-form permissions of a seeded QA role ("QA Builder", "QA
 * Runtime User"). PUT replaces the whole list, so this reads it first, and
 * it drops keys for forms that no longer exist: the API refuses a list that
 * names a deleted form ("unknown permission"), so one run killed between
 * granting and revoking would otherwise break every run after it. Another
 * run can delete its form between the read and the write, hence the retry.
 */
export async function changeRolePermissions(api: Api, roleName: string, add: string[], drop: string[] = []) {
  const { appId } = tenant()
  for (let attempt = 1; ; attempt++) {
    const [roles, forms] = await Promise.all([
      ok<RoleRow[]>(await api.get(`roles?app_id=${appId}`), 'list roles'),
      listForms(api),
    ])
    const role = roles.find((r) => r.name === roleName)
    if (!role) throw new Error(`role "${roleName}" not found; run e2e/seed/seed-qa-users.mjs`)
    const live = new Set(forms.map((f) => f.id))
    const kept = role.permissions.filter((p) => {
      if (drop.includes(p)) return false
      const form = PER_FORM_KEY.exec(p)?.[1]
      return !form || live.has(form)
    })
    const next = [...new Set([...kept, ...add])]
    const res = await api.put(`roles/${role.id}`, { data: { app_id: appId, name: role.name, permissions: next } })
    if (res.ok()) return
    if (attempt < 3 && res.status() === 400 && /unknown permission/.test(await res.text())) continue
    await ok(res, `update role ${roleName}`)
  }
}
