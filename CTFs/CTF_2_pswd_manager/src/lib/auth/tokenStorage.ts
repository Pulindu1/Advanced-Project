// tokenStorage provides a single place to change how tokens are stored.
// By default we keep tokens in-memory to reduce persistence risk.

let _token: string | null = null

export const tokenStorage = {
  get() {
    return _token
  },
  set(token: string | null) {
    _token = token
  },
  clear() {
    _token = null
  }
}
