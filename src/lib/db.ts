import { Pool } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var pgPool: Pool | undefined;
}

function getPool(): Pool {
  if (globalThis.pgPool) return globalThis.pgPool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
  }
  const pool = new Pool({ connectionString, max: 10 });
  globalThis.pgPool = pool;
  return pool;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pool: Pick<Pool, 'query' | 'connect'> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: (...args: any[]) => (getPool().query as any)(...args),
  connect: () => getPool().connect(),
};

export default pool;
