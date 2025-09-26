import { Router, Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { pool } from '../db'

export const authRouter = Router()

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret'
const TOKEN_COOKIE = 'mr_token'

type Role = 'CITIZEN' | 'STAFF' | 'ADMIN'

authRouter.post('/signup', async (req, res) => {
  const {
    name,
    email,
    password,
    contactNumber = null,
    isAnonymous = false
  } = req.body || {}

  if (!email || !password || !name) return res.status(400).json({ error: 'Missing fields' })

  const hash = await bcrypt.hash(password, 10)

  try {
    const [result] = await pool.query(
      `INSERT INTO citizens (full_name, contact_number, email, password_hash, is_anonymous)
       VALUES (?, ?, ?, ?, ?)`
      , [name, contactNumber, email, hash, !!isAnonymous]
    )
    const insertId = (result as any).insertId
    res.json({ id: insertId, name, email, role: 'CITIZEN' })
  } catch (e: any) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Email already exists' })
    console.error(e)
    res.status(500).json({ error: 'Signup failed' })
  }
})

authRouter.post('/signin', async (req, res) => {
  const { email, password } = req.body || {}
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' })

  const queries = [
    {
      role: 'CITIZEN' as Role,
      sql: `SELECT citizen_id AS id, full_name AS name, email, password_hash, NULL AS departmentId FROM citizens WHERE email = ?`
    },
    {
      role: 'STAFF' as Role,
      sql: `SELECT staff_id AS id, full_name AS name, email, password_hash, department_id AS departmentId FROM department_staff WHERE email = ?`
    },
    {
      role: 'ADMIN' as Role,
      sql: `SELECT admin_id AS id, full_name AS name, email, password_hash, NULL AS departmentId FROM admins WHERE email = ?`
    }
  ]

  let foundUser: any = null

  for (const entry of queries) {
    const [rows] = await pool.query(entry.sql, [email])
    const list = rows as any[]
    if (list.length) {
      foundUser = { ...list[0], role: entry.role }
      break
    }
  }

  if (!foundUser) return res.status(401).json({ error: 'Invalid credentials' })

  const ok = await bcrypt.compare(password, foundUser.password_hash)
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' })

  const tokenPayload = {
    sub: String(foundUser.id),
    role: foundUser.role,
    name: foundUser.name,
    email: foundUser.email,
    departmentId: foundUser.departmentId ? Number(foundUser.departmentId) : null
  }

  const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' })
  res.cookie(TOKEN_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 7 * 24 * 3600 * 1000 })
  res.json({ ok: true, user: { ...tokenPayload } })
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
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string; role: Role; departmentId: number | null }

    let sql: string
    if (payload.role === 'CITIZEN') {
      sql = 'SELECT citizen_id AS id, full_name AS name, email FROM citizens WHERE citizen_id = ? LIMIT 1'
    } else if (payload.role === 'STAFF') {
      sql = 'SELECT staff_id AS id, full_name AS name, email, department_id AS departmentId FROM department_staff WHERE staff_id = ? LIMIT 1'
    } else {
      sql = 'SELECT admin_id AS id, full_name AS name, email FROM admins WHERE admin_id = ? LIMIT 1'
    }

    const [rows] = await pool.query(sql, [payload.sub])
    const users = rows as any[]
    if (!users[0]) return res.status(401).json({ error: 'User not found' })
    const u = users[0]

    return res.json({
      user: {
        id: u.id,
        name: u.name,
        email: u.email,
        role: payload.role,
        departmentId: u.departmentId ? Number(u.departmentId) : payload.departmentId || null
      }
    })
  } catch (e) {
    console.error(e)
    return res.status(401).json({ error: 'Invalid token' })
  }
})
