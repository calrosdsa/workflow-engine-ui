// The expanded conversation view (FR-D4-002), mounted inside
// ChatLauncher.tsx's dialog in place of its former "Chat coming soon"
// placeholder. Owns session selection, message history, sending, tool-call
// confirmation, and the live Centrifugo connection.
import { useEffect, useRef, useState } from 'react'
import { Plus, Send, AlertTriangle, ChevronDown, Loader2, Check, X, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'
import { extractApiError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import {
  useChatSessions,
  useCreateChatSession,
  useChatMessages,
  useSendChatMessage,
  useConfirmChatToolCall,
} from './hooks'
import { useAgentChatSocket } from './useAgentChatSocket'
import type { ChatSession, ChatMessage, PendingConfirmation } from './types'
import { useTranslation } from '@/features/i18n/I18nProvider'

function asPendingConfirmation(message: ChatMessage): PendingConfirmation | null {
  if (!Array.isArray(message.tool_calls) || message.tool_calls.length === 0) return null
  const first = message.tool_calls[0] as PendingConfirmation
  return typeof first?.name === 'string' && typeof first?.status === 'string' ? first : null
}

function timeLabel(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function ChatPanel() {
  const t = useTranslation()
  const { data: sessions, isLoading: sessionsLoading } = useChatSessions(true)
  const createSession = useCreateChatSession()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionPickerOpen, setSessionPickerOpen] = useState(false)

  // Default to the most recently updated session on first load; never
  // silently switch the user away from a session they picked afterward.
  useEffect(() => {
    if (sessionId || !sessions || sessions.length === 0) return
    setSessionId(sessions[0].id)
  }, [sessions, sessionId])

  const { data: messages, isLoading: messagesLoading } = useChatMessages(sessionId)
  const sendMessage = useSendChatMessage(sessionId)
  const confirmToolCall = useConfirmChatToolCall(sessionId)
  const connectionStatus = useAgentChatSocket(sessionId)

  const [draft, setDraft] = useState('')
  const scrollBottomRef = useRef<HTMLDivElement>(null)
  const sendErrorText = sendMessage.error ? extractApiError(sendMessage.error) : null

  useEffect(() => {
    scrollBottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages?.length])

  const handleCreateSession = async () => {
    const sess = await createSession.mutateAsync()
    setSessionId(sess.id)
    setSessionPickerOpen(false)
  }

  const handleSend = () => {
    const content = draft.trim()
    if (!content || sendMessage.isPending) return
    setDraft('')
    sendMessage.mutate(content)
  }

  const activeSession = sessions?.find((s) => s.id === sessionId)

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <ChatHeader
        activeSession={activeSession}
        sessions={sessions ?? []}
        sessionsLoading={sessionsLoading}
        open={sessionPickerOpen}
        onOpenChange={setSessionPickerOpen}
        onSelect={(id) => {
          setSessionId(id)
          setSessionPickerOpen(false)
        }}
        onCreate={handleCreateSession}
        creating={createSession.isPending}
      />

      {connectionStatus === 'disconnected' && sessionId && (
        <div className="flex items-center gap-1.5 border-b border-[hsl(var(--border))] bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-600 dark:text-amber-400">
          <AlertTriangle size={12} className="shrink-0" />
          {t('agent_chat.live_unavailable')}
        </div>
      )}

      {!sessionId ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
          {sessionsLoading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <>
              <p>{t('agent_chat.start')}</p>
              <Button size="sm" onClick={handleCreateSession} disabled={createSession.isPending}>
                <Plus size={14} />
                {t('agent_chat.new_chat')}
              </Button>
            </>
          )}
        </div>
      ) : (
        <>
          <ScrollArea className="flex-1">
            <div className="flex flex-col gap-3 p-3">
              {messagesLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 size={18} className="animate-spin text-[hsl(var(--muted-foreground))]" />
                </div>
              ) : !messages || messages.length === 0 ? (
                <p className="py-6 text-center text-xs text-[hsl(var(--muted-foreground))]">
                  {t('agent_chat.send_to_start')}
                </p>
              ) : (
                messages.map((m) => (
                  <MessageBubble key={m.id} message={m} onConfirm={confirmToolCall} />
                ))
              )}

              {sendErrorText && (
                <p className="rounded-md bg-[hsl(var(--destructive))]/10 px-3 py-2 text-xs text-[hsl(var(--destructive))]">
                  {sendErrorText}
                </p>
              )}

              <div ref={scrollBottomRef} />
            </div>
          </ScrollArea>

          <div className="flex items-end gap-2 border-t border-[hsl(var(--border))] p-2.5">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder={t('agent_chat.message_placeholder')}
              rows={1}
              className="min-h-9 flex-1 resize-none py-2 text-sm"
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!draft.trim() || sendMessage.isPending}
              aria-label={t('agent_chat.send')}
            >
              {sendMessage.isPending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

interface ChatHeaderProps {
  activeSession?: ChatSession
  sessions: ChatSession[]
  sessionsLoading: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (id: string) => void
  onCreate: () => void
  creating: boolean
}

function ChatHeader({ activeSession, sessions, sessionsLoading, open, onOpenChange, onSelect, onCreate, creating }: ChatHeaderProps) {
  const t = useTranslation()
  return (
    <div className="flex items-center justify-between gap-2 border-b border-[hsl(var(--border))] px-3 py-2.5">
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-1 rounded-md px-1.5 py-1 text-left text-sm font-medium transition-colors hover:bg-[hsl(var(--accent))]"
          >
            <span className="truncate">{activeSession?.title || t('agent_chat.new_chat')}</span>
            <ChevronDown size={13} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 border-[hsl(var(--border))] bg-[hsl(var(--popover))] p-0 text-[hsl(var(--popover-foreground))]">
          <div className="max-h-64 overflow-y-auto py-1">
            {sessionsLoading ? (
              <p className="px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">{t('common.loading')}</p>
            ) : sessions.length === 0 ? (
              <p className="px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">{t('agent_chat.no_conversations')}</p>
            ) : (
              sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onSelect(s.id)}
                  className={cn(
                    'block w-full truncate px-3 py-1.5 text-left text-xs transition-colors hover:bg-[hsl(var(--accent))]',
                    s.id === activeSession?.id && 'bg-[hsl(var(--accent))] font-medium',
                  )}
                >
                  {s.title || t('agent_chat.untitled')}
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
      <Button size="icon" variant="ghost" onClick={onCreate} disabled={creating} aria-label={t('agent_chat.new_chat')}>
        {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
      </Button>
    </div>
  )
}

interface MessageBubbleProps {
  message: ChatMessage
  onConfirm: ReturnType<typeof useConfirmChatToolCall>
}

function MessageBubble({ message, onConfirm }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const pending = asPendingConfirmation(message)

  if (pending) {
    return <ConfirmationBubble confirmation={pending} onConfirm={onConfirm} />
  }

  if (!message.content) return null

  return (
    <div className={cn('flex flex-col gap-0.5', isUser ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm',
          isUser
            ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
            : 'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]',
        )}
      >
        {message.content}
      </div>
      <span className="px-1 text-[10px] text-[hsl(var(--muted-foreground))]">{timeLabel(message.created_at)}</span>
    </div>
  )
}

interface ConfirmationBubbleProps {
  confirmation: PendingConfirmation
  onConfirm: ReturnType<typeof useConfirmChatToolCall>
}

// Renders an always_confirm tool call awaiting (or resolved by) a human
// decision (FR-F6-002 AGNT-03) — the Chat surface's own attended path, as
// opposed to an unattended run which blocks outright. Approving/denying
// posts to /confirm; FR-F6-002's own server-side poll (unchanged by this
// document) is what actually resumes the Agent loop once recorded.
function ConfirmationBubble({ confirmation, onConfirm }: ConfirmationBubbleProps) {
  const resolved = confirmation.status !== 'pending'
  return (
    <div className="flex items-start justify-start">
      <div className="max-w-[90%] rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2.5 text-sm">
        <div className="flex items-center gap-1.5 font-medium">
          <Wrench size={13} className="shrink-0 text-[hsl(var(--muted-foreground))]" />
          Wants to run <code className="rounded bg-[hsl(var(--muted))] px-1 py-0.5 text-xs">{confirmation.name}</code>
        </div>
        {Object.keys(confirmation.arguments ?? {}).length > 0 && (
          <pre className="mt-1.5 overflow-x-auto rounded-md bg-[hsl(var(--muted))] p-2 text-[11px] text-[hsl(var(--muted-foreground))]">
            {JSON.stringify(confirmation.arguments, null, 2)}
          </pre>
        )}
        {resolved ? (
          <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
            {confirmation.status === 'approved' ? 'Approved.' : 'Denied.'}
          </p>
        ) : (
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={() => onConfirm.mutate(true)} disabled={onConfirm.isPending}>
              <Check size={13} />
              Approve
            </Button>
            <Button size="sm" variant="outline" onClick={() => onConfirm.mutate(false)} disabled={onConfirm.isPending}>
              <X size={13} />
              Deny
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
