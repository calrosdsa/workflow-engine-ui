import { describe, expect, it } from 'vitest'
import { selectableModels } from './model-filter'
import type { ProviderModelWithInstance } from './types'

const model = (overrides: Partial<ProviderModelWithInstance>): ProviderModelWithInstance => ({
  id: 'model-id',
  instance_id: 'instance-id',
  instance_name: 'Voyage primary',
  provider_type: 'voyage',
  model: 'voyage-4',
  capability: 'embedding',
  embedding_dim: 1024,
  enabled: true,
  ...overrides,
})

describe('selectableModels', () => {
  it('offers every enabled instance of the KB’s exact embedding profile and excludes incompatible entries', () => {
    const models = selectableModels(
      [
        model({ id: 'voyage-primary', instance_name: 'Voyage primary' }),
        model({ id: 'voyage-failover', instance_name: 'Voyage failover' }),
        model({ id: 'different-model', model: 'voyage-4-lite' }),
        model({ id: 'different-dimension', embedding_dim: 512 }),
        model({ id: 'disabled', enabled: false }),
        model({ id: 'llm', capability: 'llm', embedding_dim: undefined }),
      ],
      'embedding',
      (candidate) => candidate.model === 'voyage-4' && candidate.embedding_dim === 1024,
    )

    expect(models.map((candidate) => candidate.id)).toEqual(['voyage-primary', 'voyage-failover'])
  })
})
