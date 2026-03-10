import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

interface Capture {
  id: number;
  data: any;
  created_at: string;
  report_id: number;
  url: string;
}

export default function Captures() {
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadCaptures();
  }, []);

  async function loadCaptures() {
    try {
      const response = await api.get('/exfil/my-captures');
      setCaptures(response.data.captures);
    } catch (error: any) {
      if (error.response?.status === 401) {
        navigate('/login');
      }
      console.error('Failed to load captures:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="loading">Loading captures...</div>;
  }

  return (
    <div>
      <h1>My Captures</h1>
      <p style={{ color: '#666', marginBottom: '1rem' }}>
        If a script running elsewhere on this system sends data to the capture
        endpoint, it will appear here. Think of it as your personal drop box —
        anything posted here under your session is yours to read.
      </p>

      <div className="alert alert-info" style={{ marginBottom: '2rem' }}>
        <strong>How captures work:</strong>
        <br />
        When a bot visits a page containing your JavaScript payload, any data
        POSTed to <code>POST /api/exfil/capture</code> will appear here.
        <br /><br />
        Expected JSON body: <code>{'{"data": ..., "reportId": ...}'}</code>
        <br />
        No authentication required on that endpoint.
      </div>

      {captures.length === 0 ? (
        <div style={{
          padding: '2rem',
          background: '#f5f5f5',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <p>No captures yet. Submit a report to see exfiltrated data here.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {captures.map((capture) => (
            <div
              key={capture.id}
              style={{
                border: '1px solid #ddd',
                borderRadius: '8px',
                padding: '1.5rem',
                background: '#fff'
              }}
            >
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                marginBottom: '1rem',
                paddingBottom: '1rem',
                borderBottom: '1px solid #eee'
              }}>
                <div>
                  <strong>Report #{capture.report_id}</strong>
                  <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.25rem' }}>
                    {new Date(capture.created_at).toLocaleString()}
                  </div>
                </div>
                {capture.url && (
                  <div style={{ fontSize: '0.85rem', color: '#666', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {capture.url}
                  </div>
                )}
              </div>

              <div>
                <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Captured Data:</strong>
                <pre
                  style={{
                    background: '#f8f8f8',
                    padding: '1rem',
                    borderRadius: '4px',
                    overflow: 'auto',
                    maxHeight: '300px',
                    fontSize: '0.9rem'
                  }}
                >
                  {JSON.stringify(typeof capture.data === 'string' ? JSON.parse(capture.data) : capture.data, null, 2)}
                </pre>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
