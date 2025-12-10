import React from 'react'
import { Outlet, Link } from 'react-router-dom'
import './appshell.css'

export const AppShell: React.FC = () => {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h3>Vault</h3>
        <nav>
          <ul>
            <li><Link to="/app/vault">My Vault</Link></li>
            <li><Link to="/app/teams">Teams</Link></li>
            <li><Link to="/app/activity">Activity</Link></li>
            <li><Link to="/app/settings">Settings</Link></li>
          </ul>
        </nav>
      </aside>
      <main className="content">
        <header className="topbar">Password Manager</header>
        <section className="pane">
          <Outlet />
        </section>
      </main>
    </div>
  )
}
