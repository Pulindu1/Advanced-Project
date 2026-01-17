import React, { useState, useEffect } from 'react'
import { User, getTeamUsers } from '../api/teamsApi'

export const TeamsPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)
      setError('')
      const data = await getTeamUsers()
      setUsers(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div style={styles.container}>Loading...</div>
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Team Members</h2>
        <p style={styles.subtitle}>All users on this platform</p>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {users.length === 0 ? (
        <div style={styles.emptyState}>
          <p>No team members found.</p>
        </div>
      ) : (
        <div style={styles.usersGrid}>
          {users.map((user) => (
            <div key={user.username} style={styles.userCard}>
              <div style={styles.userIcon}>👤</div>
              <div style={styles.userInfo}>
                <div style={styles.username}>{user.username}</div>
                <div style={styles.userLabel}>ID</div>
              </div>
            </div>
          ))}
        </div>
      )}
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
    marginBottom: '32px',
  },
  title: {
    margin: '0 0 8px 0',
    fontSize: '28px',
    fontWeight: 600,
  },
  subtitle: {
    margin: 0,
    fontSize: '14px',
    color: '#666',
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
  usersGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '16px',
  },
  userCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    border: '1px solid #e9ecef',
  },
  userIcon: {
    fontSize: '32px',
    textAlign: 'center',
    minWidth: '48px',
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#333',
    marginBottom: '4px',
    fontFamily: 'monospace',
  },
  userLabel: {
    fontSize: '12px',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
}

