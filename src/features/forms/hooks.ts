import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formsApi } from './api'
import { unlinkDependentForm } from './unlinkDependentForm'
import type { CreateFormPayload, UpdateFormPayload, FormRecord, FormDefinition, FormVisibility } from './types'

export const formKeys = {
  all:     ['forms'] as const,
  detail:  (id: string) => ['forms', id] as const,
  records: (id: string) => ['forms', id, 'records'] as const,
  record:  (fid: string, rid: string) => ['forms', fid, 'records', rid] as const,
  sharing: (id: string) => ['forms', id, 'sharing'] as const,
  linkable: ['forms', 'linkable'] as const,
}

export function useForms() {
  return useQuery({ queryKey: formKeys.all, queryFn: formsApi.list })
}

export function useForm(id: string) {
  return useQuery({ queryKey: formKeys.detail(id), queryFn: () => formsApi.get(id), enabled: !!id })
}

export function useCreateForm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: CreateFormPayload) => formsApi.create(p),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: formKeys.all })
      // A new form adds View/Create/Edit/Delete entries to the per-form
      // permission catalog (see features/permissions/hooks.ts).
      qc.invalidateQueries({ queryKey: ['permissions'] })
    },
  })
}

export function useUpdateForm(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: UpdateFormPayload) => formsApi.update(id, p),
    // Optimistically reflect name/slug/description renames immediately so the
    // header and list update without waiting for a refetch.
    onMutate: async (p: UpdateFormPayload) => {
      await qc.cancelQueries({ queryKey: formKeys.detail(id) })
      const prev = qc.getQueryData<FormDefinition>(formKeys.detail(id))
      if (prev) {
        qc.setQueryData<FormDefinition>(formKeys.detail(id), {
          ...prev, name: p.name, slug: p.slug, description: p.description,
        })
      }
      return { prev }
    },
    onError: (_e, _p, ctx) => {
      if (ctx?.prev) qc.setQueryData(formKeys.detail(id), ctx.prev)
    },
    onSettled:  () => {
      qc.invalidateQueries({ queryKey: formKeys.all })
      qc.invalidateQueries({ queryKey: formKeys.detail(id) })
      // The form's name may have changed, and the per-form catalog's labels
      // ("Items: View records") are derived from it.
      qc.invalidateQueries({ queryKey: ['permissions'] })
    },
  })
}

export function useDeleteForm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => formsApi.delete(id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: formKeys.all })
      qc.invalidateQueries({ queryKey: ['permissions'] })
    },
  })
}

/** "Copy Form" — duplicates a form (fresh id/table/columns, "-copy" slug)
 *  under the same parent. */
export function useCopyForm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => formsApi.copy(id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: formKeys.all })
      qc.invalidateQueries({ queryKey: ['permissions'] })
    },
  })
}

/** "Unlink Dependent Form" — detaches a form from its parent without deleting
 *  it, and removes the auto-injected Form Reference field that pointed back
 *  at that parent (see unlinkDependentForm) so the child isn't left with a
 *  dangling required field for a relationship the tree no longer shows. */
export function useUnlinkForm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => unlinkDependentForm(id),
    onSuccess:  (_result, id) => {
      qc.invalidateQueries({ queryKey: formKeys.all })
      qc.invalidateQueries({ queryKey: formKeys.detail(id) })
      qc.invalidateQueries({ queryKey: ['permissions'] })
    },
  })
}

// FR-C1-013: Share Settings. useSharing 404s (via the query's own error
// state) for a form this app doesn't own — the Share Settings dialog only
// opens when that's not the case, so a real 404 here is unexpected rather
// than a normal "not the owner" path.
// enabled additionally requires the caller to opt in (ShareSettingsDialog
// passes `open`) — ShareSettingsDialog mounts once per form row up front
// (so the "..." menu can open it instantly), and without this, every form
// on the page would eagerly fetch its sharing state on every Forms list
// visit, not just the one row whose dialog is actually opened.
export function useSharing(formId: string, enabled = true) {
  return useQuery({ queryKey: formKeys.sharing(formId), queryFn: () => formsApi.getSharing(formId), enabled: !!formId && enabled })
}

// Not a useQuery — the usage check only ever runs on-demand, right before a
// narrowing sharing change, never passively when the dialog opens.
export function useSharingUsage(formId: string) {
  return useMutation({ mutationFn: () => formsApi.getSharingUsage(formId) })
}

export function useSetSharing(formId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (visibility: FormVisibility) => formsApi.setSharing(formId, visibility),
    onSuccess: () => qc.invalidateQueries({ queryKey: formKeys.sharing(formId) }),
  })
}

// --- cross-app links (see api/forms/links.go) --------------------------------

/** Forms other apps under this client have shared and this app hasn't
 *  linked. `enabled` lets the picker fetch only while it's open, matching
 *  useSharing's own opt-in — this list is a snapshot of another app's
 *  choices and goes stale the moment they change it, so there's no value in
 *  holding it warm. */
export function useLinkableForms(enabled = true) {
  return useQuery({
    queryKey: formKeys.linkable,
    queryFn: formsApi.listLinkable,
    enabled,
    // Always refetch on open: a form listed here can be un-shared between
    // one open and the next, and linking a stale row 409s.
    staleTime: 0,
  })
}

export function useLinkSharedForm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => formsApi.link(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: formKeys.all })
      qc.invalidateQueries({ queryKey: formKeys.linkable })
      // A linked form adds its View/Create/Edit/Delete entries to this app's
      // per-form permission catalog exactly like an owned one does.
      qc.invalidateQueries({ queryKey: ['permissions'] })
    },
  })
}

/** "Remove from this app" — drops the link only. Deliberately NOT named
 *  unlink in the UI: this app's existing "Unlink Dependent Form" action
 *  means something entirely different (detach a child from its parent), and
 *  the two sit on the same menu. */
export function useUnlinkSharedForm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => formsApi.unlinkShared(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: formKeys.all })
      qc.invalidateQueries({ queryKey: formKeys.linkable })
      qc.invalidateQueries({ queryKey: ['permissions'] })
    },
  })
}

export function useFormRecords(formId: string) {
  return useQuery({
    queryKey: formKeys.records(formId),
    queryFn:  () => formsApi.listRecords(formId),
  })
}

export function useCreateRecord(formId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: FormRecord) => formsApi.createRecord(formId, data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: formKeys.records(formId) }),
  })
}

export function useUpdateRecord(formId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ recordId, data }: { recordId: string; data: FormRecord }) => formsApi.updateRecord(formId, recordId, data),
    // Invalidates the whole ['forms', formId, ...] prefix — React Query's
    // default partial matching catches both the plain records list and every
    // parameterized Search menu query (['forms', formId, 'search', filter,
    // sort, page, pageSize]), not just formKeys.records(formId) itself.
    onSuccess: (_result, { recordId }) => {
      qc.invalidateQueries({ queryKey: formKeys.detail(formId) })
      qc.invalidateQueries({ queryKey: formKeys.record(formId, recordId) })
    },
  })
}

export function useDeleteRecord(formId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (recordId: string) => formsApi.deleteRecord(formId, recordId),
    onSuccess:  () => qc.invalidateQueries({ queryKey: formKeys.detail(formId) }),
  })
}
