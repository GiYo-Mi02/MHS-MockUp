import React, { createContext, useContext, useEffect, useState } from 'react'
import { api } from './api'

export type Role = 'CITIZEN' | 'STAFF' | 'ADMIN'
export type User = { id: number; name: string; email: string; role: Role; departmentId: number | null }

type AuthContextType = {
  user: User | null
  loading: boolean
  signin: (email: string, password: string) => Promise<void>
  signout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get('/auth/me')
      .then((res) => setUser(res.data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const signin = async (email: string, password: string) => {
    await api.post('/auth/signin', { email, password })
    const { data } = await api.get('/auth/me')
    setUser(data.user)
  }

  const signout = async () => {
    await api.post('/auth/signout')
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, loading, signin, signout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
