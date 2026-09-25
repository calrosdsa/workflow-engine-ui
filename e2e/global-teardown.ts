// Signs every QA session out when the run ends, so a saved session can never
// outlive the run that made it, and deletes the saved files.
import fs from 'node:fs'
import { request } from '@playwright/test'
import { apiURL, ROLES, storageState } from './support/env'

export default async function globalTeardown() {
  for (const role of ROLES) {
    const file = storageState(role)
    if (!fs.existsSync(file)) continue
    const api = await request.newContext({ storageState: file })
    try {
      const res = await api.post(`${apiURL}/auth/signout`, { data: {} })
      if (!res.ok()) console.warn(`sign-out for ${role}: HTTP ${res.status()}`)
    } finally {
      await api.dispose()
      fs.rmSync(file, { force: true })
    }
  }
}
