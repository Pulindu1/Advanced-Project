// Minimal HTTP client wrapper (fetch-based) that centralises auth header injection
export async function apiFetch(input: RequestInfo, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {})
  // Token injection could be done here by reading from tokenStorage (not included in-client)
  headers.set('Accept', 'application/json')
  headers.set('Content-Type', 'application/json')

  const res = await fetch(input, { ...init, credentials: 'include', headers })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API error ${res.status}: ${text}`)
  }
  return res.json()
}
