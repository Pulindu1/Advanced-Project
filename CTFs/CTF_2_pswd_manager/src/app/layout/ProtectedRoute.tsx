import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthContext } from '../providers/AuthProvider'

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthContext()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}
