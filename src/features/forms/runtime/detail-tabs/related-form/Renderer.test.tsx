// @vitest-environment jsdom
//
// Regression test for a reported infinite request loop in the runtime app:
// with hideWhenEmpty on, RelatedFormTabRenderer's existence-check useQuery
// used a queryKey built from buildLinkFilter(), which used to mint a fresh
// nanoid() on every call. Since the Renderer isn't memoized upstream (its
// parent, DetailTabList, calls def.parseConfig(t.config) fresh on every
// render — see that file's own render loop), buildLinkFilter ran on every
// render too, so the queryKey's VALUE (not just its object reference)
// differed each time. React Query hashes queryKeys by deep value
// (hashKey() in @tanstack/query-core), so a changing value means "new
// query" every render — each fetch's own resolution triggers the next
// render, which mints the next id, forever. Fixed by making the condition's
// id deterministic (derived from fieldName/recordId) and memoizing
// buildLinkFilter's result. This test re-renders the Renderer repeatedly
// with a fresh config object each time (simulating DetailTabList's real
// per-render parseConfig() call) and asserts the existence-check fires
// exactly once, not once per render.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RelatedFormTabRenderer } from './Renderer'
import { formsApi } from '@/features/forms/api'
import type { RelatedFormTabConfig } from './schema'

afterEach(() => cleanup())

vi.mock('../../RecordsTable', () => ({
  RecordsTable: () => <div data-testid="records-table" />,
}))

function renderWithQueryClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return { ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>), client }
}

// A fresh object every call — mirrors DetailTabList.tsx's
// `const config = def.parseConfig(t.config)`, which re-parses on every
// render rather than returning a cached/memoized reference.
function freshConfig(): RelatedFormTabConfig {
  return {
    targetFormId: 'form_target',
    targetFieldName: 'parent_id',
    hideWhenEmpty: true,
  }
}

describe('RelatedFormTabRenderer — hideWhenEmpty existence-check query stability', () => {
  it('fires the existence-check query once, not once per re-render with a fresh config object', async () => {
    const searchRecords = vi.spyOn(formsApi, 'searchRecords').mockResolvedValue({ records: [], total: 0 })

    const { rerender, client } = renderWithQueryClient(
      <RelatedFormTabRenderer
        formId="form_owner"
        recordId="rec_1"
        fields={[]}
        config={freshConfig()}
      />,
    )

    await waitFor(() => expect(searchRecords).toHaveBeenCalledTimes(1))

    // Re-render several times with a NEW config object each time (same
    // content, different reference) — this is exactly what the buggy
    // version turned into repeated fetches, since the old nanoid()-keyed
    // filter changed VALUE (not just reference) on every one of these.
    for (let i = 0; i < 5; i++) {
      rerender(
        <QueryClientProvider client={client}>
          <RelatedFormTabRenderer
            formId="form_owner"
            recordId="rec_1"
            fields={[]}
            config={freshConfig()}
          />
        </QueryClientProvider>,
      )
    }

    // Give any runaway refetch loop a chance to manifest.
    await new Promise((r) => setTimeout(r, 50))

    expect(searchRecords).toHaveBeenCalledTimes(1)
  })
})
