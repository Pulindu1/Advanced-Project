import React from 'react'
import { useAuth } from '../context/AuthContext'

export function FlagPage() {
  const { user } = useAuth()

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>🏁 Flag Challenge</h1>
        <p style={styles.subtitle}>Congratulations on accessing the flag page!</p>
      </div>

      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <h2 style={styles.cardTitle}>Flag 1 - Basic Access</h2>
        </div>
        <div style={styles.cardBody}>
          <p style={styles.description}>
            Welcome to the HR System CTF, {user?.first_name}! You've successfully logged in and found the first flag.
          </p>
          
          <div style={styles.flagContainer}>
            <div style={styles.flagLabel}>FLAG 1:</div>
            <div style={styles.flagValue}>durham-hr{'{'}w3lc0m3_t0_hr_syst3m{'}'}</div>
          </div>

          
        </div>
      </div>

      <div style={styles.infoCard}>
        <h3 style={styles.infoTitle}>Challenge Overview</h3>
        <p style={styles.infoText}>
          This CTF contains 4 flags total. Each flag builds upon the previous one:
        </p>
        <ul style={styles.list}>
          <li><strong>Flag 1:</strong> Path traversal ✅</li>
          <li><strong>Flag 2:</strong> Encryption key discovery </li>
          <li><strong>Flag 3:</strong> Advanced exploitation</li>
          <li><strong>Flag 4:</strong> Cryptographic challenge</li>
        </ul>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: 32,
    maxWidth: 900,
    margin: '0 auto',
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 700,
    color: '#1a1a1a',
    margin: 0,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    margin: 0,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 8,
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    marginBottom: 24,
  },
  cardHeader: {
    padding: 24,
    borderBottom: '1px solid #e5e7eb',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 600,
    margin: 0,
    color: '#1a1a1a',
  },
  cardBody: {
    padding: 24,
  },
  description: {
    fontSize: 15,
    lineHeight: 1.6,
    color: '#4b5563',
    marginBottom: 24,
  },
  flagContainer: {
    backgroundColor: '#f0fdf4',
    border: '2px solid #22c55e',
    borderRadius: 8,
    padding: 20,
    marginBottom: 24,
  },
  flagLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: '#15803d',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  flagValue: {
    fontFamily: 'Monaco, Consolas, "Courier New", monospace',
    fontSize: 18,
    fontWeight: 600,
    color: '#15803d',
    wordBreak: 'break-all',
  },
  hint: {
    backgroundColor: '#fef3c7',
    border: '1px solid #fbbf24',
    borderRadius: 6,
    padding: 16,
    fontSize: 14,
    color: '#92400e',
  },
  infoCard: {
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    padding: 24,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 600,
    margin: 0,
    marginBottom: 16,
    color: '#1a1a1a',
  },
  infoText: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 12,
  },
  list: {
    fontSize: 14,
    color: '#4b5563',
    paddingLeft: 24,
    margin: 0,
  },
}
