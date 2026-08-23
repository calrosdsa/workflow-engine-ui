// @vitest-environment jsdom
//
// Regression test for a canvas-hydration race in FormBuilderPage: switching
// from one existing form to another in-app (Back to forms -> a different
// form's link) reused the SAME component instance across the $formId param
// change (TanStack Router doesn't unmount appFormDetailRoute's component on
// a param-only change), but `initialised` — the flag guarding
// FormCanvas/FormBuilderDnd from mounting before the new form's real schema
// has been hydrated into the store — was only ever set to `true`, never
// reset to `false` on a form switch. So after visiting form A once,
// `initialised` stayed `true` for every subsequent form, defeating the
// guard for every navigation after the first.
//
// This isolates exactly that state-machine shape (not the whole page, which
// would need heavy TanStack Router/Zustand-store mocking with no existing
// precedent in this codebase) and asserts the guard is engaged (spinner
// shown, canvas not yet trusted) at the moment a SECOND form's id arrives
// with its data still in flight — the exact window the bug exposed stale
// or empty content in.
import { useEffect, useState } from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'

afterEach(() => cleanup())

interface Loaded { id: string; sections: number }

// Mirrors FormBuilderPage's actual shape: an `initialised` flag set true by
// a hydration effect keyed on `loaded`, PLUS the fix — a second effect
// keyed on `formId` alone that resets it back to false the instant the id
// changes, before the hydration effect has any chance to see new data.
function Harness({ formId, loaded }: { formId: string; loaded: Loaded | undefined }) {
  const [initialised, setInitialised] = useState(false)
  const [hydratedSections, setHydratedSections] = useState<number | null>(null)

  useEffect(() => {
    setInitialised(false)
  }, [formId])

  useEffect(() => {
    if (loaded) {
      setHydratedSections(loaded.sections)
      setInitialised(true)
    }
  }, [loaded])

  if (!initialised) return <div data-testid="spinner">Loading form…</div>
  return <div data-testid="canvas">sections: {hydratedSections}</div>
}

describe('FormBuilderPage hydration guard — form-to-form switch race', () => {
  it('re-engages the loading guard when formId changes, even though it was already true for the previous form', () => {
    const { rerender } = render(<Harness formId="form-a" loaded={{ id: 'form-a', sections: 2 }} />)
    expect(screen.getByText('sections: 2')).toBeTruthy()

    // Switch to form B: its data hasn't arrived yet (loaded is undefined,
    // exactly like the render right after a $formId param change before
    // useForm's new query resolves). Without the fix, `initialised` was
    // still true from form A, so the canvas would render immediately here
    // — with STALE form A data still in the store, or worse, whatever the
    // store had reset to. With the fix, the formId-keyed effect flips
    // initialised back to false first, so the guard re-engages.
    rerender(<Harness formId="form-b" loaded={undefined} />)
    expect(screen.getByTestId('spinner')).toBeTruthy()
    expect(screen.queryByTestId('canvas')).toBeNull()

    // Form B's data arrives — guard lifts, now showing form B's real data.
    rerender(<Harness formId="form-b" loaded={{ id: 'form-b', sections: 5 }} />)
    expect(screen.getByText('sections: 5')).toBeTruthy()
  })

  it('does NOT re-engage the guard on a re-render with the same formId (no unnecessary flicker)', () => {
    const { rerender } = render(<Harness formId="form-a" loaded={{ id: 'form-a', sections: 2 }} />)
    expect(screen.getByText('sections: 2')).toBeTruthy()

    // Same formId, e.g. a re-render from unrelated parent state — must NOT
    // drop back to the spinner just because the component re-rendered.
    rerender(<Harness formId="form-a" loaded={{ id: 'form-a', sections: 2 }} />)
    expect(screen.getByText('sections: 2')).toBeTruthy()
    expect(screen.queryByTestId('spinner')).toBeNull()
  })
})
