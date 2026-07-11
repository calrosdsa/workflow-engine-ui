import { create } from 'zustand'
import {
  type FormSchema, type FormElement, type FormSection, type FormColumn,
  type ColumnLayout, type ComponentType, emptySchema,
} from './schema'
import { createElement, createSection, duplicateElement, duplicateSection, relayoutSection } from './factory'
import { createTreeStore, findItem, type ItemLocation } from '@/features/builder-kit/tree-store'

export type ElementLocation = ItemLocation

// ---------------------------------------------------------------------------
// Tree store: sections -> columns -> elements. Built on the generic
// builder-kit core (see features/builder-kit/tree-store.ts) — this file
// supplies the accessors/factories that make FormSchema concrete, plus the
// form-level metadata (name/slug/isDirty) the core deliberately doesn't
// know about (see TreeStoreConfig's docs on why there's no "Extra" slot).
// ---------------------------------------------------------------------------

const accessors = {
  getItems: (column: FormColumn) => column.elements,
  setItems: (column: FormColumn, elements: FormElement[]) => ({ ...column, elements }),
}

export const useFormBuilderStore = createTreeStore<FormSchema, FormSection, FormColumn, FormElement, ComponentType, ColumnLayout>({
  emptySchema,
  createSection,
  duplicateSection,
  relayoutSection,
  createItem: createElement,
  duplicateItem: duplicateElement,
  accessors,
  onMutate: () => useFormMetaStore.getState().markDirty(),
})

export function findElement(schema: FormSchema, id: string) {
  return findItem(schema, id, accessors)
}

// ---------------------------------------------------------------------------
// Form-level metadata: name/slug/description/isDirty. Not part of the tree
// shape, so it lives in its own store rather than growing the generic core's
// return type — see the builder-kit collapse's design notes.
// ---------------------------------------------------------------------------

interface FormMetaState {
  formId: string | null
  name: string
  slug: string
  description: string
  isDirty: boolean

  setName: (name: string) => void
  setSlug: (slug: string) => void
  setDescription: (d: string) => void
  loadForm: (args: { id: string | null; name: string; slug: string; description: string }) => void
  reset: () => void
  markSaved: () => void
  markDirty: () => void
}

export const useFormMetaStore = create<FormMetaState>((set) => ({
  formId: null,
  name: 'Untitled Form',
  slug: '',
  description: '',
  isDirty: false,

  setName: (name) => set({ name, isDirty: true }),
  setSlug: (slug) => set({ slug, isDirty: true }),
  setDescription: (description) => set({ description, isDirty: true }),

  loadForm: ({ id, name, slug, description }) =>
    set({ formId: id, name, slug, description, isDirty: false }),

  reset: () =>
    set({ formId: null, name: 'Untitled Form', slug: '', description: '', isDirty: false }),

  markSaved: () => set({ isDirty: false }),
  markDirty: () => set({ isDirty: true }),
}))

/** Hydrates both stores together — the tree's schema and the form's
 *  metadata are two different stores now, but callers load them as one
 *  unit (mirrors the pre-split `loadForm` call shape). The two `set()`
 *  calls land in the same synchronous tick, so React 19's automatic
 *  batching flushes them in one render — no frame observes metadata
 *  cleared but the schema not yet loaded, or vice versa. */
export function loadForm(args: { id: string | null; name: string; slug: string; description: string; schema: FormSchema }) {
  useFormMetaStore.getState().loadForm(args)
  useFormBuilderStore.getState().loadSchema(args.schema)
}

/** Resets both stores together (mirrors the pre-split `reset` call shape). */
export function resetFormBuilder() {
  useFormMetaStore.getState().reset()
  useFormBuilderStore.getState().reset()
}
