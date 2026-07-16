export interface PermissionDef {
  resource: string
  action: string
  key: string
  label: string
  /** Set only for dynamic per-form entries (key "forms:{form_id}:{action}")
   *  — absent for every entry in the static catalog. */
  form_id?: string
}
