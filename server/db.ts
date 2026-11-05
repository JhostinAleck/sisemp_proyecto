import pg from 'pg';

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
  // Railway's private network uses ordinary PostgreSQL; TLS can be requested in DATABASE_URL.
});
// Prevent an idle-connection error from crashing the process without exposing connection details.
pool.on('error', () => console.error('PostgreSQL idle connection error'));
