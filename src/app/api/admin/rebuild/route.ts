import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { seedFromFiles, buildProjections, buildGlobalProjection } from '@/lib/db-init';

export const dynamic = 'force-dynamic';

export async function POST() {
  const client = await pool.connect();
  try {
    // Schema migrations (idempotent)
    await client.query(`
      ALTER TABLE persons ADD COLUMN IF NOT EXISTS content TEXT;
      ALTER TABLE persons ADD COLUMN IF NOT EXISTS birth_year INTEGER;
      ALTER TABLE persons ADD COLUMN IF NOT EXISTS death_year INTEGER;
      ALTER TABLE events ADD COLUMN IF NOT EXISTS content TEXT;
      CREATE TABLE IF NOT EXISTS person_dynasties (
        person_id INTEGER REFERENCES persons(id) ON DELETE CASCADE,
        dynasty_id INTEGER REFERENCES dynasties(id) ON DELETE CASCADE,
        PRIMARY KEY (person_id, dynasty_id)
      );
      CREATE TABLE IF NOT EXISTS event_dynasties (
        event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
        dynasty_id INTEGER REFERENCES dynasties(id) ON DELETE CASCADE,
        PRIMARY KEY (event_id, dynasty_id)
      );
      CREATE TABLE IF NOT EXISTS global_graph_projection (
        id SERIAL PRIMARY KEY,
        bundle JSONB NOT NULL,
        built_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await client.query('BEGIN');
    await seedFromFiles(client);
    await buildProjections(client);
    await buildGlobalProjection(client);
    await client.query('COMMIT');
    return NextResponse.json({ ok: true, message: 'Seeded and projections rebuilt.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[rebuild]', err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
