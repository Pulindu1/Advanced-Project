// Minimal HTTP client wrapper (fetch-based) that centralises auth header injection
// Use a relative base by default so the Vite dev server proxy can forward /api requests
// during development. Set VITE_API_BASE to an absolute URL to override (e.g. production).
// Use import.meta.env when available; cast to any to avoid TS type complaints in the dev env.
const BASE = (((import.meta as any).env && (import.meta as any).env.VITE_API_BASE) as string) || ''

export async function apiFetch(input: RequestInfo, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {})
  // Token injection could be done here by reading from tokenStorage (not included in-client)
  headers.set('Accept', 'application/json')
  headers.set('Content-Type', 'application/json')

  const url = typeof input === 'string' && input.startsWith('/') ? `${BASE}${input}` : input

  const res = await fetch(url, { ...init, credentials: 'include', headers })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API error ${res.status}: ${text}`)
  }
  return res.json()
}
