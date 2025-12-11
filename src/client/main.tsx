import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Route, Routes, Navigate, useLocation } from 'react-router-dom'
import './styles.css'
import 'leaflet/dist/leaflet.css'
import { Header } from './components/Header'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AuthProvider } from './lib/auth'
import { ThemeProvider } from './lib/theme'
import { ToastProvider } from './lib/toast'
import { Footer } from './components/Footer'
import { Home } from './pages/Home'
import { Report } from './pages/Report'
import { Track } from './pages/Track'
import { SignIn } from './pages/SignIn'
import { Dashboard } from './pages/Dashboard'
import { SignUp } from './pages/SignUp'
import { MyReports } from './pages/MyReports'
import { VerifyAccount } from './pages/VerifyAccount'

function AnimatedRoutes() {
  const location = useLocation()
  const routeKey = `${location.pathname}${location.search}`

  return (
    <div className="container">
      <div key={routeKey} className="page-slide-up">
        <Routes location={location}>
          <Route path="/" element={<Home />} />
          <Route path="/report" element={<ProtectedRoute><Report /></ProtectedRoute>} />
          <Route path="/my-reports" element={<ProtectedRoute><MyReports /></ProtectedRoute>} />
          <Route path="/track/:trackingId?" element={<Track />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/verify" element={<VerifyAccount />} />
          <Route path="/dashboard/*" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  )
}

function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 py-12">
        <AnimatedRoutes />
      </main>
      <Footer />
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
)
