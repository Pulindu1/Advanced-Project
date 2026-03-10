import { useState, useEffect } from 'react';
import api from '../api';

interface Report {
  id: number;
  url: string;
  status: string;
  created_at: string;
  visited_at: string | null;
  visited_url: string | null;
  bot_console_logs: string | null;
}

export default function Report() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [reports, setReports] = useState<Report[]>([]);
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());

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
      const response = await api.post('/report', { url });
      setSuccess(`Report #${response.data.reportId} submitted! A moderator bot will review it shortly.`);
      setUrl('');
      loadMyReports();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit report');
    } finally {
      setLoading(false);
    }
  }

  function toggleLogs(id: number) {
    setExpandedLogs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function statusBadge(status: string) {
    const styles: Record<string, { bg: string; color: string }> = {
      visited: { bg: '#d4edda', color: '#155724' },
      error:   { bg: '#f8d7da', color: '#721c24' },
      queued:  { bg: '#fff3cd', color: '#856404' },
    };
    const s = styles[status] || { bg: '#e2e3e5', color: '#383d41' };
    return (
      <span style={{
        padding: '0.25rem 0.75rem',
        borderRadius: '12px',
        fontSize: '0.875rem',
        backgroundColor: s.bg,
        color: s.color,
      }}>
        {status}
      </span>
    );
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
          <strong>Note:</strong> Only Knowledge Base URLs (/kb paths) can be reported.
          The security team will visit your submitted URL to verify the issue. A bot will
          visit the URL you submit and append the report ID to it for tracking 
          (e.g. <code>http://localhost:5173/kb?search=example&_reportId=123</code>).
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {reports.map(report => (
              <div
                key={report.id}
                style={{
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  padding: '1.25rem',
                  background: '#fafafa',
                }}
              >
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <strong>Report #{report.id}</strong>
                  {statusBadge(report.status)}
                </div>

                {/* Submitted URL */}
                <div style={{ marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                  <span style={{ color: '#666' }}>Submitted URL: </span>
                  <code style={{ wordBreak: 'break-all', fontSize: '0.8rem' }}>{report.url}</code>
                </div>

                {/* Bot visited URL — shows _reportId appended by bot */}
                {report.visited_url && (
                  <div style={{
                    margin: '0.75rem 0',
                    padding: '0.6rem 0.75rem',
                    background: '#e8f4fd',
                    borderRadius: '4px',
                    borderLeft: '3px solid #0d6efd',
                    fontSize: '0.85rem',
                  }}>
                    <span style={{ color: '#0d6efd', fontWeight: 600 }}>🤖 Bot visited URL: </span>
                    <code style={{ wordBreak: 'break-all', fontSize: '0.8rem', color: '#333' }}>
                      {report.visited_url}
                    </code>
                  </div>
                )}

                {/* Timestamps */}
                <div style={{ display: 'flex', gap: '2rem', color: '#999', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                  <span>Submitted: {new Date(report.created_at).toLocaleString()}</span>
                  {report.visited_at && <span>Reviewed: {new Date(report.visited_at).toLocaleString()}</span>}
                </div>

                {/* Bot console logs — expandable */}
                {report.bot_console_logs && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <button
                      onClick={() => toggleLogs(report.id)}
                      style={{
                        fontSize: '0.8rem',
                        background: 'none',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        padding: '0.25rem 0.6rem',
                        cursor: 'pointer',
                        color: '#555',
                      }}
                    >
                      {expandedLogs.has(report.id) ? '▲ Hide' : '▼ Show'} bot console logs
                    </button>
                    {expandedLogs.has(report.id) && (
                      <pre style={{
                        marginTop: '0.5rem',
                        background: '#1e1e1e',
                        color: '#d4d4d4',
                        padding: '0.75rem',
                        borderRadius: '4px',
                        fontSize: '0.78rem',
                        overflow: 'auto',
                        maxHeight: '220px',
                        whiteSpace: 'pre-wrap',
                      }}>
                        {report.bot_console_logs}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
