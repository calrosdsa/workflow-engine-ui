import { describe, expect, it } from 'vitest'
import {
  effectiveArgumentMode,
  parseExportReportActionConfig,
  partitionArguments,
  supportsCurrentRecord,
  type ExportReportActionConfig,
} from './schema'
import type { ReportArgument } from '@/features/reports/types'

const THIS_FORM = 'form-invoices'

const invoiceRef: ReportArgument = { key: 'invoice', label: 'Invoice', type: 'reference', form_id: THIS_FORM }
const customerRef: ReportArgument = { key: 'customer', label: 'Customer', type: 'reference', form_id: 'form-customers' }
const date: ReportArgument = { key: 'date', label: 'Date', type: 'date' }

describe('supportsCurrentRecord', () => {
  it('accepts a reference argument targeting this very form', () => {
    expect(supportsCurrentRecord(invoiceRef, THIS_FORM)).toBe(true)
  })

  it('rejects a reference to a different form', () => {
    // Passing this form's record id into a filter on another form would
    // return zero rows and look like missing data, not misconfiguration.
    expect(supportsCurrentRecord(customerRef, THIS_FORM)).toBe(false)
  })

  it('rejects a non-reference argument', () => {
    // A date cannot be "the current record".
    expect(supportsCurrentRecord(date, THIS_FORM)).toBe(false)
  })
})

describe('effectiveArgumentMode', () => {
  it('defaults to prompt when nothing is stored', () => {
    expect(effectiveArgumentMode(invoiceRef, { reportDefinitionId: 'r', format: '' }, THIS_FORM)).toBe('prompt')
  })

  it('honours a valid stored current_record', () => {
    const config: ExportReportActionConfig = {
      reportDefinitionId: 'r', format: '', argumentModes: { invoice: 'current_record' },
    }
    expect(effectiveArgumentMode(invoiceRef, config, THIS_FORM)).toBe('current_record')
  })

  it('degrades a now-invalid current_record back to prompt', () => {
    // The report's argument changed type after the action was configured;
    // asking is always safe, sending a bad value is not.
    const config: ExportReportActionConfig = {
      reportDefinitionId: 'r', format: '', argumentModes: { date: 'current_record' },
    }
    expect(effectiveArgumentMode(date, config, THIS_FORM)).toBe('prompt')
  })
})

describe('partitionArguments', () => {
  it('fills current_record arguments and prompts for the rest', () => {
    const config: ExportReportActionConfig = {
      reportDefinitionId: 'r', format: '', argumentModes: { invoice: 'current_record' },
    }
    const { resolved, toPrompt } = partitionArguments([invoiceRef, date], config, THIS_FORM, 'rec-42')

    expect(resolved).toEqual({ invoice: 'rec-42' })
    expect(toPrompt.map((a) => a.key)).toEqual(['date'])
  })

  it('leaves nothing to prompt when every argument is current_record', () => {
    // This is the intended ideal flow: exporting from an invoice stays one
    // click, exactly as it behaved before arguments existed.
    const config: ExportReportActionConfig = {
      reportDefinitionId: 'r', format: '', argumentModes: { invoice: 'current_record' },
    }
    const { toPrompt } = partitionArguments([invoiceRef], config, THIS_FORM, 'rec-42')
    expect(toPrompt).toEqual([])
  })
})

describe('parseExportReportActionConfig', () => {
  it('heals a malformed blob and drops unknown modes', () => {
    const parsed = parseExportReportActionConfig({
      reportDefinitionId: 'r',
      format: 'csv',
      argumentModes: { a: 'current_record', b: 'prompt', c: 'nonsense', d: 42 },
    })
    expect(parsed.argumentModes).toEqual({ a: 'current_record', b: 'prompt' })
  })

  it('returns an empty config for junk input', () => {
    expect(parseExportReportActionConfig(null)).toEqual({ reportDefinitionId: '', format: '', argumentModes: undefined })
  })
})

// --- skip mode (FR-D2-019 RUN-06, added after a live finding) ---

describe('skip mode', () => {
  const optionalNote: ReportArgument = { key: 'note', label: 'Note', type: 'text' }
  const requiredNote: ReportArgument = { key: 'note', label: 'Note', type: 'text', required: true }

  it('omits a skipped argument from BOTH resolved and toPrompt', () => {
    const config: ExportReportActionConfig = {
      reportDefinitionId: 'r1', format: '', argumentModes: { note: 'skip' },
    }
    const { resolved, toPrompt } = partitionArguments([optionalNote], config, 'form-1', 'rec-1')
    // Not prompted, and NOT sent as an empty value — the engine omits an
    // unsupplied optional argument's filter, whereas an empty value would
    // match nothing.
    expect(toPrompt).toEqual([])
    expect(resolved).not.toHaveProperty('note')
  })

  it('degrades a stored skip to prompt once the argument becomes required', () => {
    const config: ExportReportActionConfig = {
      reportDefinitionId: 'r1', format: '', argumentModes: { note: 'skip' },
    }
    expect(effectiveArgumentMode(requiredNote, config, 'form-1')).toBe('prompt')
    const { toPrompt } = partitionArguments([requiredNote], config, 'form-1', 'rec-1')
    expect(toPrompt).toEqual([requiredNote])
  })

  it('still defaults an unconfigured argument to prompt', () => {
    const config: ExportReportActionConfig = { reportDefinitionId: 'r1', format: '' }
    expect(effectiveArgumentMode(optionalNote, config, 'form-1')).toBe('prompt')
  })

  it('round-trips skip through the defensive parser', () => {
    const parsed = parseExportReportActionConfig({
      reportDefinitionId: 'r1', format: 'csv', argumentModes: { note: 'skip', other: 'nonsense' },
    })
    expect(parsed.argumentModes).toEqual({ note: 'skip' })
  })
})
