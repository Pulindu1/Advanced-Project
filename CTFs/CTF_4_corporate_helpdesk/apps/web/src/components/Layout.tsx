import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path ? 'active' : '';

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <Link to="/dashboard" className="logo">
            IntraDesk KB
          </Link>
          <nav className="header-nav">
            <span>{user?.username}</span>
            <button onClick={logout}>Logout</button>
          </nav>
        </div>
      </header>

      <div className="main-container">
        <aside className="sidebar">
          <nav>
            <ul className="sidebar-nav">
              <li>
                <Link to="/dashboard" className={isActive('/dashboard')}>
                  Dashboard
                </Link>
              </li>
              <li>
                <Link to="/kb" className={isActive('/kb')}>
                  Knowledge Base
                </Link>
              </li>
              <li>
                <Link to="/report" className={isActive('/report')}>
                  Report Issue
                </Link>
              </li>
              <li>
                <Link to="/captures" className={isActive('/captures')}>
                  My Captures
                </Link>
              </li>
              <li>
                <a href="#" style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                  Tickets (Coming Soon)
                </a>
              </li>
              <li>
                <a href="#" style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                  Profile (Coming Soon)
                </a>
              </li>
            </ul>
          </nav>
        </aside>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
