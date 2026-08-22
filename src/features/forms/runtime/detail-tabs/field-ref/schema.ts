export interface FieldRefTabConfig {
  /** The key of an existing FormElement in this form's OWN field tree
   *  (FormSchema.sections -> columns -> elements) — NOT a copy of the
   *  field, a live reference. Rendering reads the current record's value
   *  for this key via FieldValueDisplay, same as DetailsTab's own
   *  per-element rendering does. Empty string means unconfigured (no field
   *  picked yet) — the Renderer shows nothing rather than guessing. */
  fieldKey: string
}

export function emptyFieldRefConfig(): FieldRefTabConfig {
  return { fieldKey: '' }
}

export function parseFieldRefConfig(raw: unknown): FieldRefTabConfig {
  if (raw && typeof raw === 'object' && typeof (raw as Partial<FieldRefTabConfig>).fieldKey === 'string') {
    return { fieldKey: (raw as FieldRefTabConfig).fieldKey }
  }
  return emptyFieldRefConfig()
}
