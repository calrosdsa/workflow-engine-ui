// RF-401's create-from-template picker, plus RF-402's form-mapping step
// (scoped to forms only — see template-mapping.ts's own doc comment for
// why field-level mapping is deferred). Modeled on MenusSection.tsx's
// MenuTypePickerDialog: a card grid in a Dialog, picking IS creating,
// except a template with at least one form_id placeholder detours through
// a second step first, since creating straight from it would silently
// leave every data-backed block pointing at a form that doesn't exist.
import { useState } from 'react'
import { AlertCircle, FileText, Sparkles } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { FormReferenceSelect } from '@/features/form-builder/config/FormReferenceSelect'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { useCreateReport, useReportExamples } from './hooks'
import { applyFormMapping, findFormPlaceholders, type FormPlaceholder } from './template-mapping'
import { emptyReportDefinition } from './types'
import type { ReportDefinition, ReportExample } from './types'

export interface ReportTemplatePickerDialogProps {
  open: boolean
  onClose: () => void
  onCreated: (id: string) => void
}

type Step =
  | { kind: 'pick' }
  | { kind: 'map'; example: ReportExample; placeholders: FormPlaceholder[] }

export function ReportTemplatePickerDialog({ open, onClose, onCreated }: ReportTemplatePickerDialogProps) {
  const t = useTranslation()
  const { data: examples, isLoading } = useReportExamples()
  const createMutation = useCreateReport()
  const [step, setStep] = useState<Step>({ kind: 'pick' })
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const busy = createMutation.isPending

  const reset = () => {
    setStep({ kind: 'pick' })
    setMapping({})
    setError(null)
  }
  const close = () => {
    reset()
    onClose()
  }

  const createFrom = async (name: string, definition: ReportDefinition) => {
    setError(null)
    try {
      const row = await createMutation.mutateAsync({ name, definition })
      reset()
      onCreated(row.id)
    } catch {
      setError(t('reports.section.template_picker.create_error'))
    }
  }

  const pickBlank = () => {
    // Not translated: this is the persisted row.name/definition.name saved
    // to the database, not display-time UI chrome — same exclusion class
    // as ReportsSection's own pre-existing 'Untitled Report' literal.
    void createFrom('Untitled Report', emptyReportDefinition('Untitled Report'))
  }

  const pickExample = (example: ReportExample) => {
    const placeholders = findFormPlaceholders(example.definition)
    if (placeholders.length === 0) {
      void createFrom(example.definition.name, example.definition)
      return
    }
    setStep({ kind: 'map', example, placeholders })
    setMapping({})
  }

  const confirmMapping = () => {
    if (step.kind !== 'map') return
    void createFrom(step.example.definition.name, applyFormMapping(step.example.definition, mapping))
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="w-full max-w-lg">
        {step.kind === 'pick' ? (
          <>
            <DialogHeader>
              <DialogTitle>{t('reports.section.template_picker.dialog_title')}</DialogTitle>
              <DialogDescription>{t('reports.section.template_picker.dialog_description')}</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-2 p-1">
              <button
                type="button"
                onClick={pickBlank}
                disabled={busy}
                className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] p-3 text-left transition-colors hover:border-[hsl(var(--primary))]/40 hover:bg-[hsl(var(--primary))]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] disabled:opacity-50"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                  <Sparkles size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[hsl(var(--foreground))]">{t('reports.section.template_picker.blank_label')}</p>
                  <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">{t('reports.section.template_picker.blank_description')}</p>
                </div>
              </button>

              {isLoading && (
                <p className="px-1 py-2 text-xs text-[hsl(var(--muted-foreground))]">{t('reports.section.template_picker.loading')}</p>
              )}

              {/* example.definition.name/intent are backend/persisted
                  content (examples.go), not UI chrome — not run through
                  t(), same exclusion class MenuTypePickerDialog's
                  entry.label already is. */}
              {(examples ?? []).map((example, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => pickExample(example)}
                  disabled={busy}
                  className="flex items-start gap-3 rounded-lg border border-[hsl(var(--border))] p-3 text-left transition-colors hover:border-[hsl(var(--primary))]/40 hover:bg-[hsl(var(--primary))]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] disabled:opacity-50"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                    <FileText size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[hsl(var(--foreground))]">{example.definition.name}</p>
                    {/* line-clamp-2, not truncate: intent is a full sentence
                        by design (examples.go), so a single-line clamp would
                        cut it mid-word on every card, not just a rare long
                        one. */}
                    <p className="line-clamp-2 text-xs text-[hsl(var(--muted-foreground))]">{example.intent}</p>
                  </div>
                </button>
              ))}

              {error && (
                <p className="flex items-center gap-1.5 text-xs text-[hsl(var(--destructive))]"><AlertCircle size={12} />{error}</p>
              )}
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{step.example.definition.name}</DialogTitle>
              <DialogDescription>{t('reports.section.template_picker.map_description')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 p-1">
              {/* step.example.note: backend/persisted content, not
                  translated — see the picker step's own comment above. */}
              <p className="text-xs text-[hsl(var(--muted-foreground))]">{step.example.note}</p>
              {step.placeholders.map((placeholder) => (
                <div key={placeholder.value} className="space-y-1.5">
                  <Label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
                    {t('reports.section.template_picker.form_for', { labels: placeholder.usedBy.join(', ') })}
                  </Label>
                  <FormReferenceSelect
                    value={mapping[placeholder.value]}
                    onChange={(formId) => setMapping((prev) => ({ ...prev, [placeholder.value]: formId ?? '' }))}
                  />
                </div>
              ))}
              {error && (
                <p className="flex items-center gap-1.5 text-xs text-[hsl(var(--destructive))]"><AlertCircle size={12} />{error}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStep({ kind: 'pick' })} disabled={busy}>
                {t('common.back')}
              </Button>
              <Button
                type="button"
                onClick={confirmMapping}
                disabled={busy || step.placeholders.some((p) => !mapping[p.value])}
              >
                {busy ? <Spinner className="h-4 w-4" /> : null}
                {t('reports.section.template_picker.create')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
