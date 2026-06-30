const { Pool } = require('pg');

const rawConnectionString = process.env.DATABASE_URL;

if (!rawConnectionString) {
  throw new Error('DATABASE_URL is required when using the PostgreSQL data layer');
}

// Render runs a persistent Node server, so use Supabase's session pooler.
// Transaction pooling on port 6543 is intended for short-lived/serverless clients.
const connectionString = rawConnectionString.replace(
  /(@[^/]*\.pooler\.supabase\.com):6543(?=\/)/,
  '$1:5432',
);

const pool = new Pool({
  connectionString,
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
});

async function query(text, params = []) {
  const result = await pool.query(text, params);
  return result.rows;
}

async function one(text, params = []) {
  const result = await pool.query(text, params);
  return result.rows[0] || null;
}

module.exports = {
  pool,
  query,
  one,
};
