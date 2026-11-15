import React, { useId } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

const EASE = [0.23, 1, 0.32, 1] as const

/**
 * The MirrorActu symbol assembling itself: the solid half, the scan-line half, the signal axis,
 * then the dot dropping in. The same sequence as the first-load splash in index.html.
 */
export function AnimatedLogo({ className, delay = 0 }: { className?: string; delay?: number }) {
  const reduce = useReducedMotion()
  const scan = useId().replace(/:/g, '')
  const t = (d: number, dur = 0.28) => (reduce ? { duration: 0 } : { duration: dur, delay: delay + d, ease: EASE })
  return (
    <svg viewBox="0 0 100 100" className={className} style={{ overflow: 'visible' }} aria-hidden="true">
      <defs>
        <pattern id={scan} width="100" height="5" patternUnits="userSpaceOnUse">
          <rect width="100" height="2.6" fill="#C9D1DC" />
        </pattern>
      </defs>
      <motion.path initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={t(0.05)} fill="#F4F1EA" d="M12 88V12h14.5L50 42.5V68L26.5 38.5V88Z" />
      <motion.path initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={t(0.15)} fill={`url(#${scan})`} d="M88 88V12H73.5L50 42.5V68L73.5 38.5V88Z" />
      <motion.line initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={t(0.3)} x1="50" y1="2" x2="50" y2="14" stroke="#FF5A36" strokeWidth="1.2" strokeDasharray="2.4 2.4" />
      <motion.line initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={t(0.3)} x1="50" y1="72" x2="50" y2="98" stroke="#FF5A36" strokeWidth="1.2" strokeDasharray="2.4 2.4" />
      <motion.circle initial={{ opacity: 0, cy: 10 }} animate={{ opacity: 1, cy: 25 }} transition={t(0.4, 0.24)} fill="#FF5A36" cx="50" r="5.2" />
    </svg>
  )
}
