import { Router } from 'express'
import { supabaseAdmin } from '../supabase'
import { cacheDepartments } from '../middleware/cache'

export const departmentsRouter = Router()

// Apply caching middleware to departments endpoint (5 min TTL)
departmentsRouter.get('/', cacheDepartments, async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from('departments')
    .select('department_id, name, code, contact_email, contact_number')
    .order('name')

  if (error) {
    console.error('Error fetching departments:', error)
    return res.status(500).json({ error: 'Failed to fetch departments' })
  }

  const formatted = data.map(dept => ({
    id: dept.department_id,
    name: dept.name,
    code: dept.code,
    contactEmail: dept.contact_email,
    contactNumber: dept.contact_number
  }))

  res.json(formatted)
})
