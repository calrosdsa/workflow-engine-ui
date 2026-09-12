import { describe, expect, it } from 'vitest'
import {
  DEFAULT_NODE_EXECUTION_SETTINGS,
  nodeMetadataWithWorkbench,
  readNodeWorkbench,
  redactSensitiveData,
  selectWorkbenchOutput,
  isConfigurationStale,
  validateNodeExecutionSettings,
  validateSchemaConfiguration,
} from './configuration-workbench'

describe('node configuration workbench contract', () => {
  it('keeps workbench settings in UI metadata without changing node configuration', () => {
    const metadata = nodeMetadataWithWorkbench(
      { description: 'Existing description', extra: { integration: 'crm' } },
      { settings: { disabled: true, notes: 'Pause while the API is down' } },
    )

    expect(metadata).toMatchObject({
      description: 'Existing description',
      extra: {
        integration: 'crm',
        configuration_workbench: {
          settings: { disabled: true, notes: 'Pause while the API is down' },
        },
      },
    })
    expect(readNodeWorkbench({ metadata }).settings).toMatchObject({
      ...DEFAULT_NODE_EXECUTION_SETTINGS,
      disabled: true,
      notes: 'Pause while the API is down',
    })
  })

  it('reports settings and connector fields at the field that needs attention', () => {
    expect(validateNodeExecutionSettings({ ...DEFAULT_NODE_EXECUTION_SETTINGS, retry: { maxAttempts: 12, delayMs: -1 } })).toEqual([
      { path: 'settings.retry.maxAttempts', message: 'Use between 0 and 10 attempts' },
      { path: 'settings.retry.delayMs', message: 'Delay cannot be negative' },
    ])

    expect(validateSchemaConfiguration(
      {
        type: 'object',
        required: ['endpoint'],
        properties: {
          endpoint: { type: 'string', minLength: 8, pattern: '^https://' },
          retries: { type: 'integer', minimum: 0, maximum: 3 },
        },
      },
      { endpoint: 'http:/', retries: 4 },
    )).toEqual([
      { path: 'parameters.endpoint', message: 'Use at least 8 characters' },
      { path: 'parameters.endpoint', message: 'Use the required format' },
      { path: 'parameters.retries', message: 'Use 3 or less' },
    ])
  })

  it('redacts secrets recursively before showing or copying data', () => {
    expect(redactSensitiveData({
      authorization: 'Bearer secret-value',
      profile: { api_key: 'abc', name: 'Ada' },
      rows: [{ cookie: 'session=abc', ok: true }],
    })).toEqual({
      authorization: '[REDACTED]',
      profile: { api_key: '[REDACTED]', name: 'Ada' },
      rows: [{ cookie: '[REDACTED]', ok: true }],
    })
  })

  it('does not redact the CORS access-control-allow-credentials header, which is always a plain boolean', () => {
    expect(redactSensitiveData({
      'access-control-allow-credentials': 'true',
      authorization: 'Bearer secret-value',
    })).toEqual({
      'access-control-allow-credentials': 'true',
      authorization: '[REDACTED]',
    })
  })

  it('keeps pinned and mock data ahead of stale captured output', () => {
    expect(selectWorkbenchOutput({
      pinnedOutput: { id: 'pinned' }, mockOutput: { id: 'mock' }, runOutput: { id: 'live' }, runSource: 'live',
    })).toEqual({ value: { id: 'pinned' }, source: 'pinned' })
    expect(selectWorkbenchOutput({ mockOutput: { id: 'mock' }, runOutput: { id: 'live' }, runSource: 'live' })).toEqual({ value: { id: 'mock' }, source: 'mock' })
    expect(isConfigurationStale('{"url":"before"}', { url: 'after' })).toBe(true)
    expect(isConfigurationStale('{"url":"same"}', { url: 'same' })).toBe(false)
  })
})
