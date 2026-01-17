import React, { useEffect, useState } from 'react'
import { getChallenge, solveChallenge } from '../api/challengeApi'

export const ChallengePage: React.FC = () => {
  const [nonce, setNonce] = useState('')
  const [difficulty, setDifficulty] = useState(4)
  const [suffix, setSuffix] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      setMessage(null)
      const data = await getChallenge()
      setNonce(data.nonce)
      setDifficulty(data.difficulty)
    } catch (err: any) {
      setMessage('Failed to fetch challenge: ' + (err.message || String(err)))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    try {
      const res = await solveChallenge(nonce, suffix)
      if (res && res.ok) {
        setMessage('Solved! Secret: ' + res.secret)
      } else {
        setMessage('Incorrect solution')
      }
    } catch (err: any) {
      setMessage('Error: ' + (err.message || String(err)))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <h2>Challenge: Proof of Work</h2>
      <p>Fetch the challenge, find a suffix so that <strong>sha256(nonce + suffix)</strong> has <strong>{difficulty}</strong> leading hex zeros.</p>

      <div style={{ margin: '16px 0', padding: 12, background: '#f8f9fa', borderRadius: 6 }}>
        <div><strong>Nonce:</strong> <code style={{ fontFamily: 'monospace' }}>{nonce}</code></div>
        <div><strong>Difficulty:</strong> {difficulty}</div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input style={{ flex: 1, padding: 8 }} placeholder="suffix (try small strings)" value={suffix} onChange={e => setSuffix(e.target.value)} />
        <button disabled={loading || !nonce} style={{ padding: '8px 12px' }} type="submit">Submit</button>
      </form>

      {message && <div style={{ marginTop: 12, padding: 10, background: '#fff3cd', borderRadius: 6 }}>{message}</div>}

      <h3>Console helper</h3>
      <p>Open your browser console and run the snippet below (replace <code>NONCE</code> and <code>DIFFICULTY</code>), it will try suffixes until it finds a match.</p>

      <pre style={{ background: '#eee', padding: 12, borderRadius: 6, overflowX: 'auto' }}>
{`async function sha256hex(s){const buf=new TextEncoder().encode(s);const h=await crypto.subtle.digest('SHA-256',buf);return Array.from(new Uint8Array(h)).map(b=>b.toString(16).padStart(2,'0')).join('')}
(async()=>{const nonce='NONCE';const difficulty=DIFFICULTY;let i=0;while(true){const suffix=i.toString(36);const h=await sha256hex(nonce+suffix);if(h.startsWith('0'.repeat(difficulty))){console.log('FOUND',suffix,h);break;}i++;if(i%1000===0)console.log('tried',i)}})()`}
      </pre>

    </div>
  )
}
