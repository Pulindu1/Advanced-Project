import React, { useState } from 'react'
import { CreateVaultEntryDto } from '../api/vaultApi'

interface AddEntryModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (entry: CreateVaultEntryDto) => Promise<void>
}

export const AddEntryModal: React.FC<AddEntryModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [site, setSite] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      await onSubmit({ site, username, password, notes })
      // Reset form
      setSite('')
      setUsername('')
      setPassword('')
      setNotes('')
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to add entry')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      setSite('')
      setUsername('')
      setPassword('')
      setNotes('')
      setError('')
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div style={styles.overlay} onClick={handleClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Add New Login</h2>
          <button style={styles.closeButton} onClick={handleClose} disabled={isSubmitting}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          {error && <div style={styles.error}>{error}</div>}

          <div style={styles.formGroup}>
            <label style={styles.label}>Website/App *</label>
            <input
              type="text"
              value={site}
              onChange={(e) => setSite(e.target.value)}
              placeholder="example.com"
              required
              style={styles.input}
              disabled={isSubmitting}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Username *</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="your_username"
              required
              style={styles.input}
              disabled={isSubmitting}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Password *</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={styles.input}
              disabled={isSubmitting}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
              style={styles.textarea}
              disabled={isSubmitting}
              rows={3}
            />
          </div>

          <div style={styles.actions}>
            <button
              type="button"
              onClick={handleClose}
              style={styles.cancelButton}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button type="submit" style={styles.submitButton} disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '24px',
    width: '90%',
    maxWidth: '500px',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  title: {
    margin: 0,
    fontSize: '24px',
    fontWeight: 600,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '32px',
    cursor: 'pointer',
    color: '#666',
    padding: '0',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#333',
  },
  input: {
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    outline: 'none',
  },
  textarea: {
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    outline: 'none',
    fontFamily: 'inherit',
    resize: 'vertical',
  },
  error: {
    padding: '10px',
    backgroundColor: '#fee',
    color: '#c33',
    borderRadius: '4px',
    fontSize: '14px',
  },
  actions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
    marginTop: '8px',
  },
  cancelButton: {
    padding: '10px 20px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    backgroundColor: 'white',
    cursor: 'pointer',
  },
  submitButton: {
    padding: '10px 20px',
    fontSize: '14px',
    border: 'none',
    borderRadius: '4px',
    backgroundColor: '#007bff',
    color: 'white',
    cursor: 'pointer',
    fontWeight: 500,
  },
}
