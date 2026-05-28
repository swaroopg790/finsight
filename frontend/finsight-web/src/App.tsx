import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppShell        from './components/AppShell'
import LoginPage       from './pages/LoginPage'
import SignupPage      from './pages/SignupPage'
import DashboardPage   from './pages/DashboardPage'
import TransactionsPage from './pages/TransactionsPage'
import AlertsPage      from './pages/AlertsPage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
})

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('finsight_token')
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

function PrivateShell({ children }: { children: React.ReactNode }) {
  return (
    <PrivateRoute>
      <AppShell>{children}</AppShell>
    </PrivateRoute>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login"  element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/"             element={<PrivateShell><DashboardPage /></PrivateShell>} />
          <Route path="/transactions" element={<PrivateShell><TransactionsPage /></PrivateShell>} />
          <Route path="/alerts"       element={<PrivateShell><AlertsPage /></PrivateShell>} />
          <Route path="*"             element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
