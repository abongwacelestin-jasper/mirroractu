import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link, useLocation } from 'react-router-dom'
import { twMerge } from 'tailwind-merge'

import { CategoryId, storyPath } from '@/data'
import { WIRE_KIND_LABEL, WireItem, formatQuote, useLiveStatus, useMarkets, useWire, useWireSource } from '@/live/feed'
import { useStoredValue } from '@/lib/store'
import { Bone } from '@/components/loading/Loading'
import { Container } from '@/components/ui'

const EASE = [0.23, 1, 0.32, 1] as const

/** "Live" badge with a slow pulse. Reads "Connecting" until the feed answers. */
export function LiveBadge({ dark = false, note = true }: { dark?: boolean; note?: boolean }) {
  const live = useLiveStatus() === 'live'
  const simulated = useWireSource() === 'simulated'
  return (
    <span className={twMerge('flex items-center gap-2 text-[13px]', dark ? 'text-mirror' : 'text-muted')}>
      <span className="relative flex size-2.5">
        {live && <span className="absolute inset-0 rounded-full bg-signal opacity-60 motion-safe:animate-ping" />}
        <span className={twMerge('relative size-2.5 rounded-full', live ? 'bg-signal' : 'bg-faint')} />
      </span>
      <b className={twMerge('font-semibold', dark ? 'text-white' : 'text-ink')}>{live ? 'Live' : 'Connecting'}</b>
      {note && <span>{simulated ? 'Simulated wire: the API is offline' : 'Streaming from the newsroom'}</span>}
    </span>
  )
}

/** Placeholder rows shown while the wire connects. */
function WireSkeleton({ rows, dark }: { rows: number; dark: boolean }) {
  return (
    <ul role="status" aria-label="Connecting to the wire">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className={twMerge('grid grid-cols-[48px_1fr] gap-3 border-t py-3', dark ? 'border-rule-dark' : 'border-rule')}>
          <Bone dark={dark} className="mt-1 h-3 w-9" />
          <span className="space-y-2">
            <Bone dark={dark} className="h-3 w-24" />
            <Bone dark={dark} className={twMerge('h-4', i % 2 ? 'w-2/3' : 'w-11/12')} />
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * The live wire: timestamped updates, newest on top. Pass `cat` for one desk's wire or
 * `storyId` for the updates on one story.
 */
export function LiveWire({
  dark = false,
  max = 6,
  cat,
  storyId,
  title = 'The wire',
  className,
}: {
  dark?: boolean
  max?: number
  cat?: CategoryId
  storyId?: string
  title?: string
  className?: string
}) {
  const { items, status } = useWire({ max, cat, storyId })
  return (
    <section aria-label={title} className={className}>
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className={twMerge('text-base tracking-normal', dark ? 'text-white' : 'text-ink')}>{title}</h2>
        <LiveBadge dark={dark} note={false} />
      </div>
      {status === 'connecting' ? (
        <WireSkeleton rows={Math.min(max, 4)} dark={dark} />
      ) : items.length === 0 ? (
        <p className={twMerge('border-t py-3 text-[14.5px]', dark ? 'border-rule-dark text-mirror' : 'border-rule text-muted')}>
          No live updates yet. New ones appear here as desks file them.
        </p>
      ) : (
        <ol aria-live="polite">
          <AnimatePresence initial={false}>
            {items.map((w) => (
              <motion.li
                key={w.id}
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.24, ease: EASE }}
                className={twMerge('border-t', dark ? 'border-rule-dark' : 'border-rule')}
              >
                <Link to={w.storyId ? storyPath(w.storyId) : '/live'} className="group grid grid-cols-[48px_1fr] gap-3 py-3">
                  <span className={twMerge('pt-0.5 font-mono text-xs tabular-nums', dark ? 'text-mirror' : 'text-muted')}>{w.time}</span>
                  <span>
                    <span className={twMerge('text-[12.5px] font-semibold', w.kind === 'confirmed' ? 'text-signal' : dark ? 'text-mirror-light' : 'text-muted')}>
                      {w.desk} · {WIRE_KIND_LABEL[w.kind]}
                    </span>
                    <span className={twMerge('mt-0.5 block text-[15px] leading-[1.35] decoration-signal decoration-2 underline-offset-4 group-hover:underline', dark ? 'text-white' : 'text-ink')}>
                      {w.text}
                    </span>
                  </span>
                </Link>
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      )}
    </section>
  )
}

/** Market and data ticker for the stage strip. Stale quotes say so instead of pretending to move. */
export function MarketTicker() {
  const quotes = useMarkets()
  const connecting = useLiveStatus() === 'connecting'
  return (
    <div className="no-scrollbar flex overflow-x-auto">
      <div className="mr-7 flex flex-none items-center border-r border-rule-dark pr-7">
        <LiveBadge dark note={false} />
      </div>
      {quotes.map((q) => (
        <Link
          key={q.id}
          to={q.storyId ? storyPath(q.storyId) : '/live'}
          className="group mr-7 flex-[1_0_auto] whitespace-nowrap border-r border-rule-dark pb-[17px] pr-7 pt-4 tabular-nums last:mr-0 last:border-r-0"
        >
          <small className="block text-[12.5px] text-mirror">
            {q.label}
            {q.stale && <span className="ml-1.5 text-dew">· stale, 6 Nov</span>}
          </small>
          {connecting ? (
            <Bone dark className="mt-1.5 h-5 w-24" />
          ) : (
            <>
              <motion.b
                key={formatQuote(q)}
                initial={{ color: '#F2B441' }}
                animate={{ color: '#FFFFFF' }}
                transition={{ duration: 0.9 }}
                className="text-[19px] font-semibold tracking-[-0.01em]"
              >
                {formatQuote(q)}
              </motion.b>
              {q.id !== 'temp' && (
                <em className={twMerge('ml-2 text-[13.5px] not-italic', q.change < 0 ? 'text-mirror-light' : 'text-dew')}>
                  {q.change > 0 ? '+' : '−'}
                  {Math.abs(q.change).toFixed(1)}%
                </em>
              )}
            </>
          )}
        </Link>
      ))}
    </div>
  )
}

/**
 * The strip under the masthead on every page: the newest wire update, replaced as each one
 * arrives. Closing it hides it until the next visit.
 */
export function LiveBar() {
  const { items, status } = useWire({ max: 1 })
  const [closed, setClosed] = useState(false)
  if (closed) return null
  const w = items[0]
  return (
    <div className="border-b border-rule-dark bg-ink-2 text-white">
      <Container className="flex h-11 items-center gap-4">
        <LiveBadge dark note={false} />
        <div className="relative h-full min-w-0 flex-1 overflow-hidden" aria-live="off">
          {status === 'connecting' || !w ? (
            <div role="status" aria-label="Connecting to the wire" className="flex h-full items-center gap-3">
              <Bone className="h-3 w-10 bg-ink" />
              <Bone className="h-3 w-full max-w-[420px] bg-ink" />
            </div>
          ) : (
            <AnimatePresence initial={false}>
              <motion.div
                key={w.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.24, ease: EASE }}
                className="absolute inset-0 flex items-center"
              >
                <Link to={w.storyId ? storyPath(w.storyId) : '/live'} className="group flex min-w-0 items-baseline gap-3 text-[14.5px]">
                  <span className="font-mono text-xs tabular-nums text-mirror">{w.time}</span>
                  <span className={twMerge('hidden whitespace-nowrap text-[12.5px] font-semibold sm:inline', w.kind === 'confirmed' ? 'text-signal' : 'text-mirror-light')}>
                    {w.desk} · {WIRE_KIND_LABEL[w.kind]}
                  </span>
                  <span className="truncate decoration-signal decoration-2 underline-offset-4 group-hover:underline">{w.text}</span>
                </Link>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
        <Link to="/live" className="hidden whitespace-nowrap text-[13px] font-semibold text-mirror-light hover:text-white md:inline">
          All updates
        </Link>
        <button
          type="button"
          onClick={() => setClosed(true)}
          aria-label="Hide live updates bar"
          className="-mr-2 flex size-8 flex-none items-center justify-center rounded-full text-lg text-mirror transition-colors duration-150 hover:bg-white/10 hover:text-white"
        >
          ×
        </button>
      </Container>
    </div>
  )
}

const ALERT_SHOW_MS = 9000
const ALERT_GAP_MS = 45000

/**
 * Popup for newly confirmed facts. Slides in bottom right on wide screens when a "Confirmed"
 * update arrives, at most once every 45 seconds, and never on the live page (the wire is
 * already there). Readers can mute it; the choice is remembered.
 */
export function LiveAlert({ enabled }: { enabled: boolean }) {
  const { items, status } = useWire({ max: 1 })
  const { pathname } = useLocation()
  const [muted, setMuted] = useStoredValue('ma-alerts-muted', '')
  const [alert, setAlert] = useState<WireItem | null>(null)
  const seen = useRef<number | null>(null)
  const lastShown = useRef(0)
  const newest = items[0]

  useEffect(() => {
    if (status !== 'live' || !newest) return
    // The backfill that arrives on connect is history, not news.
    if (seen.current === null) {
      seen.current = newest.id
      return
    }
    if (newest.id === seen.current) return
    seen.current = newest.id
    if (!enabled || muted || pathname === '/live' || newest.kind !== 'confirmed') return
    if (Date.now() - lastShown.current < ALERT_GAP_MS) return
    lastShown.current = Date.now()
    setAlert(newest)
  }, [newest, status, enabled, muted, pathname])

  useEffect(() => {
    if (!alert) return
    const t = window.setTimeout(() => setAlert(null), ALERT_SHOW_MS)
    return () => window.clearTimeout(t)
  }, [alert])

  return (
    <AnimatePresence>
      {alert && (
        <motion.div
          key={alert.id}
          role="status"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ duration: 0.24, ease: EASE }}
          className="fixed bottom-5 right-5 z-[54] hidden w-[360px] border-l-[3px] border-signal bg-ink p-5 text-white shadow-[0_24px_48px_-20px_rgba(14,20,36,.6)] lg:block"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] font-semibold text-signal">Just confirmed · {alert.desk}</span>
            <button
              type="button"
              onClick={() => setAlert(null)}
              aria-label="Dismiss alert"
              className="-mr-1.5 -mt-1.5 flex size-8 items-center justify-center rounded-full text-lg text-mirror hover:bg-white/10 hover:text-white"
            >
              ×
            </button>
          </div>
          <p className="mt-1.5 text-[16.5px] font-semibold leading-[1.3]">{alert.text}</p>
          <div className="mt-3.5 flex items-center gap-5 text-[13.5px]">
            <Link
              to={alert.storyId ? storyPath(alert.storyId) : '/live'}
              onClick={() => setAlert(null)}
              className="border-b-2 border-signal pb-px font-semibold"
            >
              Read the story
            </Link>
            <button
              type="button"
              onClick={() => {
                setMuted('1')
                setAlert(null)
              }}
              className="text-mirror hover:text-white"
            >
              Mute alerts
            </button>
            <span className="ml-auto font-mono text-xs tabular-nums text-mirror">{alert.time}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
