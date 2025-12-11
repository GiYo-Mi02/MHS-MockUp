import jwt from 'jsonwebtoken'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret'
const TOKEN_COOKIE = 'mr_token'

export type TokenPayload = {
  sub: string
  role: 'CITIZEN' | 'STAFF' | 'ADMIN'
  name: string
  email: string
  departmentId: number | null
}

export function getTokenFromCookies(req: VercelRequest): string | null {
  const cookies = req.cookies || {}
  return cookies[TOKEN_COOKIE] || null
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload
  } catch {
    return null
  }
}

export function signToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function setAuthCookie(res: VercelResponse, token: string): void {
  const maxAge = 7 * 24 * 60 * 60 // 7 days in seconds
  const isProduction = process.env.NODE_ENV === 'production'
  
  res.setHeader(
    'Set-Cookie',
    `${TOKEN_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${isProduction ? '; Secure' : ''}`
  )
}

export function clearAuthCookie(res: VercelResponse): void {
  res.setHeader(
    'Set-Cookie',
    `${TOKEN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  )
}

export function requireAuth(req: VercelRequest, res: VercelResponse): TokenPayload | null {
  const token = getTokenFromCookies(req)
  if (!token) {
    res.status(401).json({ error: 'Not authenticated' })
    return null
  }
  
  const payload = verifyToken(token)
  if (!payload) {
    res.status(401).json({ error: 'Invalid token' })
    return null
  }
  
  return payload
}

export function requireRole(
  req: VercelRequest,
  res: VercelResponse,
  ...roles: Array<'CITIZEN' | 'STAFF' | 'ADMIN'>
): TokenPayload | null {
  const user = requireAuth(req, res)
  if (!user) return null
  
  if (!roles.includes(user.role)) {
    res.status(403).json({ error: 'Forbidden' })
    return null
  }
  
  return user
}
