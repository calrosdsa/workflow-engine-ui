// @vitest-environment jsdom
//
// Render proof that Advanced Settings reach the RECORD DETAIL surface.
//
// FormRenderer.advanced.test.tsx proved the rules work while FILLING a form;
// this file pins the other place the same form UI renders — the detail
// page's Details layout. Before this wiring, a field hidden_in_ui for a role
// still displayed its stored value here, and ANY rule on a field (whoever it
// targeted) disabled inline editing for every viewer via the old blanket
// exclusion. Both directions are asserted: the restricted viewer loses
// exactly what the rule says, and everyone else keeps what they had.
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import { RecordDetailPanel } from './RecordDetailPanel'
import { resolveFormSchema } from '@/features/form-builder/serialize'
import { useAuthStore } from '@/stores/auth'
import type { FieldDef, FormRecord } from '@/features/forms/types'
import type { AdvancedSetting, FormSchema } from '@/features/form-builder/schema'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver

// The panel's data hooks reach the network; the record is fixed data here.
const record: FormRecord = {
  id: 'r-1',
  customer: 'Acme',
  discount_reason: 'Loyalty program',
  amount: 250,
}
// A schema with no settings.detailTabs resolves through defaultDetailTabs()
// (registry.ts), which now backfills Attachments/Tags/Comments/Audit Log
// onto every record detail page regardless of what this test itself cares
// about (Details-tab field rules) — so their data hooks need the same
// empty-but-defined mocking useAuditLog/useLinkedRecords already needed,
// or the ones this test doesn't otherwise touch throw on an unmocked call.
vi.mock('./record-detail-hooks', () => ({
  useRecordDetail: () => ({ data: record, isLoading: false }),
  useAuditLog: () => ({ data: [], isLoading: false }),
  useLinkedRecords: () => ({ data: [], isLoading: false }),
  useAttachments: () => ({ data: [], isLoading: false }),
  useUploadAttachment: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteAttachment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useTags: () => ({ data: { entries: [] }, isLoading: false }),
  useAddTag: () => ({ mutate: vi.fn(), isPending: false }),
  useRemoveTag: () => ({ mutate: vi.fn(), isPending: false }),
  useTagSuggestions: () => ({ data: { tags: [] } }),
  useComments: () => ({ data: { entries: [], total: 0 }, isLoading: false }),
  useCreateComment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateComment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteComment: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('@/features/forms/hooks', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useUpdateRecord: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useForm: () => ({ data: undefined, isLoading: false }),
}))

afterEach(cleanup)

const fields: FieldDef[] = [
  { name: 'customer', label: 'Customer', type: 'string', required: true },
  { name: 'discount_reason', label: 'Discount Reason', type: 'string' },
  { name: 'amount', label: 'Amount', type: 'integer' },
]

function signInAs(roleId: string, userId = 'u-1') {
  useAuthStore.setState({
    session: {
      user_id: userId,
      memberships: [{ client_id: 'c-1', app_id: 'a-1', role_id: roleId, permissions: ['forms:*'] }],
    },
    activeMembership: { client_id: 'c-1', app_id: 'a-1' },
  } as unknown as ReturnType<typeof useAuthStore.getState>)
}

function schemaWithRules(fieldKey: string, settings: AdvancedSetting[]): FormSchema {
  const schema = resolveFormSchema({ layout: null, fields })
  for (const section of schema.sections) {
    for (const column of section.columns) {
      for (const el of column.elements) {
        if (el.key === fieldKey) el.advancedSettings = settings
      }
    }
  }
  return schema
}

function renderPanel(schema: FormSchema) {
  // Real providers, no network: the data hooks this test cares about are
  // mocked above; the remaining ones (useTeamUsers) just need a client and
  // are content to stay loading with retries off. I18nProvider is real
  // (not mocked) because DetailTabList's tab labels resolve through it —
  // the base English dictionary is all any assertion here needs.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <RecordDetailPanel formId="f-1" recordId="r-1" fields={fields} schema={schema} />
      </I18nProvider>
    </QueryClientProvider>,
  )
}

const hideForSales: AdvancedSetting = {
  id: 's1',
  name: 'Hide discount reason from sales',
  appliesTo: 'specific_role',
  roleIds: ['role-sales'],
  when: { id: 'g1', combinator: 'and', conditions: [], groups: [] },
  actions: [{ id: 'a1', type: 'hidden_in_ui' }],
}

const readOnlyOverThreshold: AdvancedSetting = {
  id: 's2',
  name: 'Lock big amounts',
  appliesTo: 'everyone',
  when: {
    id: 'g2',
    combinator: 'and',
    conditions: [{ id: 'c1', field: 'amount', op: 'gt', value: 100 }],
    groups: [],
  },
  actions: [{ id: 'a2', type: 'read_only' }],
}

beforeEach(() => signInAs('role-sales'))

describe('hidden_in_ui on the record detail page', () => {
  it('hides the field AND its stored value from a viewer in the rule audience', () => {
    renderPanel(schemaWithRules('discount_reason', [hideForSales]))
    expect(screen.getByText('Customer')).toBeTruthy()
    expect(screen.queryByText('Discount Reason')).toBeNull()
    // The stored value must not leak either — that was the actual bug.
    expect(screen.queryByText('Loyalty program')).toBeNull()
  })

  it('leaves the field visible for a viewer outside the audience', () => {
    signInAs('role-manager')
    renderPanel(schemaWithRules('discount_reason', [hideForSales]))
    expect(screen.getByText('Discount Reason')).toBeTruthy()
    expect(screen.getByText('Loyalty program')).toBeTruthy()
  })
})

describe('read_only on the record detail page', () => {
  it('disables inline editing when the rule condition matches the record', () => {
    renderPanel(schemaWithRules('amount', [readOnlyOverThreshold])) // amount 250 > 100
    // Value still displays, but there is no click-to-edit button for it.
    expect(screen.getByText('250')).toBeTruthy()
    expect(screen.queryByTitle('Save')).toBeNull()
    const editButtons = screen.queryAllByRole('button').filter((b) => b.textContent?.includes('250'))
    expect(editButtons).toHaveLength(0)
  })

  it('keeps inline editing for a rule targeting someone else (no blanket lockout)', () => {
    // Same rule shape, but scoped to a role the viewer does not hold: the
    // old behavior disabled editing for everyone the moment ANY rule
    // existed on the element.
    const forOthers: AdvancedSetting = { ...readOnlyOverThreshold, appliesTo: 'specific_role', roleIds: ['role-finance'] }
    renderPanel(schemaWithRules('amount', [forOthers]))
    const editButtons = screen.queryAllByRole('button').filter((b) => b.textContent?.includes('250'))
    expect(editButtons).toHaveLength(1)
  })
})
