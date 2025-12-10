import { apiFetch } from '../../../lib/http/client'

export async function register(username: string, password: string) {
  return apiFetch('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, password }) })
}

export async function login(username: string, password: string) {
  return apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
}

export async function whoami() {
  return apiFetch('/api/auth/whoami')
}

export async function logout() {
  return apiFetch('/api/auth/logout', { method: 'POST' })
}
