import 'dotenv/config'
import { readFileSync } from 'fs'
import path from 'path'
import { pool } from '../src/db.js'

async function main() {
  const sql = readFileSync(path.join(process.cwd(), 'scripts', 'schema.sql'), 'utf-8')
  await pool.query(sql)
  console.log('Schema applied')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
