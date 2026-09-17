// FR-J1-001's own "Preview" button — generates the CURRENT (possibly
// unsaved/dirty) canvas state against real data via api/reports/handler.go's
// Preview route, and shows the result ON SCREEN (ReportPreviewPanel, docked
// below the canvas as of RF-303 — this button no longer renders that panel
// itself, it only triggers it via onPreview so the panel can stay mounted
// across the button's own re-renders).
//
// It used to immediately download the file instead, per FR-D2-019 RUN-05's
// "no on-screen viewer" decision. That decision is reversed: a preview you
// have to open in another application to look at is not a preview, and it
// gave an author no way to check the generated file against the layout they
// had just built. Downloading is still one click, from inside the panel.
//
// No content_objects row is written server-side (Preview streams the file
// directly, never calls content.Store.Put), so there is still no persisted
// artifact — the panel holds the only copy until it is downloaded.
import { useState } from 'react'
import { Eye } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { declaredArguments, needsPrompt } from './arguments'
import { ReportArgumentsDialog } from './ReportArgumentsDialog'
import { hasRenderableContent } from './run-report'
import { useReportStore } from './store'

export interface PreviewButtonProps {
  /** Flushes the live Univer canvas into report state before Preview reads
   *  it — the SAME synchronizeWorkbookBeforeDefinitionChange every sibling
   *  editor surface (ReportSettingsPanel, UniverWorkbookSurface,
   *  WorkbookRegionsPanel) already receives under this name, wired here for
   *  the same reason: a raw cell edit sets workbookNeedsSyncRef but does not
   *  itself update the store, so without this Preview could render
   *  everything EXCEPT whatever was just typed into the grid — the one
   *  render path that is supposed to be byte-truthful, fed stale input.
   *  Preview is a read, not a mutation, but the hazard is identical. */
  onBeforeChange?: () => void
  /** Called once content/argument gating has passed — expands the docked
   *  ReportPreviewPanel and starts a fresh generation there (typically
   *  wired to that panel's own imperative `open()` handle). */
  onPreview: (argumentValues?: Record<string, unknown>) => void
}

export function PreviewButton({ onBeforeChange, onPreview }: PreviewButtonProps) {
  const definition = useReportStore((s) => s.definition)
  const [promptOpen, setPromptOpen] = useState(false)
  const argumentList = declaredArguments(definition)

  const openPreview = (values?: Record<string, unknown>) => {
    setPromptOpen(false)
    onPreview(values)
  }

  const handlePreview = () => {
    // Flush BEFORE gating on content/arguments, and re-read the store
    // imperatively rather than trusting the `definition`/`argumentList`
    // already closed over from this render — those were computed before
    // the flush and Zustand's own update from onBeforeChange() has not
    // reached this synchronous function call yet, only the NEXT render
    // (mirrors ReportBuilderPage.handleSave's own post-mutation
    // useReportStore.getState() read, same reason). JSX below (the argument
    // dialog, ReportPreviewDialog) still reads the reactive `definition` —
    // that's fine, since the store update and setPromptOpen/setPreviewOpen
    // below land in the same React batch and it re-renders correct.
    onBeforeChange?.()
    const current = useReportStore.getState().definition
    if (!hasRenderableContent(current)) {
      toast.error('Add a block before previewing', { description: 'An empty report has nothing to render.' })
      return
    }
    // Preview calls the same engine as every other run surface, so once a
    // report declares a required argument it has to ask too rather than
    // render an unfiltered file (FR-D2-019 RUN-09). An argument with a
    // default needs no prompt — Preview stays one click whenever it can.
    if (needsPrompt(declaredArguments(current))) {
      setPromptOpen(true)
      return
    }
    openPreview()
  }

  return (
    <>
      <Button
        variant="ghost" size="sm"
        onClick={handlePreview}
        className="h-8 gap-1.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
        title="Preview this report against real data"
      >
        <Eye size={14} />
        Preview
      </Button>

      <ReportArgumentsDialog
        open={promptOpen}
        argumentList={argumentList}
        title="Preview report"
        confirmLabel="Preview"
        busy={false}
        onCancel={() => setPromptOpen(false)}
        onConfirm={(values) => openPreview(values)}
      />
    </>
  )
}
