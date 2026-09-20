import { useEffect, useRef, useState } from 'react'
import { Centrifuge } from 'centrifuge'
import { useQueryClient } from '@tanstack/react-query'
import { agentChatApi } from './api'
import { agentChatKeys } from './hooks'
import type { ChatMessage } from './types'

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

// Direct browser-to-Centrifugo WebSocket subscription (FR-D4-002 v0.3's
// resolved topology — not proxied through workflow-engine). One Centrifuge
// client + one channel subscription per open session; torn down and rebuilt
// whenever sessionId changes.
//
// Token minting is reactive, not proactive (v0.3's resolved decision): the
// initial token comes from POST .../ws-token before connecting, and further
// mints only happen via Centrifuge's own getToken callback, which it calls
// itself when a token is missing/expired — never on a fixed timer.
//
// Connection failures surface as `status` so the caller can render a
// connection-error banner while keeping the surface usable via REST (v0.3's
// resolved fallback decision) — sending messages and loading history never
// depend on this hook's connection succeeding.
export function useAgentChatSocket(sessionId: string | null) {
  const qc = useQueryClient()
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const clientRef = useRef<Centrifuge | null>(null)

  useEffect(() => {
    if (!sessionId) {
      setStatus('disconnected')
      return
    }

    let cancelled = false
    setStatus('connecting')

    // Only known at connect time (the ws-token response carries it), so the
    // Centrifuge client itself is constructed inside this async mint, not
    // synchronously above.
    agentChatApi.mintWSToken(sessionId).then((first) => {
      if (cancelled) return

      const client = new Centrifuge(first.ws_url, {
        token: first.token,
        getToken: async () => {
          const fresh = await agentChatApi.mintWSToken(sessionId)
          return fresh.token
        },
      })
      clientRef.current = client

      client.on('connected', () => !cancelled && setStatus('connected'))
      client.on('connecting', () => !cancelled && setStatus('connecting'))
      client.on('disconnected', () => !cancelled && setStatus('disconnected'))

      const sub = client.newSubscription(first.channel, {
        getToken: async () => {
          const fresh = await agentChatApi.mintWSToken(sessionId)
          return fresh.token
        },
      })
      sub.on('publication', (ctx) => {
        if (cancelled) return
        const msg = ctx.data as ChatMessage
        qc.setQueryData<ChatMessage[]>(agentChatKeys.messages(sessionId), (prev) => {
          if (!prev) return [msg]
          const existing = prev.findIndex((m) => m.id === msg.id)
          if (existing >= 0) {
            const next = [...prev]
            next[existing] = msg
            return next
          }
          return [...prev, msg]
        })
      })

      sub.subscribe()
      client.connect()
    }).catch(() => {
      if (!cancelled) setStatus('disconnected')
    })

    return () => {
      cancelled = true
      clientRef.current?.disconnect()
      clientRef.current = null
    }
  }, [sessionId, qc])

  return status
}
