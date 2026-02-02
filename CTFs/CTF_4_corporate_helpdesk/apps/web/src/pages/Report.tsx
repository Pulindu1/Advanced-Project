import { useState, useEffect } from 'react';
import api from '../api';

interface Report {
  id: number;
  url: string;
  status: string;
  created_at: string;
  visited_at: string | null;
}

export default function Report() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [reports, setReports] = useState<Report[]>([]);

  useEffect(() => {
    loadMyReports();
  }, []);

  async function loadMyReports() {
    try {
      const response = await api.get('/report/my-reports');
      setReports(response.data.reports);
    } catch (err) {
      console.error('Failed to load reports:', err);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await api.post('/report', { url });
      setSuccess('Report submitted successfully! A moderator will review it shortly.');
      setUrl('');
      loadMyReports();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit report');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 style={{ marginBottom: '2rem' }}>Report an Issue</h1>

      <div className="card">
        <h2>Submit a Report</h2>
        <p style={{ color: '#666', marginBottom: '1.5rem' }}>
          Found suspicious content or errors in the Knowledge Base? Report KB URLs to our
          security team for review. Our moderators will visit the link and investigate.
        </p>

        <div className="alert alert-info" style={{ marginBottom: '1.5rem' }}>
          <strong>📌 Note:</strong> Only Knowledge Base URLs (/kb paths) can be reported.
          The security team will visit your submitted URL to verify the issue.
        </div>

        {success && (
          <div className="alert alert-success">
            {success}
          </div>
        )}

        {error && (
          <div className="alert alert-danger">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="url">Knowledge Base URL</label>
            <input
              type="text"
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://localhost:5173/kb?search=example"
              required
            />
            <small style={{ color: '#999', marginTop: '0.5rem', display: 'block' }}>
              Example: http://localhost:5173/kb?search=password or /kb?tag=security
            </small>
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Submitting...' : 'Submit Report'}
          </button>
        </form>
      </div>

      <div className="card" style={{ marginTop: '2rem' }}>
        <h2>My Reports</h2>
        {reports.length === 0 ? (
          <p style={{ color: '#999' }}>No reports submitted yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                  <th style={{ padding: '1rem', textAlign: 'left' }}>URL</th>
                  <th style={{ padding: '1rem', textAlign: 'left' }}>Status</th>
                  <th style={{ padding: '1rem', textAlign: 'left' }}>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {reports.map(report => (
                  <tr key={report.id} style={{ borderBottom: '1px solid #e0e0e0' }}>
                    <td style={{ padding: '1rem', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {report.url}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span
                        style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '12px',
                          fontSize: '0.875rem',
                          backgroundColor: report.status === 'visited' ? '#d4edda' : 
                                         report.status === 'error' ? '#f8d7da' : '#fff3cd',
                          color: report.status === 'visited' ? '#155724' : 
                                report.status === 'error' ? '#721c24' : '#856404',
                        }}
                      >
                        {report.status}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', color: '#666' }}>
                      {new Date(report.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
