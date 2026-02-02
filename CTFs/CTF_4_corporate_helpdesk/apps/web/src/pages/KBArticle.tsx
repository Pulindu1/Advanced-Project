import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';

interface Article {
  id: number;
  title: string;
  body: string;
  tags: string[];
  created_at: string;
}

export default function KBArticle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadArticle();
  }, [id]);

  async function loadArticle() {
    try {
      const response = await api.get(`/kb/articles/${id}`);
      setArticle(response.data.article);
    } catch (err) {
      setError('Article not found');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="loading">Loading article...</div>;
  }

  if (error || !article) {
    return (
      <div className="empty-state">
        <h3>Article not found</h3>
        <button className="btn btn-primary" onClick={() => navigate('/kb')}>
          Back to Knowledge Base
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        className="btn btn-secondary"
        onClick={() => navigate('/kb')}
        style={{ marginBottom: '1rem' }}
      >
        ← Back to Knowledge Base
      </button>

      <div className="card">
        <h1 style={{ marginBottom: '1rem' }}>{article.title}</h1>
        
        <div className="tags" style={{ marginBottom: '2rem' }}>
          {article.tags.map(tag => (
            <span key={tag} className="tag">{tag}</span>
          ))}
        </div>

        <div style={{ lineHeight: '1.8', color: '#333', whiteSpace: 'pre-wrap' }}>
          {article.body}
        </div>

        <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #e0e0e0', color: '#999' }}>
          <small>
            Created: {new Date(article.created_at).toLocaleDateString()}
          </small>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1rem', backgroundColor: '#f0f7ff' }}>
        <p style={{ margin: 0, color: '#0066cc' }}>
          💡 <strong>Helpful?</strong> Share this article link with your team or{' '}
          <a href="/report" style={{ color: '#0066cc', textDecoration: 'underline' }}>
            report an issue
          </a>
          {' '}if you notice something wrong.
        </p>
      </div>
    </div>
  );
}
