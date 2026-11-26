const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function connectWithRetry(retries = 10, delayMs = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query('SELECT 1');
      console.log('DB connected');
      return;
    } catch (err) {
      console.log(`DB not ready, retry ${i + 1}/${retries}...`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw new Error('DB connection failed after retries');
}

module.exports = { pool, connectWithRetry };