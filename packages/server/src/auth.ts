import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret'
const TOKEN_COOKIE = 'mr_token'

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[TOKEN_COOKIE]
    if (!token) return res.status(401).json({ error: 'Not authenticated' })
    const payload = jwt.verify(token, JWT_SECRET) as any
    // attach to request for downstream usage
    ;(req as any).user = payload
    next()
  } catch (_e) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user
    if (!user) return res.status(401).json({ error: 'Not authenticated' })
    if (!roles.includes(user.role)) return res.status(403).json({ error: 'Forbidden' })
    next()
  }
}
