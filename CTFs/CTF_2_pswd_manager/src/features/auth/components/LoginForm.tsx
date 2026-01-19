import React, { useState, useEffect } from 'react'
import { useAuthContext } from '../../../app/providers/AuthProvider'
import { useNavigate } from 'react-router-dom'

export const LoginForm: React.FC = () => {
  const { login } = useAuthContext()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null)
  const [remaining, setRemaining] = useState<number>(0)
  const navigate = useNavigate()

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(username, password)
      // navigate to the app vault after successful login
      navigate('/app/vault')
    } catch (err: any) {
      // Try to parse lockedUntil from API error text
      const msg = String(err?.message || '')
      try {
        const i = msg.indexOf(':')
        if (i !== -1) {
          const body = msg.slice(i + 1).trim()
          const parsed = JSON.parse(body)
          if (parsed && parsed.lockedUntil) {
            setCooldownUntil(Number(parsed.lockedUntil))
            try { localStorage.setItem('loginCooldownUntil', String(parsed.lockedUntil)) } catch (_) {}
            setError('Too many attempts — temporarily locked')
            setLoading(false)
            return
          }
        }
      } catch (_) {
        // ignore
      }
      setError(err?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  // on mount: restore persisted cooldown if present
  useEffect(() => {
    try {
      const v = localStorage.getItem('loginCooldownUntil')
      if (v) {
        const n = Number(v)
        if (!Number.isNaN(n) && n > Date.now()) setCooldownUntil(n)
      }
    } catch (_) {}
  }, [])

  // cooldown timer
  useEffect(() => {
    if (!cooldownUntil) {
      setRemaining(0)
      return
    }
    const update = () => {
      const ms = Math.max(0, cooldownUntil - Date.now())
      setRemaining(Math.ceil(ms / 1000))
      if (ms <= 0) {
        setCooldownUntil(null)
        try { localStorage.removeItem('loginCooldownUntil') } catch (_) {}
      }
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [cooldownUntil])

  return (
    <form onSubmit={onSubmit}>
      <div className="mb-3">
        <label className="form-label">Username</label>
        <div className="input-group">
          <span className="input-group-text"><i className="bi bi-person"></i></span>
          <input className="form-control" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. abcd12" />
        </div>
      </div>
      <div className="mb-3">
        <label className="form-label">Password</label>
        <div className="input-group">
          <span className="input-group-text"><i className="bi bi-lock"></i></span>
          <input className="form-control" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
      </div>
      {error && <div className="alert alert-danger py-2">{error}</div>}
      {cooldownUntil && (
        <div style={styles.modalOverlay} onClick={() => {}}>
          <div style={styles.modal}>
            <h4>Too many attempts</h4>
            <p>Please wait {remaining} second{remaining !== 1 ? 's' : ''} before trying again.</p>
          </div>
        </div>
      )}
      <div className="d-flex justify-content-between align-items-center">
        <button className="btn btn-primary" type="submit" disabled={loading || !!cooldownUntil}>{loading ? 'Signing in…' : 'Sign in'}</button>
        <a href="/forgot-password" className="muted">Forgot password?</a>
      </div>
    </form>
  )
}

const styles: Record<string, React.CSSProperties> = {
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
  },
  modal: {
    background: 'white',
    padding: 20,
    borderRadius: 8,
    minWidth: 260,
    textAlign: 'center',
    boxShadow: '0 6px 18px rgba(0,0,0,0.12)'
  }
}
