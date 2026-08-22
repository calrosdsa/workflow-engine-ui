export interface UpdateFieldActionConfig {
  fieldKey: string
  valueMode: 'static' | 'expression'
  staticValue?: unknown
  expressionValue?: string
}

export function emptyUpdateFieldActionConfig(): UpdateFieldActionConfig {
  return { fieldKey: '', valueMode: 'static', staticValue: '' }
}

/** Defensive parse — mirrors DetailTabDefinition.parseConfig's "never throw,
 *  heal a malformed/stale blob" contract. A missing/wrong-shaped field falls
 *  back to the empty default's value rather than propagating `undefined`
 *  into the menu item / config panel. */
export function parseUpdateFieldActionConfig(raw: unknown): UpdateFieldActionConfig {
  const empty = emptyUpdateFieldActionConfig()
  if (!raw || typeof raw !== 'object') return empty
  const r = raw as Record<string, unknown>
  return {
    fieldKey: typeof r.fieldKey === 'string' ? r.fieldKey : empty.fieldKey,
    valueMode: r.valueMode === 'expression' ? 'expression' : 'static',
    staticValue: 'staticValue' in r ? r.staticValue : empty.staticValue,
    expressionValue: typeof r.expressionValue === 'string' ? r.expressionValue : undefined,
  }
}
