// The QA accounts and tenant the suite runs as. e2e/seed/seed-qa-users.mjs
// creates the accounts; e2e.yml maps the repository's QA_* secrets and
// QA_CLIENT_ID / QA_APP_ID variables onto these names.
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export type Role = 'admin' | 'builder' | 'runtime'
export const ROLES: Role[] = ['admin', 'builder', 'runtime']

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set; see e2e/README.md`)
  return value
}

export const baseURL = (process.env.E2E_BASE_URL ?? 'http://localhost:5173').replace(/\/+$/, '')
export const apiURL = `${baseURL}/api`

export function tenant() {
  return { clientId: required('E2E_CLIENT_ID'), appId: required('E2E_APP_ID') }
}

export function credentials(role: Role) {
  const key = role.toUpperCase()
  return { email: required(`QA_${key}_EMAIL`), password: required(`QA_${key}_PASSWORD`) }
}

const here = path.dirname(fileURLToPath(import.meta.url))

/** Saved browser session per role. Outside the uploaded report, and ignored by git. */
export function storageState(role: Role): string {
  return path.join(here, '..', '.auth', `${role}.json`)
}

/**
 * A name unique to this run and retry, so two runs against the same QA app
 * (a UI and a backend deploy close together) never see each other's data.
 */
export function runName(label: string): string {
  const run = process.env.GITHUB_RUN_ID ?? `local${Date.now().toString(36)}`
  const attempt = process.env.GITHUB_RUN_ATTEMPT ?? '1'
  const nonce = Math.random().toString(36).slice(2, 6)
  return `qa-${run}-${attempt}-${label}-${nonce}`
}
