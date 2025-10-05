import React, { createContext, useContext, useEffect, useState } from 'react'
import { api } from './api'

export type Role = 'CITIZEN' | 'STAFF' | 'ADMIN'
export type User = {
  id: number
  name: string
  email: string
  role: Role
  departmentId: number | null
  isVerified?: boolean
  trustScore?: number
  trustLevel?: 'LOW' | 'MEDIUM' | 'HIGH'
  dailyReportLimit?: number | null
  reportsSubmittedToday?: number
  totalReportsSubmitted?: number
  verificationExpiresAt?: string | null
}

type AuthContextType = {
  user: User | null
  loading: boolean
  signin: (email: string, password: string) => Promise<User | null>
  signout: () => Promise<void>
  refresh: () => Promise<User | null>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const loadUser = async (): Promise<User | null> => {
    try {
      const { data } = await api.get('/auth/me')
      setUser(data.user)
      return data.user as User
    } catch {
      setUser(null)
      return null
    }
  }

  useEffect(() => {
    loadUser().finally(() => setLoading(false))
  }, [])

  const signin = async (email: string, password: string) => {
    await api.post('/auth/signin', { email, password })
    return loadUser()
  }

  const signout = async () => {
    await api.post('/auth/signout')
    setUser(null)
  }

  const refresh = async () => {
    return loadUser()
  }

  return <AuthContext.Provider value={{ user, loading, signin, signout, refresh }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
