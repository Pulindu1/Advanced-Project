import { apiFetch } from '../../../lib/http/client'

export interface VaultEntry {
  id: string
  site: string
  username: string
  password: string
  notes?: string
  createdAt: string
}

export interface CreateVaultEntryDto {
  site: string
  username: string
  password: string
  notes?: string
}

export async function getVaultEntries(): Promise<VaultEntry[]> {
  const data = await apiFetch('/api/vault')
  return data.entries || []
}

export async function createVaultEntry(entry: CreateVaultEntryDto): Promise<VaultEntry> {
  const data = await apiFetch('/api/vault', {
    method: 'POST',
    body: JSON.stringify(entry)
  })
  return data.entry
}

export async function deleteVaultEntry(id: string): Promise<void> {
  await apiFetch(`/api/vault/${id}`, {
    method: 'DELETE'
  })
}
