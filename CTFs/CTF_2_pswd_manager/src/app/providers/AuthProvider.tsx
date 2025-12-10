import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'
import * as authApi from '../../features/auth/api/authApi'

type User = { username: string }

type AuthContextValue = {
  user: User | null
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  isAuthenticated: boolean
}

const AUTH_STORAGE_KEY = 'ctf2_auth_user'

function loadStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (raw) return JSON.parse(raw) as User
  } catch { /* ignore parse errors */ }
  return null
}

function saveUser(user: User | null) {
  if (user) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user))
  } else {
    localStorage.removeItem(AUTH_STORAGE_KEY)
  }
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Initialise from localStorage so user survives page refresh
  const [user, setUser] = useState<User | null>(loadStoredUser)

  // On mount also try the server whoami in case the cookie works
  useEffect(() => {
    (async () => {
      try {
        const res = await authApi.whoami()
        if (res && res.user) {
          setUser(res.user)
          saveUser(res.user)
        }
      } catch {
        // If whoami fails (401), trust local storage; don't clear it
      }
    })()
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const res = await authApi.login(username, password)
    if (res && res.user) {
      setUser(res.user)
      saveUser(res.user)
    } else {
      throw new Error('invalid response from auth')
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      setUser(null)
      saveUser(null)
    }
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
