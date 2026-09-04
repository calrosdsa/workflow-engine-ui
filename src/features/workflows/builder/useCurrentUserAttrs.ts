// What "current user's…" may name — the app's single user-account form
// (create_user_on_submit), discovered live, degrading gracefully to just the
// built-ins (record_id/user_id/email) when the app has none or more than one
// (the server fails closed on that ambiguity too, so a custom attribute
// could never resolve there either — see internal/viewer's package doc).
//
// Shared by every current_user-capable FilterBuilder host: form-builder's
// ReferenceFilterSection (which also offers this_record, form-scoped), and
// every viewer-scoped-but-no-single-record surface — menu default_filter,
// dashboard table/chart widget filters, saved-view filters — which offer
// current_user only (there is no enclosing record for this_record to hop
// through outside a form's own field config).
import { useMemo } from 'react'
import { useForm as useFormDef, useForms } from '@/features/forms/hooks'
import type { ViewerFilterContext } from './FilterBuilder'

export function useCurrentUserAttrs(): Pick<ViewerFilterContext, 'currentUserAttrs' | 'currentUserHint'> {
  const { data: allForms } = useForms()
  const accountForms = useMemo(() => (allForms ?? []).filter((f) => f.create_user_on_submit), [allForms])
  const accountForm = accountForms.length === 1 ? accountForms[0] : undefined
  const { data: accountDef } = useFormDef(accountForm?.id ?? '')

  return useMemo(() => {
    const currentUserAttrs = [
      // record_id compares against the viewer's account RECORD id — the
      // value reference/parent fields actually store — never the login
      // user id. "Assigned To = current user" means exactly this one.
      { value: 'record_id', label: accountForm ? `Their ${accountForm.name} record` : 'Their account record' },
      { value: 'user_id', label: 'Their user id' },
      { value: 'email', label: 'Their email' },
      ...(accountDef?.fields ?? [])
        .filter((f) => f.type !== 'line_item_count' && f.type !== 'line_item_adopted' && f.type !== 'parent_link')
        .map((f) => ({ value: f.name, label: `Their ${f.label || f.name}` })),
    ]

    let currentUserHint: string
    if (accountForms.length === 0) {
      currentUserHint =
        'No form in this app creates user accounts yet, so only user id and email can resolve — turn on "create a user with each enrollment" on a form to filter by its fields.'
    } else if (accountForms.length > 1) {
      currentUserHint =
        'Several forms create user accounts, so the server cannot tell which record is the viewer\'s — only user id and email will resolve until a single form creates users.'
    } else {
      currentUserHint = `Attributes come from the viewer's "${accountForm!.name}" record, matched by email. A viewer with no matching record sees no results (fail closed).`
    }

    return { currentUserAttrs, currentUserHint }
  }, [accountForm, accountForms.length, accountDef])
}
