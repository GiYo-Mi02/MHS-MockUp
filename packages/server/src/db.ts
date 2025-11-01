import mysql from 'mysql2/promise'

const {
  DB_HOST = 'localhost',
  DB_PORT = '3306',
  DB_USER = 'root',
  DB_PASSWORD = '',
  DB_NAME = 'makati_report'
} = process.env

export const pool = mysql.createPool({
  host: DB_HOST,
  port: Number(DB_PORT),
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 100,        // Increased from 10 to 100 for high load
  queueLimit: 0,               // No limit on connection queue
  maxIdle: 50,                 // Keep 50 idle connections ready
  idleTimeout: 60000,          // Close idle connections after 60 seconds
  enableKeepAlive: true,       // Keep connections alive
  keepAliveInitialDelay: 0     // Start keep-alive immediately
})
