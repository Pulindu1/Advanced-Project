import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { departmentsApi, Department } from '../api/client'
import { Link } from 'react-router-dom'

export function DepartmentsPage() {
  const { token } = useAuth()
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    departmentsApi.list(token)
      .then(res => setDepartments(res.departments))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [token])

  return (
    <div style={{ padding: 24 }}>
      <h1 style={styles.title}>Departments</h1>

      <div className="card">
        {loading ? (
          <p>Loading departments...</p>
        ) : departments.length === 0 ? (
          <p style={{ color: '#9aa0a6' }}>No departments found</p>
        ) : (
          <div style={styles.grid}>
            {departments.map(dept => (
              <Link
                key={dept.id}
                to={`/departments/${dept.id}`}
                style={styles.deptCard}
              >
                <div style={styles.deptCode}>{dept.code}</div>
                <div style={styles.deptName}>{dept.name}</div>
                <div style={styles.deptCount}>{dept.employees_count} employees</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  title: {
    fontSize: 28,
    fontWeight: 600,
    marginBottom: 16,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 16,
  },
  deptCard: {
    display: 'block',
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    textDecoration: 'none',
    color: 'inherit',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  deptCode: {
    fontSize: 12,
    fontWeight: 600,
    color: '#1a73e8',
    marginBottom: 8,
  },
  deptName: {
    fontSize: 18,
    fontWeight: 500,
    marginBottom: 8,
  },
  deptCount: {
    fontSize: 14,
    color: '#5f6368',
  },
}
