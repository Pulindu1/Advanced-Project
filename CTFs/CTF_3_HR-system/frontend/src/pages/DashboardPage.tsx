import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { dashboardApi, DashboardStats, ActivityItem } from '../api/client'

export function DashboardPage() {
  const { user, token } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return

    Promise.all([
      dashboardApi.stats(token),
      dashboardApi.activity(token),
    ])
      .then(([statsRes, activityRes]) => {
        setStats(statsRes.stats)
        setActivity(activityRes.activity)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return <div style={{ padding: 24 }}>Loading dashboard...</div>
  }

  return (
    <div style={{ padding: 24 }}>
      <h1 style={styles.title}>Dashboard</h1>
      <p style={styles.welcome}>Welcome back, {user?.first_name}!</p>

      <div style={styles.statsGrid}>
        <StatCard label="Total Employees" value={stats?.total_employees || 0} />
        <StatCard label="Departments" value={stats?.total_departments || 0} />
        <StatCard label="Active Users" value={stats?.total_users || 0} />
        {stats?.recent_hires !== undefined && (
          <StatCard label="Recent Hires (30d)" value={stats.recent_hires} />
        )}
        {stats?.avg_salary !== undefined && (
          <StatCard label="Avg Salary" value={`$${Math.round(stats.avg_salary).toLocaleString()}`} />
        )}
        {stats?.audit_logs_today !== undefined && (
          <StatCard label="Actions Today" value={stats.audit_logs_today} />
        )}
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <h3 style={{ marginBottom: 16 }}>Recent Activity</h3>
        {activity.length === 0 ? (
          <p style={{ color: '#9aa0a6' }}>No recent activity</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Resource</th>
                <th>User</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {activity.map(item => (
                <tr key={item.id}>
                  <td>{item.action}</td>
                  <td>{item.resource_type} {item.resource_id ? `#${item.resource_id}` : ''}</td>
                  <td>{item.user || '-'}</td>
                  <td>{item.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card" style={styles.statCard}>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  title: {
    fontSize: 28,
    fontWeight: 600,
    marginBottom: 8,
  },
  welcome: {
    color: '#5f6368',
    marginBottom: 24,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 16,
  },
  statCard: {
    textAlign: 'center',
    padding: 20,
  },
  statValue: {
    fontSize: 32,
    fontWeight: 600,
    color: '#1a73e8',
  },
  statLabel: {
    color: '#5f6368',
    marginTop: 8,
  },
}
