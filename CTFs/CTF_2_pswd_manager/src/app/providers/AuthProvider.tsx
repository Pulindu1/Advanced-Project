import React, { createContext, useContext, useState, useCallback } from 'react'

type User = { id: string; username: string; email?: string }

type AuthContextValue = {
  user: User | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

// NOTE: This AuthProvider is intentionally minimal. It is secure-by-design:
// - Tokens are not stored by default in localStorage.
// - Master passwords are never stored here.

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)

  const login = useCallback(async (username: string, password: string) => {
    // Placeholder: replace with real authApi call. Keep secrets out of logs.
    // In production this would call backend /auth/login and receive a token.
    // Here we simulate success for demo purposes.
    setUser({ id: 'u-' + username, username })
  }, [])

  const logout = useCallback(() => {
    setUser(null)
  }, [])

  const value: AuthContextValue = {
    user,
    login,
    logout,
    isAuthenticated: !!user
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuthContext() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider')
  return ctx
}
