// @vitest-environment jsdom
//
// TC-03 from FR-D1-008 — the test that document calls its most important and
// explicitly never ran. Its conclusion (an out-of-registry menu_type throws,
// with no error boundary anywhere to catch it) was reached by reading code and
// router configuration, not by observing behaviour; §8 recorded that as a
// standing assumption to validate before implementation. This file executes it,
// then pins the fallback that now replaces the crash.
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MENU_TYPE_REGISTRY, getMenuType, type MenuTypeRegistryEntry } from '@/features/menus/menu-registry'
import { I18nProvider } from '@/features/i18n/I18nProvider'
import { UnavailableMenu } from './UnavailableMenu'

const UNREGISTERED = 'timeline'

describe('FR-D1-008 — unregistered menu_type', () => {
  it('the raw index expression returns undefined and throws on the next property access', () => {
    // The pre-fix mechanism, executed rather than predicted. The cast is the
    // point: Record<MenuType, T> types this access as unconditionally present,
    // which is why no call site was ever made to null-check it.
    const raw = (MENU_TYPE_REGISTRY as Record<string, MenuTypeRegistryEntry>)[UNREGISTERED]
    expect(raw).toBeUndefined()
    expect(() => raw.runtimeRenderer).toThrow(TypeError)
  })

  it('getMenuType returns undefined instead, forcing the caller to handle the miss', () => {
    expect(getMenuType(UNREGISTERED)).toBeUndefined()
  })

  it('still resolves every currently registered type', () => {
    for (const type of Object.keys(MENU_TYPE_REGISTRY)) {
      expect(getMenuType(type)?.type).toBe(type)
    }
  })

  it('renders the fallback rather than crashing, naming the offending type', () => {
    render(<I18nProvider><UnavailableMenu type={UNREGISTERED} /></I18nProvider>)
    expect(screen.getByText('Menu unavailable')).toBeTruthy()
    expect(screen.getByText(new RegExp(UNREGISTERED))).toBeTruthy()
  })
})
