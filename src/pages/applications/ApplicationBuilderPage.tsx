import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Settings2, Palette, ListTree, KeyRound, Rocket, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useApplication, usePublishApplication } from '@/features/applications/hooks'
import { usePermission } from '@/features/auth/permissions'
import { GeneralSettingsSection } from './sections/GeneralSettingsSection'
import { ThemeSection } from './sections/ThemeSection'
import { MenusSection } from './sections/MenusSection'
import { GlobalSettingsSection } from './sections/GlobalSettingsSection'
import type { ValidationIssue } from '@/features/applications/types'

type SectionId = 'general' | 'theme' | 'menus' | 'settings'

const SECTIONS: { id: SectionId; label: string; icon: typeof Settings2 }[] = [
  { id: 'general', label: 'General', icon: Settings2 },
  { id: 'theme', label: 'Theme', icon: Palette },
  { id: 'menus', label: 'Menus', icon: ListTree },
  { id: 'settings', label: 'Global Settings', icon: KeyRound },
]

export function ApplicationBuilderPage() {
  const navigate = useNavigate()
  const { data: app, isLoading } = useApplication()
  const publishMutation = usePublishApplication()
  const canPublish = usePermission('application:publish')

  const [section, setSection] = useState<SectionId>('general')
  const [publishIssues, setPublishIssues] = useState<ValidationIssue[] | null>(null)
  const [publishError, setPublishError] = useState<string | null>(null)

  if (isLoading) return <div className="flex h-64 items-center justify-center"><Spinner /></div>
  if (!app) return null

  const handlePublish = async () => {
    setPublishIssues(null)
    setPublishError(null)
    try {
      await publishMutation.mutateAsync()
      // The runtime lives in a separate Vite bundle (runtime.html) reachable
      // only by a real navigation, not the builder's TanStack router — same
      // reason RuntimeLink.tsx exists. Its index route auto-resolves to
      // default_menu_slug (or the first menu), so linking to the bare
      // /{clientId}/{appId} root is enough.
      window.location.href = `/${app.client_id}/${app.id}`
    } catch (e) {
      const { issues, message } = await extractPublishError(e)
      if (issues) setPublishIssues(issues)
      else setPublishError(message ?? 'Publishing failed. Please try again.')
    }
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-white px-4">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: '/applications' })}>
          <ArrowLeft size={16} />
        </Button>
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
            <ListTree size={14} />
          </div>
          <span className="max-w-[160px] truncate text-sm font-semibold text-slate-800" title={app.name}>{app.name}</span>
        </div>

        <nav className="ml-4 flex items-center gap-1">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                section === id ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {app.published_version != null && (
            <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-600">
              Live v{app.published_version}
            </span>
          )}
          {canPublish && (
            <Button
              size="sm"
              onClick={handlePublish}
              disabled={publishMutation.isPending}
              className="gap-1.5 bg-indigo-600 text-white hover:bg-indigo-700"
            >
              {publishMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
              Launch Application
            </Button>
          )}
        </div>
      </header>

      {publishIssues && publishIssues.length > 0 && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-700">
          <div className="mb-1 flex items-center gap-2 font-medium">
            <AlertCircle size={14} className="shrink-0" />
            Application cannot be published — fix these issues first:
          </div>
          <ul className="ml-6 list-disc space-y-0.5">
            {publishIssues.map((issue, i) => (
              <li key={i}><span className="font-mono text-[11px] text-red-500">{issue.path}</span> — {issue.message}</li>
            ))}
          </ul>
        </div>
      )}

      {publishError && (
        <div className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-3 text-[12px] font-medium text-red-700">
          <AlertCircle size={14} className="shrink-0" />
          {publishError}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {section === 'general' && <GeneralSettingsSection app={app} />}
        {section === 'theme' && <ThemeSection />}
        {section === 'menus' && <MenusSection appId={app.id} />}
        {section === 'settings' && <GlobalSettingsSection />}
      </div>
    </div>
  )
}

// Publish fails in two distinct shapes: a 422 with {issues: ValidationIssue[]}
// (pre-publish validation, e.g. a menu with no form selected), or any other
// error status with the generic respond.Error shape {error: string} (e.g. the
// 500 "publishing is not configured" when the Publisher isn't wired up, or a
// network failure). Both must surface something to the user — silently
// falling through to "no issues, no message" is what made a failed publish
// look like the button did nothing.
async function extractPublishError(e: unknown): Promise<{ issues: ValidationIssue[] | null; message: string | null }> {
  const err = e as { response?: Response; message?: string }
  if (!err.response) return { issues: null, message: err.message ?? null }
  try {
    const body = await err.response.json() as { issues?: ValidationIssue[]; error?: string }
    if (body.issues && body.issues.length > 0) return { issues: body.issues, message: null }
    return { issues: null, message: body.error ?? null }
  } catch {
    return { issues: null, message: err.message ?? null }
  }
}
