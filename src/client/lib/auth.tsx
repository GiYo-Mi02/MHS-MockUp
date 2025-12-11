import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
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

  const loadUser = useCallback(async (): Promise<User | null> => {
    try {
      const { data } = await api.get('/auth/me')
      console.log('[auth] loadUser response:', data)
      setUser(data.user)
      return data.user as User
    } catch (error: any) {
      console.error('[auth] loadUser failed:', error?.response?.status, error?.message)
      setUser(null)
      return null
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    loadUser().then(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [loadUser])

  const signin = useCallback(async (email: string, password: string) => {
    try {
      const signInResponse = await api.post('/auth/signin', { email, password })
      console.log('[auth] signin response:', signInResponse.data)
      // Set user immediately from signin response if available
      if (signInResponse.data?.user) {
        setUser(signInResponse.data.user)
        return signInResponse.data.user as User
      }
      // Otherwise load fresh from /auth/me
      return loadUser()
    } catch (error: any) {
      console.error('[auth] signin failed:', error?.response?.status, error?.message)
      throw error
    }
  }, [loadUser])

  const signout = useCallback(async () => {
    try {
      await api.post('/auth/signout')
      setUser(null)
    } catch (error: any) {
      console.error('[auth] signout failed:', error?.message)
    }
  }, [])

  const refresh = useCallback(async () => {
    return loadUser()
  }, [loadUser])

  return <AuthContext.Provider value={{ user, loading, signin, signout, refresh }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
