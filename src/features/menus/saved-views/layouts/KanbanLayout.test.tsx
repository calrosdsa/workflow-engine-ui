// @vitest-environment jsdom
//
// KanbanLayout must call the same hooks whether or not its group field is
// usable. columnKeySet's useMemo used to sit after the missing/invalid
// group-field returns, so a board whose group field appeared (the form's
// fields arriving, or the field being fixed) rendered one more hook than
// before and React threw ("Rendered more hooks than during the previous
// render").
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { KanbanLayout } from './KanbanLayout'
import type { FieldDef } from '@/features/forms/types'

// jsdom has no ResizeObserver; dnd-kit's measuring may reach for one.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
;(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= ResizeObserverStub

vi.mock('@/features/forms/runtime/useKanbanColumn', () => ({
  useKanbanColumn: () => ({ records: [], total: 0, hasNextPage: false, isFetchingNextPage: false, fetchNextPage: vi.fn() }),
}))
vi.mock('@/features/forms/hooks', () => ({
  useUpdateRecord: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
}))
vi.mock('@/features/i18n/I18nProvider', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/i18n/I18nProvider')>()),
  useTranslation: () => (key: string) => key,
}))

afterEach(cleanup)

const status = { name: 'status', label: 'Status', type: 'enum', enum_values: ['open', 'done'] } as FieldDef

describe('KanbanLayout', () => {
  it('renders a board whose group field appears and then goes missing again', () => {
    const qc = new QueryClient()
    const board = (fields: FieldDef[]) => (
      <QueryClientProvider client={qc}>
        <KanbanLayout
          formId="f-1"
          fields={fields}
          config={{ groupField: 'status' }}
          filter={{ combinator: 'and', conditions: [], groups: [] }}
          sort={[]}
          columns={[]}
          enumLabels={new Map()}
          onOpenRecord={vi.fn()}
        />
      </QueryClientProvider>
    )

    const { rerender } = render(board([]))
    expect(screen.getByText('menus.saved_views.kanban.field_missing')).toBeTruthy()

    rerender(board([status]))
    expect(screen.queryByText('menus.saved_views.kanban.field_missing')).toBeNull()
    expect(screen.getAllByText('open').length).toBeGreaterThan(0)

    rerender(board([]))
    expect(screen.getByText('menus.saved_views.kanban.field_missing')).toBeTruthy()
  })
})
