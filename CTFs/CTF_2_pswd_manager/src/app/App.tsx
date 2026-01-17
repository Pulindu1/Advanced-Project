import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './providers/AuthProvider'
import { QueryProvider } from './providers/QueryProvider'
import { AppShell } from './layout/AppShell'
import { AuthLayout } from './layout/AuthLayout'
import { ProtectedRoute } from './layout/ProtectedRoute'

import { LoginPage } from "../features/auth/pages/LoginPage";
import { RegisterPage } from "../features/auth/pages/RegisterPage";
import { ForgotPasswordPage } from "../features/auth/pages/ForgotPasswordPage";

import { VaultPage } from "../features/vault/pages/VaultPage";
import { VaultEntryPage } from "../features/vault/pages/VaultEntryPage";
import { ChallengePage } from "../features/challenge/pages/ChallengePage";
import { TeamsPage } from "../features/teams/pages/TeamsPage";
import { ActivityPage } from "../features/activity/pages/ActivityPage";
import { SettingsPage } from "../features/settings/pages/SettingsPage";

export function App() {
  return (
    <AuthProvider>
      <QueryProvider>
        <Routes>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          </Route>

          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route path="/app/vault" element={<VaultPage />} />
            <Route path="/app/vault/:entryId" element={<VaultEntryPage />} />
            <Route path="/app/challenge" element={<ChallengePage />} />
            <Route path="/app/teams" element={<TeamsPage />} />
            <Route path="/app/activity" element={<ActivityPage />} />
            <Route path="/app/settings" element={<SettingsPage />} />
          </Route>

          <Route path="/" element={<Navigate to="/app/vault" replace />} />
        </Routes>
      </QueryProvider>
    </AuthProvider>
  )
}
