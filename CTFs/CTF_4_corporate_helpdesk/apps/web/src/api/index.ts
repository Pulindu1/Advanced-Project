import axios from 'axios';

// Use relative URL for API calls so they're proxied by Vite in development
// and work correctly in both Docker network and from host
const API_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
