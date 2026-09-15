// The floating chat launcher bubble (FR-D4-001) — mounted as a sibling to
// <Outlet />/<Toaster> inside runtime-router.tsx's RuntimeAppRouteComponent,
// the one Runtime component confirmed to survive every menu-to-menu
// navigation (see that route's own doc comment). Visible to any
// authenticated Runtime user when the app has at least one enabled Agent —
// no dedicated "may use this Agent" permission (FR-D4-001 v0.2's resolved
// decision).
//
// The expanded conversation view is FR-D4-002's own scope, not built here —
// this component only owns the collapsed bubble and its open/closed state.
import { useState } from 'react'
import { Bot, X } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { useTranslation } from '@/features/i18n/I18nProvider'
import { useLauncherStatus } from '@/features/agents/hooks'
import { ChatPanel } from '@/features/agent-chat/ChatPanel'

export function ChatLauncher() {
  const t = useTranslation()
  const session = useAuthStore((s) => s.session)
  const { data } = useLauncherStatus(!!session)
  const [open, setOpen] = useState(false)

  if (!session || !data?.enabled) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? t('runtime.chat_launcher.close') : t('runtime.chat_launcher.open')}
        aria-expanded={open}
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2"
      >
        {open ? <X size={22} /> : <Bot size={22} />}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t('runtime.chat_launcher.assistant_label')}
          className="fixed bottom-24 right-5 z-40 flex h-[min(600px,calc(100vh-140px))] w-[380px] max-w-[calc(100vw-40px)] flex-col overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl"
        >
          <ChatPanel />
        </div>
      )}
    </>
  )
}
