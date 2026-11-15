import React from 'react'

/**
 * The MirrorActu symbol, drawn from one file: /public/brand/mark.svg. Replace that file and
 * the logo changes across the masthead, footer, dialogs, dashboard, app icon tile and offline
 * page. (The loading splash and the app prompts animate the symbol piece by piece and draw it
 * themselves: see AnimatedLogo.tsx and index.html if the shape itself changes.)
 */
export function Logo({ className }: { className?: string }) {
  return <img src="/brand/mark.svg" alt="" aria-hidden="true" draggable={false} className={className} />
}
