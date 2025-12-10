import React from 'react'
import { Outlet } from 'react-router-dom'

export const AuthLayout: React.FC = () => {
  return (
    <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        <div className="text-center mb-4">
          <i className="bi bi-shield-lock-fill" style={{ fontSize: 40, color: 'var(--accent)' }}></i>
          <h1 className="h4 mt-2 brand">CTF Vault</h1>
          <p className="muted">A secure, modular password manager skeleton — demo mode</p>
        </div>
        <div className="card-ghost">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
