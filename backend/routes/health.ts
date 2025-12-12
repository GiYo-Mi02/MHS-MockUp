import { Router } from 'express'
import { checkDatabaseHealth } from '../services/supabase'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const dbHealthy = await checkDatabaseHealth()
    res.json({
      ok: true,
      name: 'makati-report',
      database: dbHealthy ? 'connected' : 'disconnected',
      ts: new Date().toISOString()
    })
  } catch (error) {
    res.status(500).json({ error: 'Health check failed' })
  }
})

export default router
