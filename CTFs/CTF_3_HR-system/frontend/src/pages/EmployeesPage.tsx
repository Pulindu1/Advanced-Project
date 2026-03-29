import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { employeesApi, departmentsApi, EmployeeListItem, Department } from '../api/client'
import { Link } from 'react-router-dom'

export function EmployeesPage() {
  const { token, user } = useAuth()
  const [employees, setEmployees] = useState<EmployeeListItem[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState<number | ''>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    departmentsApi.list(token)
      .then(res => setDepartments(res.departments))
      .catch(console.error)
  }, [token])

  useEffect(() => {
    if (!token) return
    setLoading(true)
    employeesApi.list(token, {
      search: search || undefined,
      department_id: deptFilter || undefined,
    })
      .then(res => setEmployees(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [token, search, deptFilter])

  const canViewSalary = user?.role === 'admin' || user?.role === 'hr'

  return (
    <div style={{ padding: 24 }}>
      <div style={styles.header}>
        <h1 style={styles.title}>Employees</h1>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={styles.filters}>
          <input
            className="form-control"
            placeholder="Search by name or ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ maxWidth: 300 }}
          />
          <select
            className="form-control"
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value ? Number(e.target.value) : '')}
            style={{ maxWidth: 200 }}
          >
            <option value="">All Departments</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <p>Loading employees...</p>
        ) : employees.length === 0 ? (
          <p style={{ color: '#9aa0a6' }}>No employees found</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Department</th>
                <th>Position</th>
                {canViewSalary && <th>Salary</th>}
                <th>Hire Date</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => (
                <tr key={emp.id}>
                  <td>
                    <Link to={`/employees/${emp.id}`} style={{ color: '#1a73e8' }}>
                      {emp.employee_id}
                    </Link>
                  </td>
                  <td>{emp.user.first_name} {emp.user.last_name}</td>
                  <td>{emp.user.email}</td>
                  <td>{emp.department}</td>
                  <td>{emp.position}</td>
                  {canViewSalary && (
                    <td>${emp.salary?.toLocaleString() || '-'}</td>
                  )}
                  <td>{emp.hire_date}</td>
                  <td>{emp.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 600,
    margin: 0,
  },
  filters: {
    display: 'flex',
    gap: 16,
  },
}
