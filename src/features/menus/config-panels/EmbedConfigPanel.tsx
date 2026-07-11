import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface EmbedConfigPanelProps {
  value: string
  onChange: (url: string) => void
}

// Small: a single URL input + a live inline iframe preview beneath it so the
// builder can immediately see whether the target site actually allows
// embedding, before publishing — same "show the real thing, don't guess"
// instinct as ThemeSection.tsx's live preview pane. No load-timeout/blocked
// detection here (that's CustomMenuRuntime.tsx's job, Phase 6) — this is
// just a best-effort visual check during editing.
export function EmbedConfigPanel({ value, onChange }: EmbedConfigPanelProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium text-slate-600">Webpage URL</Label>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://example.com"
          className="h-8 text-sm"
        />
        <p className="text-[10px] text-slate-400">
          Some sites block embedding and won't display here even with a valid URL — end users will see a
          fallback "open in a new tab" link for those.
        </p>
      </div>

      {value ? (
        <div className="overflow-hidden rounded-md border border-slate-200">
          <iframe key={value} src={value} title="Embed preview" className="h-64 w-full" />
        </div>
      ) : (
        <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 text-[11px] text-slate-400">
          Enter a URL to preview it here
        </div>
      )}
    </div>
  )
}
