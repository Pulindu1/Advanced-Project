import { apiFetch } from '../../../lib/http/client'

export interface User {
  username: string
}

export async function getTeamUsers(): Promise<User[]> {
  const data = await apiFetch('/api/teams/users')
  return data.users || []
}
