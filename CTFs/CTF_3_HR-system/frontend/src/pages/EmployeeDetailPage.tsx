import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useParams, Link } from 'react-router-dom'
import { employeesApi, EmployeeDetail } from '../api/client'

export function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { token, user } = useAuth()
  const [employee, setEmployee] = useState<EmployeeDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token || !id) return
    employeesApi.get(token, Number(id))
      .then(res => setEmployee(res.employee))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [token, id])

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>
  if (error) return <div className="alert alert-error" style={{ margin: 24 }}>{error}</div>
  if (!employee) return <div style={{ padding: 24 }}>Employee not found</div>

  const canViewSensitive = user?.role === 'admin' || user?.role === 'hr' || user?.id === employee.user?.id

  return (
    <div style={{ padding: 24 }}>
      <Link to="/employees" style={{ color: '#1a73e8', marginBottom: 16, display: 'inline-block' }}>
        ← Back to Employees
      </Link>

      <div className="card">
        <div style={styles.header}>
          <div>
            <h1 style={styles.name}>{employee.user.first_name} {employee.user.last_name}</h1>
            <p style={styles.position}>{employee.position}</p>
          </div>
          <span className={`badge badge-${employee.department?.toLowerCase() || 'employee'}`}>
            {employee.employee_id}
          </span>
        </div>

        <div style={styles.grid}>
          <InfoRow label="Email" value={employee.user.email} />
          <InfoRow label="Department" value={employee.department} />
          <InfoRow label="Position" value={employee.position} />
          <InfoRow label="Hire Date" value={employee.hire_date} />
          
          {canViewSensitive && (
            <>
              <InfoRow label="Salary" value={employee.salary ? `$${employee.salary.toLocaleString()}` : '-'} />
              <InfoRow label="Phone" value={employee.phone || '-'} />
              <InfoRow label="Address" value={employee.address || '-'} />
              <InfoRow label="Emergency Contact" value={employee.emergency_contact || '-'} />
            </>
          )}
        </div>

        {canViewSensitive && employee.notes && (
          <div style={{ marginTop: 24 }}>
            <h4>Notes</h4>
            <p style={{ color: '#5f6368' }}>{employee.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.infoRow}>
      <span style={styles.label}>{label}</span>
      <span style={styles.value}>{value}</span>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    paddingBottom: 24,
    borderBottom: '1px solid #e8eaed',
  },
  name: {
    fontSize: 24,
    fontWeight: 600,
    margin: 0,
  },
  position: {
    color: '#5f6368',
    marginTop: 4,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 16,
  },
  infoRow: {
    display: 'flex',
    flexDirection: 'column',
  },
  label: {
    fontSize: 12,
    color: '#9aa0a6',
    marginBottom: 4,
  },
  value: {
    fontSize: 14,
    color: '#202124',
  },
}
