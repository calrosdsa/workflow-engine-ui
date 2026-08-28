import { create } from 'zustand'
import {
  type FormSchema, type FormElement, type FormSection, type FormColumn,
  type ColumnLayout, type ComponentType, type CreateUserSettings, type DetailTabConfig,
  type DetailPageLayoutId, type DetailTabOrientation, type CustomActionConfig,
  DETAIL_PAGE_LAYOUTS, DEFAULT_DETAIL_PAGE_ZONE,
  emptySchema, emptyFormSettings, emptyCreateUserSettings,
} from './schema'
import { createElement, createSection, duplicateElement, duplicateSection, relayoutSection, createAccountSection, createParentReferenceField } from './factory'
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

/** Patches FormSchema.settings.createUser (the "Additional Form Settings" ->
 *  Create User section). Not part of the generic tree-store core — that core
 *  is shared with page-builder, which has no equivalent concept — so this is
 *  a one-off, form-builder-specific mutation living next to the store it
 *  extends, mirroring the core's "mutate then mark dirty" contract. */
export function updateCreateUserSettings(patch: Partial<CreateUserSettings>) {
  useFormBuilderStore.setState((s) => ({
    schema: {
      ...s.schema,
      settings: {
        ...(s.schema.settings ?? emptyFormSettings()),
        createUser: { ...(s.schema.settings?.createUser ?? emptyCreateUserSettings()), ...patch },
      },
    },
  }))
  useFormMetaStore.getState().markDirty()
}

/** Patches FormSchema.settings.detailTabs (the "Detail Page" config panel,
 *  FR-D2-015) — same one-off pattern as updateCreateUserSettings, next to
 *  the store it extends, since this concept also has no page-builder
 *  equivalent. Replaces the whole array rather than patching individual
 *  entries — callers (the Detail Page panel's own reorder/add/remove/edit
 *  handlers) always compute the next full array themselves. */
export function updateDetailTabs(next: DetailTabConfig[]) {
  useFormBuilderStore.setState((s) => ({
    schema: {
      ...s.schema,
      settings: {
        ...(s.schema.settings ?? emptyFormSettings()),
        detailTabs: next,
      },
    },
  }))
  useFormMetaStore.getState().markDirty()
}

/** Switches FormSchema.settings.tabOrientation (Detail Page Builder header
 *  toggle) — same one-off replace-the-field pattern as updateDetailTabs,
 *  no reconciliation needed since orientation doesn't affect zones/tabs. */
export function updateTabOrientation(next: DetailTabOrientation) {
  useFormBuilderStore.setState((s) => ({
    schema: {
      ...s.schema,
      settings: {
        ...(s.schema.settings ?? emptyFormSettings()),
        tabOrientation: next,
      },
    },
  }))
  useFormMetaStore.getState().markDirty()
}

/** Patches FormSchema.settings.customActions (the "Custom Actions" config
 *  panel, FR-D2-017) — same one-off pattern as updateDetailTabs, next to it.
 *  Replaces the whole array rather than patching individual entries — the
 *  Custom Actions panel's own reorder/add/remove/edit handlers always
 *  compute the next full array themselves. */
export function updateCustomActions(next: CustomActionConfig[]) {
  useFormBuilderStore.setState((s) => ({
    schema: {
      ...s.schema,
      settings: {
        ...(s.schema.settings ?? emptyFormSettings()),
        customActions: next,
      },
    },
  }))
  useFormMetaStore.getState().markDirty()
}

/** Switches FormSchema.settings.detailLayout (Detail Page Builder) AND
 *  reconciles every existing detailTabs entry in the same update — any tab
 *  whose `zone` isn't one of the NEW layout's zone ids gets reset to
 *  DEFAULT_DETAIL_PAGE_ZONE ('main') right here, not lazily at render time.
 *  Runs once, at the moment the layout is switched, so the user sees their
 *  sidebar tabs visibly move to Content when they pick Single Column —
 *  ZonedDetailTabList's own runtime fallback (same rule) exists as a
 *  defensive floor for data that somehow skipped this, not as the primary
 *  mechanism; leaving reconciliation to render time only would mean a
 *  tab's `zone` field silently drifts out of sync with what's visually
 *  true the moment you inspect the saved data directly. */
export function updateDetailLayout(next: DetailPageLayoutId) {
  useFormBuilderStore.setState((s) => {
    const zoneIds = new Set((DETAIL_PAGE_LAYOUTS[next]?.zones ?? DETAIL_PAGE_LAYOUTS.single.zones).map((z) => z.id))
    const currentTabs = s.schema.settings?.detailTabs ?? []
    const reconciled = currentTabs.map((t) =>
      t.zone && !zoneIds.has(t.zone) ? { ...t, zone: DEFAULT_DETAIL_PAGE_ZONE } : t,
    )
    return {
      schema: {
        ...s.schema,
        settings: {
          ...(s.schema.settings ?? emptyFormSettings()),
          detailLayout: next,
          detailTabs: reconciled,
        },
      },
    }
  })
  useFormMetaStore.getState().markDirty()
}

/** Injects the "Account" section (Name/Email/Role fields) onto the canvas
 *  and records its section/field keys on CreateUserSettings. Called when the
 *  "Create user with each enrollment" toggle turns on. Prepends the section
 *  so Account fields appear first, ahead of the form's own fields. Not part
 *  of the generic tree-store core for the same reason as
 *  updateCreateUserSettings — this concept doesn't exist in page-builder. */
export function insertAccountSection() {
  const { section, nameKey, emailKey, roleKey } = createAccountSection()
  useFormBuilderStore.setState((s) => ({
    schema: { ...s.schema, sections: [section, ...s.schema.sections] },
  }))
  useFormMetaStore.getState().markDirty()
  updateCreateUserSettings({
    enabled: true,
    accountSectionId: section.id,
    nameFieldKey: nameKey,
    emailFieldKey: emailKey,
    roleFieldKey: roleKey,
  })
}

/** Removes the previously-injected "Account" section (tracked via
 *  CreateUserSettings.accountSectionId) and clears the field-key references.
 *  Called when the "Create user with each enrollment" toggle turns off. A
 *  no-op if no section is currently tracked. */
export function removeAccountSection() {
  useFormBuilderStore.setState((s) => {
    const id = s.schema.settings?.createUser?.accountSectionId
    if (!id) return s
    return { schema: { ...s.schema, sections: s.schema.sections.filter((sec) => sec.id !== id) } }
  })
  useFormMetaStore.getState().markDirty()
  updateCreateUserSettings({
    enabled: false,
    accountSectionId: undefined,
    nameFieldKey: undefined,
    emailFieldKey: undefined,
    roleFieldKey: undefined,
  })
}

/** Deletes a section, and — if it happens to be the tracked Account section
 *  (CreateUserSettings.accountSectionId) — also clears CreateUserSettings,
 *  exactly like removeAccountSection does. The canvas's ordinary "Delete
 *  section" action (SectionCard's dropdown) goes through this wrapper
 *  instead of the generic tree-store core's own deleteSection directly:
 *  that core has no CreateUserSettings concept (page-builder, its other
 *  consumer, shares nothing like it), so it can't and shouldn't clear it
 *  itself — without this wrapper, deleting the Account section via the
 *  ordinary per-section delete control left create_user_on_submit enabled
 *  and pointing at name/email/role field keys that no longer existed on the
 *  form, silently breaking account provisioning on every future submit. */
export function deleteSectionChecked(id: string) {
  const wasAccountSection = useFormBuilderStore.getState().schema.settings?.createUser?.accountSectionId === id
  useFormBuilderStore.getState().deleteSection(id)
  if (wasAccountSection) {
    updateCreateUserSettings({
      enabled: false,
      accountSectionId: undefined,
      nameFieldKey: undefined,
      emailFieldKey: undefined,
      roleFieldKey: undefined,
    })
  }
}

/** Prepends a single-field "Info" section containing a Form Reference field
 *  pointing at parentFormId/parentName. Called once, right after
 *  resetFormBuilder(), when a new form is opened via "Add Dependent Form" —
 *  mirrors insertAccountSection's "inject a real, editable element onto the
 *  canvas" shape, but for the parent link instead of the create-user fields. */
export function insertParentReferenceField(parentFormId: string, parentName: string) {
  const field = createParentReferenceField(parentFormId, parentName)
  const section = createSection('Info', '1')
  section.columns[0].elements = [field]
  useFormBuilderStore.setState((s) => ({
    schema: { ...s.schema, sections: [section, ...s.schema.sections] },
  }))
  // Also record parentFormId on the meta store itself — not just embedded on
  // the injected field — so the canvas/config panel can recognize this
  // specific element as the guarded parent link (see FormMetaState.parentFormId's
  // doc comment) the same way an existing form loaded via loadForm() does.
  useFormMetaStore.setState({ parentFormId, isDirty: true })
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
  /** The parent form this one is a dependent/child of ("Add Dependent Form"),
   *  or undefined for a form with no such relationship. Loaded read-only from
   *  FormDefinition.parent_form_id — the builder never writes this itself
   *  (AddDependentFormDialog/unlinkDependentForm own that via their own API
   *  calls). Exists here purely so the canvas/config panel can recognize
   *  which Form Reference element is the auto-injected parent link (see
   *  isParentLinkElement in factory.ts) and guard it against being deleted
   *  or repointed — before this field existed, that element was
   *  indistinguishable from any ordinary reference field, so deleting it and
   *  saving would silently strip the reference value from every existing
   *  record (the column backing it gets dropped/recreated) while
   *  parent_form_id itself was left dangling, pointing at a relationship the
   *  form no longer actually carries data for. */
  parentFormId?: string

  setName: (name: string) => void
  setSlug: (slug: string) => void
  setDescription: (d: string) => void
  loadForm: (args: { id: string | null; name: string; slug: string; description: string; parentFormId?: string }) => void
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
  parentFormId: undefined,

  setName: (name) => set({ name, isDirty: true }),
  setSlug: (slug) => set({ slug, isDirty: true }),
  setDescription: (description) => set({ description, isDirty: true }),

  loadForm: ({ id, name, slug, description, parentFormId }) =>
    set({ formId: id, name, slug, description, parentFormId, isDirty: false }),

  reset: () =>
    set({ formId: null, name: 'Untitled Form', slug: '', description: '', parentFormId: undefined, isDirty: false }),

  markSaved: () => set({ isDirty: false }),
  markDirty: () => set({ isDirty: true }),
}))

/** Hydrates both stores together — the tree's schema and the form's
 *  metadata are two different stores now, but callers load them as one
 *  unit (mirrors the pre-split `loadForm` call shape). The two `set()`
 *  calls land in the same synchronous tick, so React 19's automatic
 *  batching flushes them in one render — no frame observes metadata
 *  cleared but the schema not yet loaded, or vice versa. */
export function loadForm(args: { id: string | null; name: string; slug: string; description: string; parentFormId?: string; schema: FormSchema }) {
  useFormMetaStore.getState().loadForm(args)
  useFormBuilderStore.getState().loadSchema(args.schema)
}

/** Resets both stores together (mirrors the pre-split `reset` call shape). */
export function resetFormBuilder() {
  useFormMetaStore.getState().reset()
  useFormBuilderStore.getState().reset()
}
