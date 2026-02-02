import { useState, useEffect } from 'react';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const searchTerm = searchParams.get('search') || '';
  const selectedTag = searchParams.get('tag') || '';

  useEffect(() => {
    loadArticles();
    loadTags();
  }, [searchParams]);

  async function loadArticles() {
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (selectedTag) params.append('tag', selectedTag);

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
    
    setSearchParams(params);
  }

  function handleTagFilter(tag: string) {
    const params = new URLSearchParams();
    if (searchTerm) params.append('search', searchTerm);
    if (tag !== selectedTag) params.append('tag', tag);
    
    setSearchParams(params);
  }

  function renderResultsHeader() {
    const resultsDiv = document.getElementById('results-header');
    if (!resultsDiv) return null;

    // ⚠️ VULNERABILITY: DOM XSS via innerHTML
    // This is the intentional bug for the CTF
    let headerHTML = '<h2>';
    if (searchTerm) {
      // Unsafe: directly inserting user input into innerHTML
      headerHTML += 'Results for "' + searchTerm + '"';
    } else if (selectedTag) {
      headerHTML += 'Articles tagged: ' + selectedTag;
    } else {
      headerHTML += 'All Articles';
    }
    headerHTML += '</h2>';

    resultsDiv.innerHTML = headerHTML;
  }

  useEffect(() => {
    renderResultsHeader();
  }, [searchTerm, selectedTag]);

  if (loading) {
    return <div className="loading">Loading articles...</div>;
  }

  return (
    <div>
      <h1 style={{ marginBottom: '2rem' }}>Knowledge Base</h1>

      <div className="search-bar">
        <form onSubmit={handleSearch}>
          <input
            type="text"
            name="search"
            className="search-input"
            placeholder="Search knowledge base..."
            defaultValue={searchTerm}
          />
        </form>
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

      {/* This div will have its innerHTML set by the vulnerable function */}
      <div id="results-header"></div>

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
              <p style={{ margin: '0.5rem 0' }}>
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
