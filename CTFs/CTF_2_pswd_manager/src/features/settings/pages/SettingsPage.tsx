import React from 'react'
import { useAuthContext } from '../../../app/providers/AuthProvider'
import { useNavigate } from 'react-router-dom'

export const SettingsPage: React.FC = () => {
  const { logout, user } = useAuthContext()
  const navigate = useNavigate()

  const handleLogout = () => {
    // simple confirmation to avoid accidental logout
    const ok = window.confirm('Are you sure you want to sign out?')
    if (!ok) return
    logout()
    navigate('/login')
  }

  return (
    <div>
      <h2>Settings</h2>
      <p className="muted">Profile and security settings live here.</p>

      <div className="card-ghost mt-4">
        <h5>Account</h5>
        <p className="muted">Signed in as <strong>{user?.username ?? 'unknown'}</strong></p>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary" onClick={() => navigate('/app/settings')}>Manage profile</button>
          <button className="btn btn-danger ms-auto" onClick={handleLogout}><i className="bi bi-box-arrow-right me-1"></i>Sign out</button>
        </div>
      </div>
    </div>
  )
}
