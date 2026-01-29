import React, { useEffect, useState } from 'react'
import { payApi, PayData } from '../api/client'
import { useAuth } from '../context/AuthContext'

export function PayPage() {
  const { token, user } = useAuth()
  const [payData, setPayData] = useState<PayData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    loadPayData()
  }, [token])

  const loadPayData = async () => {
    if (!token) return
    
    try {
      setLoading(true)
      const response = await payApi.getMy(token)
      setPayData(response)
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Failed to load pay data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div style={styles.container}>Loading...</div>
  }

  if (error) {
    return <div style={styles.container}><div style={styles.error}>{error}</div></div>
  }

  if (!payData) {
    return <div style={styles.container}>No pay information available</div>
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>My Compensation</h1>
        <p style={styles.subtitle}>View your current compensation details</p>
      </div>

      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <h2 style={styles.cardTitle}>Employee Information</h2>
        </div>
        <div style={styles.cardBody}>
          <div style={styles.infoGrid}>
            <div style={styles.infoItem}>
              <div style={styles.infoLabel}>Employee ID</div>
              <div style={styles.infoValue}>{payData.employee_id}</div>
            </div>
            <div style={styles.infoItem}>
              <div style={styles.infoLabel}>Username</div>
              <div style={styles.infoValue}>{payData.username}</div>
            </div>
            <div style={styles.infoItem}>
              <div style={styles.infoLabel}>Department</div>
              <div style={styles.infoValue}>{payData.department}</div>
            </div>
            <div style={styles.infoItem}>
              <div style={styles.infoLabel}>Position</div>
              <div style={styles.infoValue}>{payData.position}</div>
            </div>
            <div style={styles.infoItem}>
              <div style={styles.infoLabel}>Hire Date</div>
              <div style={styles.infoValue}>{new Date(payData.hire_date).toLocaleDateString()}</div>
            </div>
          </div>
        </div>
      </div>

      <div style={styles.paySection}>
        <div style={styles.payCard}>
          <div style={styles.payLabel}>Monthly Pay</div>
          <div style={styles.payValue}>${payData.monthly_pay.toLocaleString()}</div>
          <div style={styles.payDescription}>Paid on the last business day of each month</div>
        </div>
        <div style={styles.payCard}>
          <div style={styles.payLabel}>Annual Salary</div>
          <div style={styles.payValue}>${payData.annual_pay.toLocaleString()}</div>
          <div style={styles.payDescription}>Total annual compensation</div>
        </div>
      </div>

      <div style={styles.footer}>
        <p style={styles.footerText}>
          For questions about your compensation, please contact HR at hr@company.internal
        </p>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: 24,
    maxWidth: 900,
    margin: '0 auto',
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 600,
    margin: '0 0 8px 0',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    margin: 0,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 8,
    border: '1px solid #dadce0',
    marginBottom: 24,
    overflow: 'hidden',
  },
  cardHeader: {
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderBottom: '1px solid #dadce0',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 600,
    margin: 0,
  },
  cardBody: {
    padding: 24,
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 20,
  },
  infoItem: {
    display: 'flex',
    flexDirection: 'column' as const,
  },
  infoLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    textTransform: 'uppercase' as const,
    fontWeight: 500,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: 500,
    color: '#202124',
  },
  paySection: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: 20,
    marginBottom: 24,
  },
  payCard: {
    backgroundColor: '#e8f0fe',
    padding: 24,
    borderRadius: 8,
    border: '1px solid #1a73e8',
  },
  payLabel: {
    fontSize: 14,
    color: '#1967d2',
    marginBottom: 8,
    fontWeight: 500,
  },
  payValue: {
    fontSize: 36,
    fontWeight: 600,
    color: '#1a73e8',
    marginBottom: 8,
  },
  payDescription: {
    fontSize: 12,
    color: '#5f6368',
  },
  footer: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    border: '1px solid #dadce0',
  },
  footerText: {
    fontSize: 13,
    color: '#5f6368',
    margin: 0,
    textAlign: 'center' as const,
  },
  error: {
    padding: 16,
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    borderRadius: 4,
    border: '1px solid #fee2e2',
  },
}
