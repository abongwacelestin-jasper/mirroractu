/**
 * The MirrorActu API client. The API lives at the same address as the site, under /api/v1
 * (nginx forwards it in production, Vite in development), so sign-in cookies never cross sites.
 */
export class ApiError extends Error {
  status: number
  fields?: { field: string; problem: string }[]
  constructor(message: string, status: number, fields?: { field: string; problem: string }[]) {
    super(message)
    this.status = status
    this.fields = fields
  }
}

const BASE = '/api/v1'

/** Call the API. Throws ApiError with a message fit to show a person. */
export async function api<T = any>(path: string, options: { method?: string; body?: unknown; timeoutMs?: number } = {}): Promise<T> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), options.timeoutMs ?? 10000)
  let res: Response
  try {
    res = await fetch(BASE + path, {
      method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
      headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: 'same-origin',
      signal: controller.signal,
    })
  } catch {
    throw new ApiError('We could not reach MirrorActu. Check your connection and try again.', 0)
  } finally {
    window.clearTimeout(timer)
  }
  if (res.status === 204) return undefined as T
  const type = res.headers.get('content-type') ?? ''
  const data = type.includes('json') ? await res.json().catch(() => null) : await res.text()
  if (!res.ok) throw new ApiError((data as any)?.error ?? 'Something went wrong. Try again.', res.status, (data as any)?.fields)
  return data as T
}

/** Whether the API answered when the site started. Forms and live features check this. */
export let apiOnline = false
export const setApiOnline = (on: boolean) => {
  apiOnline = on
}
