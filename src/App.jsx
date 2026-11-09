import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { Spinner } from './components/ui'
import Auth        from './pages/Auth'
import Dashboard   from './pages/Dashboard'
import Project     from './pages/Project'
import ClientView  from './pages/ClientView'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <Spinner />
    </div>
  )
  return user ? children : <Navigate to="/auth" replace />
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <Spinner />
    </div>
  )

  return (
    <Routes>
      <Route path="/auth"          element={user ? <Navigate to="/dashboard" replace /> : <Auth />} />
      <Route path="/dashboard"     element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/project/:id"   element={<PrivateRoute><Project /></PrivateRoute>} />
      <Route path="/client/:token" element={<ClientView />} />
      <Route path="/"              element={<Navigate to={user ? '/dashboard' : '/auth'} replace />} />
      <Route path="*"              element={<Navigate to="/" replace />} />
    </Routes>
  )
}
