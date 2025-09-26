import 'dotenv/config'
import { readFileSync } from 'fs'
import path from 'path'
import { pool } from '../src/db'

async function main() {
  const sql = readFileSync(path.join(process.cwd(), 'scripts', 'seed.sql'), 'utf-8')
  const statements = sql
    .split(/;\s*(?:\r?\n|$)/g)
    .map((stmt) => stmt.trim())
    .filter(Boolean)

  for (const statement of statements) {
    await pool.query(statement)
  }
  console.log('Seed applied')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
