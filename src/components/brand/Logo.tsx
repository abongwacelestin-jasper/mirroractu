import React, { useId } from 'react'

/** The MirrorActu symbol: a solid half and a scan-line half, split by the signal axis. */
export function Logo({ className }: { className?: string }) {
  const pattern = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={className} style={{ overflow: 'visible' }}>
      <defs>
        <pattern id={pattern} width="100" height="5" patternUnits="userSpaceOnUse">
          <rect width="100" height="2.6" fill="#C9D1DC" />
        </pattern>
      </defs>
      <line x1="50" y1="2" x2="50" y2="14" stroke="#FF5A36" strokeWidth="1.2" strokeDasharray="2.4 2.4" />
      <line x1="50" y1="72" x2="50" y2="98" stroke="#FF5A36" strokeWidth="1.2" strokeDasharray="2.4 2.4" />
      <path fill="#F4F1EA" d="M12 88V12h14.5L50 42.5V68L26.5 38.5V88Z" />
      <path fill={`url(#${pattern})`} d="M88 88V12H73.5L50 42.5V68L73.5 38.5V88Z" />
      <circle fill="#FF5A36" cx="50" cy="25" r="5.2" />
    </svg>
  )
}
