import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api';

interface Article {
  id: number;
  title: string;
  body: string;
  tags: string[];
  created_at: string;
}

export default function KnowledgeBase() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const searchTerm = searchParams.get('search') || '';
  const selectedTag = searchParams.get('tag') || '';
  const sortBy = searchParams.get('sort') || 'recent';

  useEffect(() => {
    loadArticles();
    loadTags();
  }, [searchParams]);

  // ⚠️ VULNERABILITY: DOM XSS via innerHTML + eval
  // Callback ref fires the instant the h2 element is mounted to the DOM
  const headerCallbackRef = useCallback((node: HTMLHeadingElement | null) => {
    if (node) {
      const urlParams = new URLSearchParams(window.location.search);
      const rawSearch = urlParams.get('search') || '';
      const rawTag = urlParams.get('tag') || '';

      // Unsafe: directly inserting user input into HTML using innerHTML
      let headerHTML = '';
      if (rawSearch) {
        headerHTML = 'Results for "' + rawSearch + '"';
      } else if (rawTag) {
        headerHTML = 'Articles tagged: ' + rawTag;
      } else {
        headerHTML = 'All Articles';
      }
      node.innerHTML = headerHTML;

      // Unsafe: directly executing user-supplied JavaScript
      const callback = urlParams.get('callback');
      if (callback) {
        try {
          // eslint-disable-next-line no-eval
          eval(callback);
        } catch (e) {
          console.error('Callback error:', e);
        }
      }
    }
  }, [searchTerm, selectedTag]);

  async function loadArticles() {
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (selectedTag) params.append('tag', selectedTag);
      if (sortBy) params.append('sort', sortBy === 'relevant' ? 'title' : 'created_at');

      const response = await api.get(`/kb/articles?${params}`);
      setArticles(response.data.articles);
    } catch (error) {
      console.error('Failed to load articles:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadTags() {
    try {
      const response = await api.get('/kb/tags');
      setTags(response.data.tags);
    } catch (error) {
      console.error('Failed to load tags:', error);
    }
  }

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const search = formData.get('search') as string;
    
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (selectedTag) params.append('tag', selectedTag);
    if (sortBy) params.append('sort', sortBy);
    
    setSearchParams(params);
  }

  function handleTagFilter(tag: string) {
    const params = new URLSearchParams();
    if (searchTerm) params.append('search', searchTerm);
    if (tag !== selectedTag) params.append('tag', tag);
    if (sortBy) params.append('sort', sortBy);
    
    setSearchParams(params);
  }

  function handleSortChange(sort: string) {
    const params = new URLSearchParams();
    if (searchTerm) params.append('search', searchTerm);
    if (selectedTag) params.append('tag', selectedTag);
    params.append('sort', sort);
    
    setSearchParams(params);
  }

  async function handleShareSearch() {
    try {
      const url = window.location.href;
      await navigator.clipboard.writeText(url);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  }

  if (loading) {
    return <div className="loading">Loading articles...</div>;
  }

  return (
    <div>
      <h1 style={{ marginBottom: '2rem' }}>Knowledge Base</h1>

      <div className="search-bar" style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
        <form onSubmit={handleSearch} style={{ flex: 1 }}>
          <input
            type="text"
            name="search"
            className="search-input"
            placeholder="Search knowledge base..."
            defaultValue={searchTerm}
          />
        </form>
        
        <select 
          value={sortBy} 
          onChange={(e) => handleSortChange(e.target.value)}
          style={{ 
            padding: '0.75rem 1rem',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '1rem',
            cursor: 'pointer'
          }}
        >
          <option value="recent">Most Recent</option>
          <option value="relevant">A-Z</option>
        </select>

        <button
          onClick={handleShareSearch}
          className="btn btn-secondary"
          style={{ whiteSpace: 'nowrap' }}
        >
          {copySuccess ? '✓ Copied!' : '🔗 Share Search'}
        </button>
      </div>

      {tags.length > 0 && (
        <div className="filters">
          <strong style={{ marginRight: '1rem' }}>Filter by tag:</strong>
          {tags.map(tag => (
            <span
              key={tag}
              className={`filter-chip ${selectedTag === tag ? 'active' : ''}`}
              onClick={() => handleTagFilter(tag)}
            >
              {tag}
            </span>
          ))}
          {selectedTag && (
            <span
              className="filter-chip"
              onClick={() => handleTagFilter('')}
              style={{ backgroundColor: '#f44336', color: 'white' }}
            >
              Clear filter
            </span>
          )}
        </div>
      )}

      {/* Vulnerable: XSS via innerHTML + eval in callback ref */}
      <h2 ref={headerCallbackRef}></h2>

      {articles.length === 0 ? (
        <div className="empty-state">
          <h3>No articles found</h3>
          <p>Try adjusting your search or filters</p>
        </div>
      ) : (
        <div style={{ marginTop: '2rem' }}>
          {articles.map(article => (
            <div
              key={article.id}
              className="list-item"
              onClick={() => navigate(`/kb/${article.id}`)}
            >
              <h3>{article.title}</h3>
              <p style={{ margin: '0.5rem 0', color: '#666', fontSize: '0.95rem' }}>
                {article.body.substring(0, 200)}
                {article.body.length > 200 ? '...' : ''}
              </p>
              <div className="tags">
                {article.tags.map(tag => (
                  <span key={tag} className="tag">{tag}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
