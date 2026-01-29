import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { EmployeesPage } from './pages/EmployeesPage'
import { EmployeeDetailPage } from './pages/EmployeeDetailPage'
import { DepartmentsPage } from './pages/DepartmentsPage'
import { PayPage } from './pages/PayPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return <div style={{ padding: 24 }}>Loading...</div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function AppRoutes() {
  const { isAuthenticated } = useAuth()

  return (
    <Layout>
      <Routes>
        <Route 
          path="/login" 
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} 
        />
        <Route 
          path="/dashboard" 
          element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} 
        />
        <Route 
          path="/employees" 
          element={<ProtectedRoute><EmployeesPage /></ProtectedRoute>} 
        />
        <Route 
          path="/employees/:id" 
          element={<ProtectedRoute><EmployeeDetailPage /></ProtectedRoute>} 
        />
        <Route 
          path="/departments" 
          element={<ProtectedRoute><DepartmentsPage /></ProtectedRoute>} 
        />
        <Route 
          path="/pay" 
          element={<ProtectedRoute><PayPage /></ProtectedRoute>} 
        />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
