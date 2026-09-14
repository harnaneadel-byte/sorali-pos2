import pg from 'pg';

const { Pool } = pg;

// Database connection configuration
const databaseUrl = process.env.DATABASE_URL;

// Parse configuration safely without exposing sensitive connection details
let pool: pg.Pool | null = null;

const isPostgresUrl = Boolean(
  databaseUrl &&
  (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://'))
);

if (isPostgresUrl && databaseUrl) {
  // Supabase PostgreSQL requires SSL in production; rejectUnauthorized is set safely for hosted instances
  const isLocal = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');
  pool = new Pool({
    connectionString: databaseUrl,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  pool.on('error', (err) => {
    // Log sanitized error message without connection string
    console.error('[PostgreSQL Pool Error]: Unexpected idle client error:', err.message);
  });
}

/**
 * Returns whether a valid PostgreSQL connection string is configured in the environment.
 */
export function isDatabaseConfigured(): boolean {
  return isPostgresUrl;
}

/**
 * Executes a query using the connection pool.
 */
export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<pg.QueryResult<T>> {
  if (!pool) {
    throw new Error('DATABASE_URL is not configured. PostgreSQL connection pool is inactive.');
  }
  return pool.query<T>(text, params);
}

/**
 * Acquires a client from the pool with automatic release guarantee.
 */
export async function withTransaction<T>(
  callback: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  if (!pool) {
    throw new Error('DATABASE_URL is not configured. PostgreSQL connection pool is inactive.');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch((rbErr) => {
      console.error('[PostgreSQL Rollback Error]:', rbErr.message);
    });
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Checks PostgreSQL connectivity with a safe test query (SELECT 1).
 * Never logs credentials.
 */
export async function checkDatabaseConnection(): Promise<{
  connected: boolean;
  configured: boolean;
  version?: string;
  error?: string;
}> {
  if (!pool) {
    return {
      connected: false,
      configured: false,
      error: 'DATABASE_URL environment variable is not defined',
    };
  }

  try {
    const res = await pool.query('SELECT version() AS version, 1 AS health_check');
    return {
      connected: true,
      configured: true,
      version: res.rows[0]?.version,
    };
  } catch (err: any) {
    return {
      connected: false,
      configured: true,
      error: err.message || 'Failed to connect to PostgreSQL',
    };
  }
}

/**
 * Graceful pool shutdown.
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

process.on('SIGINT', async () => {
  await closePool();
});

process.on('SIGTERM', async () => {
  await closePool();
});
