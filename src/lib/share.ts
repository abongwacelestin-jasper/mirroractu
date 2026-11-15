import { useToast } from '@/components/overlays/Toast'

const ORIGIN = 'https://mirroractu.net'

/** Share a page: the device share sheet where there is one, otherwise copy the link. */
export function useShare() {
  const toast = useToast()
  return async (title: string, path: string) => {
    const url = ORIGIN + path
    try {
      if (navigator.share) {
        await navigator.share({ title, url })
        return
      }
      await navigator.clipboard.writeText(url)
      toast('Link copied')
    } catch (e) {
      // The reader closed the share sheet: nothing to report.
      if ((e as Error)?.name !== 'AbortError') toast('Copying is blocked here. Open the story to share it.')
    }
  }
}
