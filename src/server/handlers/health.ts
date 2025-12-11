import type { VercelRequest, VercelResponse } from '@vercel/node'
import { checkDatabaseHealth } from '../src/server/supabase'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const dbHealthy = await checkDatabaseHealth()
  res.json({
    ok: true,
    name: 'makati-report',
    database: dbHealthy ? 'connected' : 'disconnected',
    ts: new Date().toISOString()
  })
}
