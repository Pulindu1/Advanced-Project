import React, { useState, useEffect } from 'react'
import { VaultEntry, getVaultEntries, createVaultEntry, deleteVaultEntry, CreateVaultEntryDto } from '../api/vaultApi'
import { AddEntryModal } from '../components/AddEntryModal'

export const VaultPage: React.FC = () => {
  const [entries, setEntries] = useState<VaultEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [revealedPasswords, setRevealedPasswords] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadEntries()
  }, [])

  const loadEntries = async () => {
    try {
      setLoading(true)
      setError('')
      const data = await getVaultEntries()
      setEntries(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load vault entries')
    } finally {
      setLoading(false)
    }
  }

  const handleAddEntry = async (entry: CreateVaultEntryDto) => {
    const newEntry = await createVaultEntry(entry)
    setEntries([...entries, newEntry])
  }

  const handleDeleteEntry = async (id: string) => {
    if (!confirm('Are you sure you want to delete this entry?')) return
    
    try {
      await deleteVaultEntry(id)
      setEntries(entries.filter(e => e.id !== id))
      setRevealedPasswords(prev => {
        const newSet = new Set(prev)
        newSet.delete(id)
        return newSet
      })
    } catch (err: any) {
      alert('Failed to delete entry: ' + err.message)
    }
  }

  const togglePasswordVisibility = (id: string) => {
    setRevealedPasswords(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  if (loading) {
    return <div style={styles.container}>Loading...</div>
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>My Vault</h2>
        <button style={styles.addButton} onClick={() => setIsModalOpen(true)}>
          + Add Login
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {entries.length === 0 ? (
        <div style={styles.emptyState}>
          <p>Your vault is empty. Add your first login to get started!</p>
        </div>
      ) : (
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Website/App</th>
                <th style={styles.th}>Username</th>
                <th style={styles.th}>Password</th>
                <th style={styles.th}>Notes</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} style={styles.tr}>
                  <td style={styles.td}>{entry.site}</td>
                  <td style={styles.td}>{entry.username}</td>
                  <td style={styles.td}>
                    <div style={styles.passwordCell}>
                      <span style={styles.passwordText}>
                        {revealedPasswords.has(entry.id) ? entry.password : '••••••••'}
                      </span>
                      <button
                        style={styles.toggleButton}
                        onClick={() => togglePasswordVisibility(entry.id)}
                        title={revealedPasswords.has(entry.id) ? 'Hide password' : 'Show password'}
                      >
                        {revealedPasswords.has(entry.id) ? '👁️' : '👁️‍🗨️'}
                      </button>
                    </div>
                  </td>
                  <td style={styles.td}>{entry.notes || '-'}</td>
                  <td style={styles.td}>
                    <button
                      style={styles.deleteButton}
                      onClick={() => handleDeleteEntry(entry.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddEntryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleAddEntry}
      />
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '24px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  title: {
    margin: 0,
    fontSize: '28px',
    fontWeight: 600,
  },
  addButton: {
    padding: '12px 24px',
    fontSize: '14px',
    fontWeight: 500,
    border: 'none',
    borderRadius: '6px',
    backgroundColor: '#007bff',
    color: 'white',
    cursor: 'pointer',
  },
  error: {
    padding: '12px',
    backgroundColor: '#fee',
    color: '#c33',
    borderRadius: '6px',
    marginBottom: '16px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#666',
  },
  tableContainer: {
    overflowX: 'auto',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '12px 16px',
    backgroundColor: '#f8f9fa',
    borderBottom: '2px solid #dee2e6',
    fontWeight: 600,
    fontSize: '14px',
    color: '#495057',
  },
  tr: {
    borderBottom: '1px solid #dee2e6',
  },
  td: {
    padding: '12px 16px',
    fontSize: '14px',
  },
  passwordCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  passwordText: {
    fontFamily: 'monospace',
  },
  toggleButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '4px',
  },
  deleteButton: {
    padding: '6px 12px',
    fontSize: '13px',
    border: '1px solid #dc3545',
    borderRadius: '4px',
    backgroundColor: 'white',
    color: '#dc3545',
    cursor: 'pointer',
  },
}

