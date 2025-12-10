import React from 'react'
import { Outlet, Link } from 'react-router-dom'
import './appshell.css'

export const AppShell: React.FC = () => {
  return (
    <div className="app-shell bg-app">
      <aside className="sidebar">
        <div className="mb-3">
          <div className="brand">CTF Vault</div>
          <small className="muted">Secure & modular</small>
        </div>
        <nav>
          <ul className="list-unstyled">
            <li className="mb-2"><Link to="/app/vault" className="text-decoration-none"><i className="bi bi-folder2-open me-2"></i>My Vault</Link></li>
            <li className="mb-2"><Link to="/app/teams" className="text-decoration-none"><i className="bi bi-people-fill me-2"></i>Teams</Link></li>
            <li className="mb-2"><Link to="/app/activity" className="text-decoration-none"><i className="bi bi-graph-up me-2"></i>Activity</Link></li>
            <li className="mb-2"><Link to="/app/settings" className="text-decoration-none"><i className="bi bi-gear-fill me-2"></i>Settings</Link></li>
          </ul>
        </nav>
      </aside>
      <main className="content">
        <header className="topbar d-flex justify-content-between px-3">
          <div className="d-flex align-items-center">
            <i className="bi bi-shield-lock-fill me-2 text-primary" style={{fontSize:20}}></i>
            <div className="brand">CTF Password Manager</div>
          </div>
          <div className="d-flex align-items-center muted">
            <i className="bi bi-person-circle me-2"></i> <span>demo user</span>
          </div>
        </header>
        <section className="pane container-fluid">
          <Outlet />
        </section>
      </main>
    </div>
  )
}
