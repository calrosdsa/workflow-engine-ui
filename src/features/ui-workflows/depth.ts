// How a form knows how deep it is.
//
// An `open_form` step opens a form that runs its own workflows, and those runs
// need to inherit the depth or the bound means nothing — a form at depth 3
// starting a run at depth 0 could open another form immediately.
//
// A React context rather than a prop threaded through FormRenderer, because
// the forms that need it are not the ones being rendered by a caller who knows
// about workflows: they are ordinary <FormRenderer> instances that happen to be
// inside a workflow-opened modal. The modal provides the value; every hook
// under it reads it and no intermediate component has to carry it.
import { createContext, useContext } from 'react'

/** Depth of the form currently being rendered. Zero everywhere except inside
 *  a modal that a workflow opened. */
export const UiWorkflowDepthContext = createContext(0)

export function useUiWorkflowDepth(): number {
  return useContext(UiWorkflowDepthContext)
}
