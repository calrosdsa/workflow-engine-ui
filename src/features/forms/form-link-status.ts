import type { FormDefinition } from './types'

export function getFormLinkStatus(form: Pick<FormDefinition, 'is_linked' | 'visibility'>) {
  const isLinked = form.is_linked === true
  return {
    isLinked,
    isReadOnly: isLinked && form.visibility === 'read_only',
  }
}
