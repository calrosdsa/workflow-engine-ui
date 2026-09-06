// FR-J1-001's own "Preview" button — generates the CURRENT (possibly
// unsaved/dirty) canvas state against real data via api/reports/handler.go's
// Preview route, then triggers a normal browser download of the result. No
// content_objects row is written server-side (Preview streams the file
// directly, never calls content.Store.Put), so there is no persisted
// artifact to link to afterward — the download IS the whole result, same as
// this codebase's own AppBuilder "Export" download.
import { useState } from 'react'
import { Eye } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { extractApiError } from '@/lib/api'
import { declaredArguments, needsPrompt } from './arguments'
import { ReportArgumentsDialog } from './ReportArgumentsDialog'
import { hasRenderableContent, runReportToDownload } from './run-report'
import { useReportStore } from './store'

export function PreviewButton() {
  const definition = useReportStore((s) => s.definition)
  const [pending, setPending] = useState(false)
  const [promptOpen, setPromptOpen] = useState(false)
  const argumentList = declaredArguments(definition)

  const runPreview = async (argumentValues?: Record<string, unknown>) => {
    setPending(true)
    const toastId = toast.loading('Generating preview…')
    try {
      // Format falls back to CSV when the report has none configured yet —
      // Export Formats is a separate, later authoring step, and failing a
      // preview for that reason would be a confusing dead end. A configured
      // default_format still wins. (runReportToDownload owns this rule, so
      // Preview and the report list's Run action cannot diverge.)
      const { filename, rowCount } = await runReportToDownload(definition, argumentValues)
      setPromptOpen(false)
      toast.success('Preview ready', {
        id: toastId,
        description: `${filename} · ${rowCount} row${rowCount === 1 ? '' : 's'}`,
      })
    } catch (e) {
      toast.error("Couldn't generate preview", { id: toastId, description: extractApiError(e) })
    } finally {
      setPending(false)
    }
  }

  const handlePreview = () => {
    if (pending) return
    if (!hasRenderableContent(definition)) {
      toast.error('Add a block before previewing', { description: 'An empty report has nothing to render.' })
      return
    }
    // Preview calls the same engine as every other run surface, so once a
    // report declares a required argument it has to ask too rather than
    // download an unfiltered file (FR-D2-019 RUN-09). An argument with a
    // default needs no prompt — Preview stays one click whenever it can.
    if (needsPrompt(argumentList)) {
      setPromptOpen(true)
      return
    }
    void runPreview()
  }

  return (
    <>
      <Button
        variant="ghost" size="sm"
        onClick={handlePreview}
        disabled={pending}
        className="h-8 gap-1.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
        title="Preview this report against real data"
      >
        {pending ? <Spinner className="h-3.5 w-3.5" /> : <Eye size={14} />}
        Preview
      </Button>

      <ReportArgumentsDialog
        open={promptOpen}
        argumentList={argumentList}
        title="Preview report"
        confirmLabel="Preview"
        busy={pending}
        onCancel={() => setPromptOpen(false)}
        onConfirm={(values) => void runPreview(values)}
      />
    </>
  )
}
