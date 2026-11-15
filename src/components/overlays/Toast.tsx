import React, { createContext, useCallback, useContext, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

type Action = { label: string; onClick: () => void }
type Toast = { id: number; text: string; action?: Action }

const ToastContext = createContext<(text: string, action?: Action) => void>(() => {})

/**
 * Short confirmation popups ("Story saved", "Link copied"), bottom left, above the phone tab bar.
 * Pass an action for an undo: `toast('Hidden from your feed', { label: 'Undo', onClick })`.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const next = useRef(0)
  const show = useCallback((text: string, action?: Action) => {
    const id = ++next.current
    setToasts((t) => [...t.slice(-2), { id, text, action }])
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), action ? 5000 : 2600)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-3 bottom-[76px] z-[70] flex flex-col gap-2 sm:inset-x-auto sm:left-5 lg:bottom-5">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              className="pointer-events-auto flex items-center gap-3 bg-ink px-4 py-3 text-[14.5px] font-medium text-white shadow-[0_16px_32px_-12px_rgba(14,20,36,.5)]"
            >
              <span aria-hidden="true" className="size-2 flex-none rounded-full bg-signal" />
              <span className="min-w-0 flex-1">{t.text}</span>
              {t.action && (
                <button
                  type="button"
                  onClick={() => {
                    t.action!.onClick()
                    setToasts((list) => list.filter((x) => x.id !== t.id))
                  }}
                  className="flex-none font-semibold text-signal underline underline-offset-4"
                >
                  {t.action.label}
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
