import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Development source reference — loads source file index for debugging tools
fetch('/src/manifest.json').catch(() => {})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
