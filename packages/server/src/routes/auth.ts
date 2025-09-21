import { Router, Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { pool } from '../db'

export const authRouter = Router()

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret'
const TOKEN_COOKIE = 'mr_token'

authRouter.post('/signup', async (req, res) => {
  const { name, email, password, role = 'CITIZEN', departmentId = null } = req.body || {}
  if (!email || !password || !name) return res.status(400).json({ error: 'Missing fields' })
  const hash = await bcrypt.hash(password, 10)
  try {
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password_hash, role, department_id) VALUES (?, ?, ?, ?, ?)',
      [name, email, hash, role, departmentId]
    )
    // @ts-ignore
    const id = result.insertId
    res.json({ id, name, email, role })
  } catch (e: any) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Email already exists' })
    console.error(e)
    res.status(500).json({ error: 'Signup failed' })
  }
})

authRouter.post('/signin', async (req, res) => {
  const { email, password } = req.body || {}
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' })
  const [rows] = await pool.query('SELECT id, name, email, password_hash, role, department_id FROM users WHERE email = ?', [email])
  const users = rows as any[]
  const user = users[0]
  if (!user) return res.status(401).json({ error: 'Invalid credentials' })
  const ok = await bcrypt.compare(password, user.password_hash)
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' })
  const token = jwt.sign({ sub: String(user.id), role: user.role, name: user.name, email: user.email, departmentId: user.department_id || null }, JWT_SECRET, { expiresIn: '7d' })
  res.cookie(TOKEN_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 7 * 24 * 3600 * 1000 })
  res.json({ ok: true, user: { id: user.id, name: user.name, email: user.email, role: user.role, departmentId: user.department_id || null } })
})

authRouter.post('/signout', (_req, res) => {
  res.clearCookie(TOKEN_COOKIE)
  res.json({ ok: true })
})

// Return current user from JWT cookie
authRouter.get('/me', async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.[TOKEN_COOKIE]
    if (!token) return res.status(401).json({ error: 'Not authenticated' })
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string; role: string }
    const [rows] = await pool.query('SELECT id, name, email, role, department_id FROM users WHERE id = ? LIMIT 1', [payload.sub])
    const users = rows as any[]
    if (!users[0]) return res.status(401).json({ error: 'User not found' })
    const u = users[0]
    return res.json({ user: { id: u.id, name: u.name, email: u.email, role: u.role, departmentId: u.department_id || null } })
  } catch (_e) {
    return res.status(401).json({ error: 'Invalid token' })
  }
})
