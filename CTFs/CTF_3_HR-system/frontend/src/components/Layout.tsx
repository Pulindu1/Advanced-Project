import React, { ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout, isAuthenticated } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  if (!isAuthenticated) {
    return <>{children}</>
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const navItems = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/employees', label: 'Employees' },
    { path: '/departments', label: 'Departments' },
    { path: '/pay', label: 'Pay' },
  ]

  if (user?.role === 'admin') {
    navItems.push({ path: '/audit-logs', label: 'Audit Logs' })
  }

  return (
    <div style={styles.container}>
      <nav style={styles.sidebar}>
        <div style={styles.logo}>
          <h2 style={styles.logoText}>HR System</h2>
        </div>

        <div style={styles.nav}>
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              style={{
                ...styles.navItem,
                ...(location.pathname.startsWith(item.path) ? styles.navItemActive : {}),
              }}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div style={styles.userSection}>
          <div style={styles.userName}>
            {user?.first_name} {user?.last_name}
          </div>
          <div style={styles.userRole}>
            <span className={`badge badge-${user?.role}`}>{user?.role}</span>
          </div>
          <button onClick={handleLogout} style={styles.logoutBtn}>
            Sign Out
          </button>
        </div>
      </nav>

      <main style={styles.main}>
        {children}
      </main>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    minHeight: '100vh',
  },
  sidebar: {
    width: 240,
    backgroundColor: '#202124',
    color: 'white',
    display: 'flex',
    flexDirection: 'column',
  },
  logo: {
    padding: 24,
    borderBottom: '1px solid #3c4043',
  },
  logoText: {
    margin: 0,
    fontSize: 20,
    fontWeight: 600,
  },
  nav: {
    flex: 1,
    padding: '16px 0',
  },
  navItem: {
    display: 'block',
    padding: '12px 24px',
    color: '#9aa0a6',
    textDecoration: 'none',
    fontSize: 14,
    transition: 'all 0.2s',
  },
  navItemActive: {
    color: 'white',
    backgroundColor: '#3c4043',
    borderLeft: '3px solid #1a73e8',
  },
  userSection: {
    padding: 24,
    borderTop: '1px solid #3c4043',
  },
  userName: {
    fontWeight: 500,
    marginBottom: 4,
  },
  userRole: {
    marginBottom: 16,
  },
  logoutBtn: {
    width: '100%',
    padding: '8px 16px',
    backgroundColor: 'transparent',
    border: '1px solid #5f6368',
    borderRadius: 4,
    color: '#9aa0a6',
    cursor: 'pointer',
    fontSize: 14,
  },
  main: {
    flex: 1,
    backgroundColor: '#f5f7fa',
    overflow: 'auto',
  },
}
