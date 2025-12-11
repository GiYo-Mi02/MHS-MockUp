import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../supabase'

// Simple in-memory cache for departments (5 min TTL)
let departmentsCache: { data: any; timestamp: number } | null = null
const CACHE_TTL = 5 * 60 * 1000

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Check cache
    if (departmentsCache && Date.now() - departmentsCache.timestamp < CACHE_TTL) {
      res.setHeader('X-Cache', 'HIT')
      return res.json(departmentsCache.data)
    }

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

    // Update cache
    departmentsCache = { data: formatted, timestamp: Date.now() }
    res.setHeader('X-Cache', 'MISS')
    res.json(formatted)
  } catch (error) {
    console.error('Departments API error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}
