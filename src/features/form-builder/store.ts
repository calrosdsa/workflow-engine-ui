import { create } from 'zustand'
import {
  type FormSchema, type FormElement, type FormSection,
  type ComponentType, type ColumnLayout, emptySchema,
} from './schema'
import {
  createElement, createSection, duplicateElement, duplicateSection, relayoutSection,
} from './factory'

// A location address within the schema (which column an element lives in).
export interface ElementLocation {
  sectionId: string
  columnId: string
  index: number
}

interface FormBuilderState {
  // Form-level metadata
  formId: string | null
  name: string
  slug: string
  description: string

  schema: FormSchema
  selectedElementId: string | null
  selectedSectionId: string | null
  isDirty: boolean

  // --- form meta ---
  setName: (name: string) => void
  setSlug: (slug: string) => void
  setDescription: (d: string) => void
  loadForm: (args: { id: string | null; name: string; slug: string; description: string; schema: FormSchema }) => void
  reset: () => void
  markSaved: () => void

  // --- selection ---
  selectElement: (id: string | null) => void
  selectSection: (id: string | null) => void

  // --- sections ---
  addSection: () => void
  updateSection: (id: string, patch: Partial<Omit<FormSection, 'columns'>>) => void
  setSectionLayout: (id: string, layout: ColumnLayout) => void
  duplicateSectionById: (id: string) => void
  deleteSection: (id: string) => void
  moveSection: (fromIndex: number, toIndex: number) => void
  toggleSectionCollapsed: (id: string) => void

  // --- elements ---
  addElement: (component: ComponentType, sectionId: string, columnId: string, index?: number) => void
  updateElement: (id: string, patch: Partial<FormElement>) => void
  duplicateElementById: (id: string) => void
  deleteElement: (id: string) => void
  /** Moves an element to a target column at a target index (drag-and-drop). */
  moveElement: (elementId: string, target: { sectionId: string; columnId: string; index: number }) => void
}

// ---------------------------------------------------------------------------
// helpers (pure)
// ---------------------------------------------------------------------------

function findElement(schema: FormSchema, id: string): { element: FormElement; loc: ElementLocation } | null {
  for (const section of schema.sections) {
    for (const column of section.columns) {
      const index = column.elements.findIndex((e) => e.id === id)
      if (index !== -1) {
        return { element: column.elements[index], loc: { sectionId: section.id, columnId: column.id, index } }
      }
    }
  }
  return null
}

/** Returns a new schema with `mut` applied to a copy. Sections/columns/elements
 *  are shallow-rebuilt along the touched path; React-friendly immutability. */
function produce(schema: FormSchema, mut: (draft: FormSchema) => void): FormSchema {
  const draft: FormSchema = structuredClone(schema)
  mut(draft)
  return draft
}

// ---------------------------------------------------------------------------
// store
// ---------------------------------------------------------------------------

export const useFormBuilderStore = create<FormBuilderState>((set) => ({
  formId: null,
  name: 'Untitled Form',
  slug: '',
  description: '',
  schema: emptySchema(),
  selectedElementId: null,
  selectedSectionId: null,
  isDirty: false,

  setName: (name) => set({ name, isDirty: true }),
  setSlug: (slug) => set({ slug, isDirty: true }),
  setDescription: (description) => set({ description, isDirty: true }),

  loadForm: ({ id, name, slug, description, schema }) =>
    set({
      formId: id, name, slug, description,
      schema: schema.sections.length ? schema : emptySchema(),
      selectedElementId: null, selectedSectionId: null, isDirty: false,
    }),

  reset: () =>
    set({
      formId: null, name: 'Untitled Form', slug: '', description: '',
      schema: emptySchema(), selectedElementId: null, selectedSectionId: null, isDirty: false,
    }),

  markSaved: () => set({ isDirty: false }),

  selectElement: (id) => set({ selectedElementId: id, selectedSectionId: null }),
  selectSection: (id) => set({ selectedSectionId: id, selectedElementId: null }),

  // --- sections ---
  addSection: () =>
    set((s) => {
      const section = createSection(`Section ${s.schema.sections.length + 1}`)
      return {
        schema: produce(s.schema, (d) => { d.sections.push(section) }),
        selectedSectionId: section.id,
        selectedElementId: null,
        isDirty: true,
      }
    }),

  updateSection: (id, patch) =>
    set((s) => ({
      schema: produce(s.schema, (d) => {
        const sec = d.sections.find((x) => x.id === id)
        if (sec) Object.assign(sec, patch)
      }),
      isDirty: true,
    })),

  setSectionLayout: (id, layout) =>
    set((s) => ({
      schema: produce(s.schema, (d) => {
        const idx = d.sections.findIndex((x) => x.id === id)
        if (idx !== -1) d.sections[idx] = relayoutSection(d.sections[idx], layout)
      }),
      isDirty: true,
    })),

  duplicateSectionById: (id) =>
    set((s) => {
      const idx = s.schema.sections.findIndex((x) => x.id === id)
      if (idx === -1) return s
      const copy = duplicateSection(s.schema.sections[idx])
      return {
        schema: produce(s.schema, (d) => { d.sections.splice(idx + 1, 0, copy) }),
        selectedSectionId: copy.id,
        isDirty: true,
      }
    }),

  deleteSection: (id) =>
    set((s) => ({
      schema: produce(s.schema, (d) => { d.sections = d.sections.filter((x) => x.id !== id) }),
      selectedSectionId: s.selectedSectionId === id ? null : s.selectedSectionId,
      isDirty: true,
    })),

  moveSection: (fromIndex, toIndex) =>
    set((s) => ({
      schema: produce(s.schema, (d) => {
        if (fromIndex < 0 || fromIndex >= d.sections.length) return
        const [moved] = d.sections.splice(fromIndex, 1)
        d.sections.splice(toIndex, 0, moved)
      }),
      isDirty: true,
    })),

  toggleSectionCollapsed: (id) =>
    set((s) => ({
      schema: produce(s.schema, (d) => {
        const sec = d.sections.find((x) => x.id === id)
        if (sec) sec.collapsed = !sec.collapsed
      }),
    })),

  // --- elements ---
  addElement: (component, sectionId, columnId, index) =>
    set((s) => {
      const el = createElement(component)
      return {
        schema: produce(s.schema, (d) => {
          const col = d.sections.find((x) => x.id === sectionId)?.columns.find((c) => c.id === columnId)
          if (!col) return
          const at = index ?? col.elements.length
          col.elements.splice(at, 0, el)
        }),
        selectedElementId: el.id,
        selectedSectionId: null,
        isDirty: true,
      }
    }),

  updateElement: (id, patch) =>
    set((s) => ({
      schema: produce(s.schema, (d) => {
        const found = findElement(d, id)
        if (found) {
          const col = d.sections.find((x) => x.id === found.loc.sectionId)!.columns.find((c) => c.id === found.loc.columnId)!
          col.elements[found.loc.index] = { ...col.elements[found.loc.index], ...patch }
        }
      }),
      isDirty: true,
    })),

  duplicateElementById: (id) =>
    set((s) => {
      const found = findElement(s.schema, id)
      if (!found) return s
      const copy = duplicateElement(found.element)
      return {
        schema: produce(s.schema, (d) => {
          const col = d.sections.find((x) => x.id === found.loc.sectionId)!.columns.find((c) => c.id === found.loc.columnId)!
          col.elements.splice(found.loc.index + 1, 0, copy)
        }),
        selectedElementId: copy.id,
        isDirty: true,
      }
    }),

  deleteElement: (id) =>
    set((s) => ({
      schema: produce(s.schema, (d) => {
        const found = findElement(d, id)
        if (found) {
          const col = d.sections.find((x) => x.id === found.loc.sectionId)!.columns.find((c) => c.id === found.loc.columnId)!
          col.elements.splice(found.loc.index, 1)
        }
      }),
      selectedElementId: s.selectedElementId === id ? null : s.selectedElementId,
      isDirty: true,
    })),

  moveElement: (elementId, target) =>
    set((s) => ({
      schema: produce(s.schema, (d) => {
        const found = findElement(d, elementId)
        if (!found) return
        // Remove from source
        const srcCol = d.sections.find((x) => x.id === found.loc.sectionId)!.columns.find((c) => c.id === found.loc.columnId)!
        const [moved] = srcCol.elements.splice(found.loc.index, 1)
        // Insert into target
        const tgtCol = d.sections.find((x) => x.id === target.sectionId)?.columns.find((c) => c.id === target.columnId)
        if (!tgtCol) {
          // Target vanished — put it back to avoid data loss.
          srcCol.elements.splice(found.loc.index, 0, moved)
          return
        }
        const clamped = Math.max(0, Math.min(target.index, tgtCol.elements.length))
        tgtCol.elements.splice(clamped, 0, moved)
      }),
      isDirty: true,
    })),
}))

export { findElement }
