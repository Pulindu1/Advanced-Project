import { apiFetch } from '../../../lib/http/client'

export interface Challenge {
  nonce: string
  difficulty: number
}

export async function getChallenge(): Promise<Challenge> {
  const data = await apiFetch('/api/challenge')
  return data
}

export async function solveChallenge(nonce: string, suffix: string) {
  const data = await apiFetch('/api/challenge/solve', {
    method: 'POST',
    body: JSON.stringify({ nonce, suffix })
  })
  return data
}
