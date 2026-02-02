import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div>
      <h1 style={{ marginBottom: '2rem' }}>Welcome to IntraDesk KB</h1>

      <div className="card">
        <h2>👋 Hello, {user?.email}</h2>
        <p style={{ marginTop: '1rem', color: '#666' }}>
          Welcome to the IntraDesk Knowledge Base and Helpdesk system.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>📖 Knowledge Base</h3>
          <p style={{ color: '#666', marginBottom: '1rem' }}>
            Search our comprehensive knowledge base for answers to common questions and procedures.
          </p>
          <a href="/kb" className="btn btn-primary">Browse Knowledge Base</a>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>🚨 Report an Issue</h3>
          <p style={{ color: '#666', marginBottom: '1rem' }}>
            Found something suspicious? Report KB URLs to our security team for review.
          </p>
          <a href="/report" className="btn btn-secondary">Submit Report</a>
        </div>

        <div className="card" style={{ opacity: 0.6 }}>
          <h3 style={{ marginBottom: '1rem' }}>🎫 Support Tickets</h3>
          <p style={{ color: '#666', marginBottom: '1rem' }}>
            Create and track support tickets for IT assistance.
          </p>
          <button className="btn btn-secondary" disabled>Coming Soon</button>
        </div>
      </div>

      <div className="card" style={{ marginTop: '2rem', backgroundColor: '#fff3cd', border: '1px solid #ffc107' }}>
        <h3 style={{ marginBottom: '0.5rem' }}>💡 Quick Tip</h3>
        <p style={{ color: '#856404' }}>
          KB search links are often shared with moderators for review. Use the "Report an Issue" feature
          to flag suspicious or incorrect content.
        </p>
      </div>
    </div>
  );
}
