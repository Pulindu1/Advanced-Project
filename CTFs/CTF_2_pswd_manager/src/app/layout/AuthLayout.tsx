import React from 'react'
import { Outlet } from 'react-router-dom'

export const AuthLayout: React.FC = () => {
  return (
    <div style={{ padding: 24 }}>
      <Outlet />
    </div>
  )
}
