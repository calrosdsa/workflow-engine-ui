import type { Capability, ProviderModelWithInstance } from './types'

// A selected model must be both enabled for its instance and accepted by the
// caller's compatibility policy. This is intentionally outside ModelPicker so
// it can be tested without making the React component export a utility.
export function selectableModels(
  allModels: ProviderModelWithInstance[] | undefined,
  capability: Capability,
  isOptionAllowed?: (model: ProviderModelWithInstance) => boolean,
): ProviderModelWithInstance[] {
  return (allModels ?? []).filter((model) =>
    model.capability === capability && model.enabled && (!isOptionAllowed || isOptionAllowed(model)),
  )
}
