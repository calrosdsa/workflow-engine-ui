// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import { KnowledgeBasesSubsection } from './KnowledgeBasesSubsection'

const knowledgeBases = vi.hoisted(() => ({
  data: [
    { id: 'kb-policies', name: 'Policies', description: 'Company policies' },
    { id: 'kb-pricing', name: 'Pricing', description: '' },
  ] as { id: string; name: string; description: string }[] | undefined,
  isLoading: false,
}))

vi.mock('@/features/knowledge/hooks', () => ({
  useKnowledgeBases: () => knowledgeBases,
}))

const permission = vi.hoisted(() => ({ canViewKnowledge: true }))

vi.mock('@/features/auth/permissions', () => ({
  usePermission: (need: string) => need === 'knowledge:read' && permission.canViewKnowledge,
}))

afterEach(cleanup)

function renderSubsection(selected: string[], canWrite = true) {
  const onChange = vi.fn()
  render(
    <I18nProvider>
      <KnowledgeBasesSubsection selected={selected} onChange={onChange} canWrite={canWrite} />
    </I18nProvider>,
  )
  return onChange
}

describe('KnowledgeBasesSubsection', () => {
  it('lists the knowledge bases the app can read, checked when attached', () => {
    renderSubsection(['kb-pricing'])
    expect(screen.getByRole('checkbox', { name: /Policies/ }).getAttribute('aria-checked')).toBe('false')
    expect(screen.getByRole('checkbox', { name: /Pricing/ }).getAttribute('aria-checked')).toBe('true')
  })

  it('attaches and detaches a knowledge base', () => {
    const onChange = renderSubsection(['kb-pricing'])
    fireEvent.click(screen.getByRole('checkbox', { name: /Policies/ }))
    expect(onChange).toHaveBeenLastCalledWith(['kb-pricing', 'kb-policies'])
    fireEvent.click(screen.getByRole('checkbox', { name: /Pricing/ }))
    expect(onChange).toHaveBeenLastCalledWith([])
  })

  it('says when an attached knowledge base is gone, and drops it on the next change', () => {
    const onChange = renderSubsection(['kb-deleted'])
    expect(screen.getByText(/no longer available/)).toBeTruthy()
    fireEvent.click(screen.getByRole('checkbox', { name: /Policies/ }))
    expect(onChange).toHaveBeenLastCalledWith(['kb-policies'])
  })

  it('cannot be changed without write access', () => {
    const onChange = renderSubsection([], false)
    fireEvent.click(screen.getByRole('checkbox', { name: /Policies/ }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('explains, instead of listing, when the user may not view knowledge bases', () => {
    permission.canViewKnowledge = false
    try {
      renderSubsection(['kb-pricing'])
      expect(screen.getByText(/requires permission to view knowledge bases/)).toBeTruthy()
      expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    } finally {
      permission.canViewKnowledge = true
    }
  })

  it('says so when the app has no knowledge bases', () => {
    const saved = knowledgeBases.data
    knowledgeBases.data = []
    try {
      renderSubsection([])
      expect(screen.getByText(/no knowledge bases yet/)).toBeTruthy()
    } finally {
      knowledgeBases.data = saved
    }
  })
})
