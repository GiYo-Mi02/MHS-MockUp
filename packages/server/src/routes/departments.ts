import { Router } from 'express'
import { pool } from '../db'

export const departmentsRouter = Router()

departmentsRouter.get('/', async (_req, res) => {
  const [rows] = await pool.query('SELECT department_id as id, name, code, contact_email as contactEmail, contact_number as contactNumber FROM departments ORDER BY name')
  res.json(rows)
})
