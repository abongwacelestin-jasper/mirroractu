import React, { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { twMerge } from 'tailwind-merge'

const EASE = [0.23, 1, 0.32, 1] as const

/**
 * Accessible dialog: Escape and the backdrop close it, focus moves in on open, stays inside
 * while it is open and returns on close. The page behind does not scroll.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  className,
  tone = 'light',
  center = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  className?: string
  tone?: 'light' | 'dark'
  /** Centre on every screen. By default a dialog is a bottom sheet on phones. */
  center?: boolean
}) {
  const panel = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return
    const before = document.activeElement as HTMLElement | null
    panel.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return closeRef.current()
      if (e.key !== 'Tab' || !panel.current) return
      // Keep Tab inside the dialog.
      const items = panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"])')
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || active === panel.current)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    // The page behind must not scroll while a dialog is open.
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      before?.focus?.()
    }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: EASE }}
          onClick={(e) => e.target === e.currentTarget && onClose()}
          className={twMerge('fixed inset-0 z-[60] flex justify-center bg-ink/60 backdrop-blur-[3px] sm:items-center sm:p-6', center ? 'items-center p-3' : 'items-end p-0')}
        >
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.24, ease: EASE }}
            className={twMerge(
              'relative max-h-[92vh] w-full overflow-auto p-7 shadow-[0_30px_60px_-20px_rgba(14,20,36,.5)] outline-none sm:max-w-[520px] sm:p-9',
              tone === 'dark' ? 'bg-ink text-white' : 'bg-white text-ink',
              className
            )}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className={twMerge(
                'absolute right-4 top-4 flex size-9 items-center justify-center rounded-full text-xl transition-colors duration-150',
                tone === 'dark' ? 'text-mirror hover:bg-white/10 hover:text-white' : 'text-muted hover:bg-ink/5 hover:text-ink'
              )}
            >
              ×
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
