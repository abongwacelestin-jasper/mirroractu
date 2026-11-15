import { createContext, useContext } from 'react'

/**
 * Lets a test or embed pin a UI state (the splash, a skeleton, a popup) so each can be reviewed.
 * Production leaves it at 'live', where everything behaves normally.
 */
export type PreviewState = 'live' | 'splash' | 'skeleton' | 'newsletter' | 'cookies'

export const PreviewContext = createContext<PreviewState>('live')
export const usePreviewState = () => useContext(PreviewContext)
