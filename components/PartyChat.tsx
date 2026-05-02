'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { AvatarIcon } from '@/lib/avatars'
import type { Message, Player } from '@/lib/types'

const MESSAGE_LIMIT = 100
const SYSTEM_JOIN_PREFIX = '🏇 '
const SYSTEM_JOIN_SUFFIX = ' joined the party!'

/** Build the canonical join system-message string. Used both at insert time
 *  (in the join flow) and at render time (to detect-and-style system rows). */
export function joinPartyMessage(name: string): string {
  return `${SYSTEM_JOIN_PREFIX}${name}${SYSTEM_JOIN_SUFFIX}`
}

function isSystemMessage(content: string): boolean {
  return content.startsWith(SYSTEM_JOIN_PREFIX) && content.endsWith(SYSTEM_JOIN_SUFFIX)
}

/** Coarse "x ago" formatter — chat is real-time so most timestamps land within
 *  the last few minutes. Falls back to wall-clock time after a day. */
function relativeTime(iso: string, now: number): string {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ''
  const secs = Math.max(0, Math.floor((now - t) / 1000))
  if (secs < 5) return 'just now'
  if (secs < 60) return `${secs}s ago`
  const m = Math.floor(secs / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

type Theme = 'light' | 'dark'

type Props = {
  eventId: string
  player: Player
  /** All players in the event — used to resolve author name + avatar for
   *  realtime INSERT payloads (which don't include the join). The picks and
   *  track pages already maintain this list, so threading it down avoids a
   *  duplicate fetch + cache layer here. */
  players: Player[]
  /** Visual theme. /picks is light, /track is dark. */
  theme?: Theme
}

export function PartyChat({ eventId, player, players, theme = 'light' }: Props) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [unread, setUnread] = useState(0)
  // Live "x ago" updates without forcing a re-render every second across the
  // whole tree — local 30s tick is plenty for relative time labels.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(i)
  }, [])

  // Quick lookup so realtime payloads (which only include the message row,
  // not its author) can resolve avatar + name from the parent's players list.
  const playersById = useMemo(
    () => new Map(players.map(p => [p.id, p])),
    [players],
  )
  // Ref mirror so the realtime callback always sees the latest open state
  // without re-creating the channel on every toggle.
  const openRef = useRef(open)
  useEffect(() => { openRef.current = open }, [open])

  const listRef = useRef<HTMLDivElement | null>(null)
  const composerRef = useRef<HTMLInputElement | null>(null)
  // Track whether the user is pinned to the bottom — only auto-scroll on new
  // messages when they are, so reading older history isn't yanked away.
  const pinnedToBottomRef = useRef(true)

  function checkPinned() {
    const el = listRef.current
    if (!el) return
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    pinnedToBottomRef.current = distance < 24
  }

  function scrollToBottom(behavior: ScrollBehavior = 'auto') {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
    if (behavior === 'smooth') {
      el.scrollTo({ top: el.scrollHeight, behavior })
    }
  }

  // Initial fetch + realtime subscription for the event's chat stream.
  useEffect(() => {
    if (!eventId) return
    let cancelled = false

    void (async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
        .limit(MESSAGE_LIMIT)
      if (cancelled) return
      if (error) {
        console.error('[PartyChat] load failed', error)
        return
      }
      // DB returns newest-first because of the limit ordering; flip back so
      // the oldest message is at the top of the list visually.
      setMessages(((data as Message[] | null) ?? []).slice().reverse())
    })()

    const channel = supabase
      .channel(`party-chat-${eventId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `event_id=eq.${eventId}` },
        (payload) => {
          if (cancelled) return
          const msg = payload.new as Message
          setMessages(prev => {
            // De-dupe in case a local optimistic insert lands twice.
            if (prev.some(m => m.id === msg.id)) return prev
            // Cap to MESSAGE_LIMIT so an event that's been chatty all day
            // doesn't blow memory in a long-lived browser session.
            const next = [...prev, msg]
            return next.length > MESSAGE_LIMIT
              ? next.slice(next.length - MESSAGE_LIMIT)
              : next
          })
          // Bump unread only when the panel is closed AND the new message
          // wasn't sent by the current player (your own messages shouldn't
          // count as unread).
          if (!openRef.current && msg.player_id !== player.id) {
            setUnread(u => u + 1)
          }
        })
      .subscribe()

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [eventId, player.id])

  // Auto-scroll on new message — only when pinned to bottom, so reading older
  // history isn't yanked. Also scroll when the panel first opens.
  useEffect(() => {
    if (!open) return
    if (pinnedToBottomRef.current) scrollToBottom('smooth')
  }, [messages, open])

  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUnread(0)
    // Land at the bottom on first open of the session.
    requestAnimationFrame(() => scrollToBottom('auto'))
    // Focus the composer so iOS keyboard pops without a second tap.
    requestAnimationFrame(() => composerRef.current?.focus())
  }, [open])

  async function send() {
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    try {
      const { error } = await supabase.from('messages').insert({
        event_id: eventId,
        player_id: player.id,
        content: text,
      })
      if (error) {
        console.error('[PartyChat] send failed', error)
        return
      }
      setDraft('')
    } finally {
      setSending(false)
    }
  }

  // Theme tokens — kept inline here rather than in a CSS module so each
  // surface (panel, message bubble, composer) can pick the right shade
  // without us juggling extra component layers.
  const isDark = theme === 'dark'
  const t = {
    bubble: isDark
      ? 'bg-[var(--rose-dark)] text-white border-2 border-[var(--gold)]/60 shadow-lg shadow-black/40'
      : 'bg-[var(--rose-dark)] text-white border-2 border-[var(--gold)]/60 shadow-lg',
    panel: isDark
      ? 'bg-[#0F1629] text-white border-t-2 border-[var(--gold)]/40'
      : 'bg-white text-[var(--text-primary)] border-t-2 border-[var(--border)]',
    header: isDark
      ? 'border-b border-white/10'
      : 'border-b border-[var(--border)]',
    body: isDark ? 'bg-[#0F1629]' : 'bg-[var(--bg-primary)]',
    composerBar: isDark
      ? 'border-t border-white/10 bg-[#0F1629]'
      : 'border-t border-[var(--border)] bg-white',
    input: isDark
      ? 'bg-[#1a2035] text-white text-sm border-2 border-white/20 focus:outline-none focus:border-[var(--gold)] placeholder:text-white/40'
      : 'bg-white text-[var(--text-primary)] text-sm border-2 border-[var(--border)] focus:outline-none focus:border-[var(--gold)] placeholder:text-[var(--text-muted)]',
    sendBtn: 'bg-[var(--rose-dark)] text-white font-bold border-2 border-[var(--gold)]/60',
    closeBtn: isDark
      ? 'bg-white/10 hover:bg-white/15 text-white border-white/20'
      : 'bg-[var(--bg-primary)] hover:bg-[var(--bg-card-hover)] text-[var(--text-primary)] border-[var(--border)]',
    title: isDark ? 'text-white' : 'text-[var(--text-primary)]',
    meta: isDark ? 'text-white/55' : 'text-[var(--text-muted)]',
    msgCard: isDark
      ? 'bg-white/5 border border-white/10'
      : 'bg-white border border-[var(--border)] shadow-sm',
    msgCardSelf: isDark
      ? 'bg-[var(--gold)]/15 border border-[var(--gold)]/40'
      : 'bg-amber-50 border border-[var(--gold)]/40',
    sysCard: isDark
      ? 'bg-white/5 text-white/65 border border-white/10'
      : 'bg-[var(--bg-card-hover)] text-[var(--text-muted)] border border-[var(--border)]',
    msgText: isDark ? 'text-white' : 'text-[var(--text-primary)]',
    nameText: isDark ? 'text-white' : 'text-[var(--text-primary)]',
    emptyText: isDark ? 'text-white/55' : 'text-[var(--text-muted)]',
  }

  return (
    <>
      {/* Floating chat bubble — sits above the bottom nav (which on /picks is
          ~56px tall) plus a small breathing-room offset. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={unread > 0 ? `Open party chat (${unread} unread)` : 'Open party chat'}
        className={`fixed bottom-20 right-4 z-30 w-14 h-14 rounded-full inline-flex items-center justify-center text-2xl ${t.bubble} active:scale-[0.95] transition-transform`}
      >
        <span aria-hidden>💬</span>
        {unread > 0 && (
          <span
            aria-hidden
            className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1.5 rounded-full bg-[var(--warning)] text-white text-[11px] font-extrabold inline-flex items-center justify-center border-2 border-white shadow"
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-black/40 flex items-end justify-center"
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 240 }}
              onClick={e => e.stopPropagation()}
              className={`${t.panel} w-full sm:max-w-xl rounded-t-3xl sm:rounded-t-2xl flex flex-col shadow-2xl`}
              style={{ height: '80vh' }}
            >
              <div className={`px-5 pt-4 pb-3 flex items-center justify-between gap-3 ${t.header}`}>
                <div className="min-w-0">
                  <h3 className={`font-serif text-xl font-bold leading-tight ${t.title}`}>💬 Party Chat</h3>
                  <p className={`text-xs ${t.meta} truncate`}>
                    {messages.length === 0
                      ? 'Be the first to say hi.'
                      : `${messages.length} message${messages.length === 1 ? '' : 's'}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close chat"
                  className={`shrink-0 w-9 h-9 rounded-full border text-xl leading-none flex items-center justify-center ${t.closeBtn}`}
                >
                  ✕
                </button>
              </div>

              <div
                ref={listRef}
                onScroll={checkPinned}
                className={`flex-1 overflow-y-auto px-3 py-3 space-y-2 ${t.body}`}
              >
                {messages.length === 0 ? (
                  <div className={`h-full flex flex-col items-center justify-center text-center px-6 ${t.emptyText}`}>
                    <div className="text-5xl mb-2">🤠</div>
                    <p className="text-sm">No messages yet — drop a take on race 1.</p>
                  </div>
                ) : messages.map(m => {
                  if (isSystemMessage(m.content)) {
                    return (
                      <div key={m.id} className="flex justify-center">
                        <div className={`text-[11px] font-semibold px-3 py-1.5 rounded-full ${t.sysCard}`}>
                          {m.content}
                          <span className="opacity-60 ml-1.5">· {relativeTime(m.created_at, now)}</span>
                        </div>
                      </div>
                    )
                  }
                  const author = playersById.get(m.player_id) ?? m.player ?? null
                  const isSelf = m.player_id === player.id
                  return (
                    <div key={m.id} className={`rounded-xl px-3 py-2 ${isSelf ? t.msgCardSelf : t.msgCard}`}>
                      <div className="flex items-start gap-2">
                        {author?.avatar ? (
                          <AvatarIcon id={author.avatar} className="w-8 h-8 rounded-md shrink-0" />
                        ) : (
                          <div className={`w-8 h-8 rounded-md shrink-0 ${isDark ? 'bg-white/10' : 'bg-gray-200'}`} />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className={`text-sm font-bold truncate ${t.nameText}`}>
                              {author?.name ?? 'Player'}
                              {isSelf && (
                                <span className={`ml-1 text-[10px] font-semibold uppercase tracking-wider ${t.meta}`}>
                                  you
                                </span>
                              )}
                            </span>
                            <span className={`text-[10px] tabular-nums shrink-0 ${t.meta}`}>
                              {relativeTime(m.created_at, now)}
                            </span>
                          </div>
                          <div className={`text-sm whitespace-pre-wrap break-words ${t.msgText}`}>
                            {m.content}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className={`px-3 py-2 flex items-center gap-2 ${t.composerBar}`}>
                <input
                  ref={composerRef}
                  type="text"
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void send()
                    }
                  }}
                  placeholder={`Message as ${player.name}…`}
                  maxLength={500}
                  className={`flex-1 h-11 px-3 rounded-lg ${t.input}`}
                />
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={!draft.trim() || sending}
                  className={`shrink-0 h-11 px-4 rounded-lg ${t.sendBtn} disabled:opacity-40`}
                >
                  Send
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
