import React from 'react'
import { LoginForm } from '../components/LoginForm'

export const LoginPage: React.FC = () => {
  return (
    <div style={{ maxWidth: 420, margin: '0 auto' }}>
      <h2>Sign in</h2>
      <LoginForm />
    </div>
  )
}
