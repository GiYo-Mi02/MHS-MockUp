import { Router } from 'express'
import { pool } from '../db'

export const departmentsRouter = Router()

departmentsRouter.get('/', async (_req, res) => {
  const [rows] = await pool.query('SELECT id, name, code FROM departments ORDER BY name')
  res.json(rows)
})
