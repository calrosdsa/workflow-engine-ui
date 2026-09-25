#!/usr/bin/env node
// Seeds the QA roles and users the end-to-end suite logs in as, into an
// existing tenant (client + app) on staging. Idempotent: re-running it updates
// the two QA roles to the permission sets below and leaves users that already
// have access alone, so it is safe to run after every change to this file.
//
//   QA_BASE_URL=https://app.staging.example.com/api \
//   QA_CLIENT_ID=... QA_APP_ID=... \
//   QA_OWNER_EMAIL=... QA_OWNER_PASSWORD=... \
//   node e2e/seed/seed-qa-users.mjs
//
// Environment:
//   QA_BASE_URL          API base, including the /api prefix the edge strips
//   QA_CLIENT_ID         the staging tenant's client id
//   QA_APP_ID            the app inside it the suite tests against
//   QA_OWNER_EMAIL, QA_OWNER_PASSWORD
//                        a Super Admin of that tenant. Only used to sign in.
//   QA_OWNER_TOKEN       alternative to the two above, for an owner whose login
//                        is behind an MFA challenge: a session token for them
//                        (the Set-Auth-Token header of a completed sign-in)
//   QA_EMAIL_PATTERN     default qa-{role}@example.com; {role} becomes admin,
//                        builder or runtime. Plus-addressing on a mailbox you
//                        own (you+qa-{role}@...) keeps password resets possible.
//   QA_ADMIN_PASSWORD, QA_BUILDER_PASSWORD, QA_RUNTIME_PASSWORD
//                        passwords for NEW accounts; generated when unset. An
//                        account that already exists keeps its password.
//
// Prints each account's email, role and -- for accounts it created -- the
// password, to store as the suite's GitHub secrets. Nothing is written to disk.

import { randomBytes } from 'node:crypto'

// Permission sets. Keys are the backend's catalog (GET /permissions,
// internal/auth/permissions.go). The builder role can design and publish the
// app but not manage people or secrets; the runtime role is an end user of the
// published app. Per-form record permissions (forms:<id>:view|create|edit|
// delete) are not listed here: the suite's forms are created per run, so a
// test that needs one adds it to the runtime role itself.
const ROLES = {
  builder: {
    name: 'QA Builder',
    permissions: [
      'application:read',
      'application:write',
      'application:design',
      'application:publish',
      'forms:read',
      'forms:write',
      'workflows:read',
      'workflows:write',
      'executions:read',
      'executions:write',
      'menus:read',
      'menus:write',
      'content:read',
      'content:write',
    ],
  },
  runtime: {
    name: 'QA Runtime User',
    permissions: ['menus:read', 'content:read', 'content:write'],
  },
}

// admin is granted the builder role on the app (an invitation needs one app
// grant) and then client-wide Super Admin.
const USERS = [
  { key: 'admin', role: 'builder', superAdmin: true },
  { key: 'builder', role: 'builder', superAdmin: false },
  { key: 'runtime', role: 'runtime', superAdmin: false },
]

function env(name, fallback) {
  const v = process.env[name]
  if (v) return v
  if (fallback !== undefined) return fallback
  throw new Error(`${name} is required`)
}

const BASE = env('QA_BASE_URL').replace(/\/+$/, '')
const CLIENT_ID = env('QA_CLIENT_ID')
const APP_ID = env('QA_APP_ID')
const EMAIL_PATTERN = env('QA_EMAIL_PATTERN', 'qa-{role}@example.com')

async function call(method, path, { body, auth, tenant = true } = {}) {
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth) headers.Authorization = `Bearer ${auth}`
  if (tenant) {
    headers['X-Client-ID'] = CLIENT_ID
    headers['X-App-ID'] = APP_ID
  }
  const res = await fetch(`${BASE}/${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : undefined
  } catch {
    data = text
  }
  return { res, data }
}

function fail(what, { res, data }) {
  const detail = typeof data === 'string' ? data : JSON.stringify(data)
  throw new Error(`${what}: HTTP ${res.status} ${detail ?? ''}`.trim())
}

async function ownerToken() {
  if (process.env.QA_OWNER_TOKEN) return process.env.QA_OWNER_TOKEN
  const r = await call('POST', 'auth/signin/credential', {
    tenant: false,
    body: { credential: env('QA_OWNER_EMAIL'), password: env('QA_OWNER_PASSWORD') },
  })
  if (!r.res.ok) fail('owner sign-in', r)
  const token = r.res.headers.get('set-auth-token')
  if (!token) {
    throw new Error(
      'owner sign-in returned no session token -- most likely an MFA challenge. ' +
        'Sign in once in the browser and pass that session as QA_OWNER_TOKEN instead.',
    )
  }
  return token
}

async function upsertRole(auth, spec) {
  const list = await call('GET', `roles?app_id=${encodeURIComponent(APP_ID)}`, { auth })
  if (!list.res.ok) fail('list roles', list)
  const existing = list.data.find((r) => r.name === spec.name)
  const body = { app_id: APP_ID, name: spec.name, permissions: spec.permissions }
  const r = existing
    ? await call('PUT', `roles/${existing.id}`, { auth, body })
    : await call('POST', 'roles', { auth, body })
  if (!r.res.ok) fail(`${existing ? 'update' : 'create'} role "${spec.name}"`, r)
  return { id: r.data.id, created: !existing }
}

function newPassword() {
  // 24 url-safe characters plus a fixed suffix covering the usual
  // upper/lower/digit/symbol rules, whatever the deployment's policy is.
  return `${randomBytes(18).toString('base64url')}Aa1!`
}

async function ensureUser(auth, spec, roleId, members) {
  const email = EMAIL_PATTERN.replace('{role}', spec.key)
  const member = members.find((m) => m.email.toLowerCase() === email.toLowerCase())
  let password
  let userId = member?.id

  const hasGrant = member?.memberships?.some((m) => m.app_id === APP_ID && m.role_id === roleId)
  if (!hasGrant) {
    if (!member) {
      // Create the account first so the invitation below applies immediately
      // (provisioning.ProvisionUser) instead of emailing an accept link. An
      // account that exists outside this tenant makes signup fail; that is
      // fine, the grant still applies to it.
      const candidate = process.env[`QA_${spec.key.toUpperCase()}_PASSWORD`] || newPassword()
      const signup = await call('POST', 'auth/signup/credential', {
        tenant: false,
        body: { email, password: candidate },
      })
      if (signup.res.ok) password = candidate
    }
    const inv = await call('POST', 'invitations', {
      auth,
      body: { email, grants: [{ app_id: APP_ID, role_id: roleId }] },
    })
    if (!inv.res.ok) fail(`grant ${email}`, inv)
    if (!inv.data.immediate) {
      throw new Error(
        `${email}: signup did not create the account, so an invitation email was sent instead. ` +
          'Accept it (or revoke it and use a QA_EMAIL_PATTERN you control) and re-run.',
      )
    }
    userId = inv.data.user_id
  }

  if (spec.superAdmin && !member?.is_super_admin) {
    const r = await call('POST', `users/${userId}/super-admin`, { auth })
    if (!r.res.ok) fail(`grant Super Admin to ${email}`, r)
  }
  return { email, password }
}

async function main() {
  const auth = await ownerToken()

  const roleIds = {}
  for (const [key, spec] of Object.entries(ROLES)) {
    const { id, created } = await upsertRole(auth, spec)
    roleIds[key] = id
    console.log(`role  ${spec.name.padEnd(16)} ${created ? 'created' : 'updated'}  ${id}`)
  }

  const users = await call('GET', 'users', { auth })
  if (!users.res.ok) fail('list users', users)

  const out = []
  for (const spec of USERS) {
    const { email, password } = await ensureUser(auth, spec, roleIds[spec.role], users.data)
    out.push({ spec, email, password })
  }

  console.log('')
  for (const { spec, email, password } of out) {
    const role = spec.superAdmin ? 'Super Admin' : ROLES[spec.role].name
    const secret = `QA_${spec.key.toUpperCase()}`
    console.log(`${secret}_EMAIL=${email}    # ${role}`)
    console.log(password ? `${secret}_PASSWORD=${password}` : `# ${secret}_PASSWORD unchanged (account already existed)`)
  }
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
