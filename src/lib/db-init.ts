import fs from 'fs';
import path from 'path';
import pool from './db';
import type { DynastyGraphBundle, PersonRole, RelationType } from './types';

// ── Data file types ──────────────────────────────────────────────────────────

interface SeedPerson {
  slug: string;
  name: string;
  primaryRole: string;
  roles: string[];
  importance: number;
  birthYear?: number;
  deathYear?: number;
  dynastySlugs?: string[];
  aliases: string[];
  summary: string;
  content?: string;
  imageUrl?: string;
}

interface SeedEvent {
  slug: string;
  name: string;
  timeStart: number;
  timeEnd?: number;
  aliases: string[];
  summary: string;
  content?: string;
  imageUrl?: string;
}

interface SeedRelation {
  from: string;
  fromType: 'person' | 'event';
  to: string;
  toType: 'person' | 'event';
  type: string;
  weight: number;
  note?: string;
}

interface SeedTimeline {
  eventSlug: string;
  year: number;
  label: string;
}

interface DynastyFile {
  dynasty: { slug: string; name: string; startYear: number; endYear: number; summary: string };
  persons: SeedPerson[];
  events: SeedEvent[];
  relations: SeedRelation[];
  timelines: SeedTimeline[];
}

// ── Schema ───────────────────────────────────────────────────────────────────

const DYNASTY_BAND_COLORS: Record<string, string> = {
  qin: '#F59E0B',
  'chu-han': '#EF4444',
  han: '#34D399',
  xin: '#8B5CF6',
  'dong-han': '#10B981',
  'san-guo': '#60A5FA',
  tang: '#F472B6',
  song: '#A78BFA',
  ming: '#FB923C',
  qing: '#EF4444',
};
function dynastyBandColor(slug: string): string {
  return DYNASTY_BAND_COLORS[slug] || '#94A3B8';
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS dynasties (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  start_year INTEGER NOT NULL,
  end_year INTEGER NOT NULL,
  summary TEXT,
  status VARCHAR(20) DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS persons (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  dynasty_id INTEGER REFERENCES dynasties(id),
  primary_role VARCHAR(50) NOT NULL DEFAULT 'other',
  roles_json JSONB DEFAULT '[]',
  summary TEXT,
  content TEXT,
  importance_score INTEGER DEFAULT 50,
  birth_year INTEGER,
  death_year INTEGER,
  image_url VARCHAR(500),
  status VARCHAR(20) DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  dynasty_id INTEGER REFERENCES dynasties(id),
  time_start INTEGER,
  time_end INTEGER,
  summary TEXT,
  content TEXT,
  image_url VARCHAR(500),
  status VARCHAR(20) DEFAULT 'active'
);

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

CREATE TABLE IF NOT EXISTS relations (
  id SERIAL PRIMARY KEY,
  from_entity_type VARCHAR(20) NOT NULL,
  from_entity_id INTEGER NOT NULL,
  to_entity_type VARCHAR(20) NOT NULL,
  to_entity_id INTEGER NOT NULL,
  relation_type VARCHAR(50) NOT NULL,
  weight INTEGER DEFAULT 5,
  direction VARCHAR(20) DEFAULT 'undirected',
  evidence_note TEXT
);

CREATE TABLE IF NOT EXISTS entity_aliases (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(20) NOT NULL,
  entity_id INTEGER NOT NULL,
  alias VARCHAR(200) NOT NULL,
  normalized_alias VARCHAR(200) NOT NULL,
  weight INTEGER DEFAULT 5
);

CREATE TABLE IF NOT EXISTS timeline_entries (
  id SERIAL PRIMARY KEY,
  dynasty_id INTEGER REFERENCES dynasties(id),
  event_id INTEGER REFERENCES events(id),
  sort_year INTEGER NOT NULL,
  sort_order INTEGER DEFAULT 0,
  label VARCHAR(200)
);

CREATE TABLE IF NOT EXISTS dynasty_graph_projections (
  id SERIAL PRIMARY KEY,
  dynasty_id INTEGER REFERENCES dynasties(id) UNIQUE,
  bundle JSONB NOT NULL,
  built_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS entity_detail_projections (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(20) NOT NULL,
  entity_id INTEGER NOT NULL,
  detail JSONB NOT NULL,
  built_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(entity_type, entity_id)
);

CREATE TABLE IF NOT EXISTS search_documents (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(20) NOT NULL,
  entity_id INTEGER NOT NULL,
  entity_slug VARCHAR(100) NOT NULL,
  display_name VARCHAR(200) NOT NULL,
  aliases TEXT[] DEFAULT '{}',
  dynasty_slug VARCHAR(100),
  subtitle VARCHAR(200),
  target_route VARCHAR(500),
  weight INTEGER DEFAULT 50,
  UNIQUE(entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_search_weight ON search_documents(weight DESC);
CREATE INDEX IF NOT EXISTS idx_search_name ON search_documents(display_name);

-- Migrations for new columns
ALTER TABLE persons ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE persons ADD COLUMN IF NOT EXISTS birth_year INTEGER;
ALTER TABLE persons ADD COLUMN IF NOT EXISTS death_year INTEGER;
ALTER TABLE events ADD COLUMN IF NOT EXISTS content TEXT;

CREATE TABLE IF NOT EXISTS global_graph_projection (
  id SERIAL PRIMARY KEY,
  bundle JSONB NOT NULL,
  built_at TIMESTAMP DEFAULT NOW()
);
`;

// ── Colors & sizing ───────────────────────────────────────────────────────────

const NODE_COLORS: Record<string, string> = {
  emperor: '#F59E0B',
  strategist: '#A78BFA',
  general: '#34D399',
  minister: '#60A5FA',
  royalty: '#F472B6',
  warlord: '#FB923C',
  rebel: '#EF4444',
  other: '#94A3B8',
  event: '#E2E8F0',
};

const EDGE_COLORS: Record<string, string> = {
  blood: '#DC2626',
  political: '#2563EB',
  conflict: '#EA580C',
  participation: '#64748B',
  subordinate: '#7C3AED',
};

function nodeSize(importance: number, role: string): number {
  if (role === 'emperor') return importance >= 90 ? 20 : 15;
  if (importance >= 85) return 14;
  if (importance >= 70) return 10;
  return 7;
}

// ── File loading ──────────────────────────────────────────────────────────────

function loadAllDynastyFiles(): DynastyFile[] {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) return [];
  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
  return files.map(f => JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf-8')) as DynastyFile);
}

// ── Seed (idempotent upsert) ──────────────────────────────────────────────────

export async function seedFromFiles(client: import('pg').PoolClient): Promise<void> {
  const files = loadAllDynastyFiles();
  if (files.length === 0) return;

  const dynastyIds: Record<string, number> = {};
  const personIds: Record<string, number> = {};
  const eventIds: Record<string, number> = {};

  // Dynasties
  for (const file of files) {
    const d = file.dynasty;
    const r = await client.query(
      `INSERT INTO dynasties (slug, name, start_year, end_year, summary)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (slug) DO UPDATE SET name=$2, start_year=$3, end_year=$4, summary=$5
       RETURNING id`,
      [d.slug, d.name, d.startYear, d.endYear, d.summary]
    );
    dynastyIds[d.slug] = r.rows[0].id;
  }

  // Persons
  for (const file of files) {
    const dynastyId = dynastyIds[file.dynasty.slug];
    for (const p of file.persons) {
      const r = await client.query(
        `INSERT INTO persons (slug, name, dynasty_id, primary_role, roles_json, summary, content, importance_score, birth_year, death_year, image_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (slug) DO UPDATE SET
           name=$2, dynasty_id=$3, primary_role=$4, roles_json=$5,
           summary=$6, content=$7, importance_score=$8,
           birth_year=$9, death_year=$10, image_url=$11
         RETURNING id`,
        [
          p.slug, p.name, dynastyId, p.primaryRole,
          JSON.stringify(p.roles), p.summary, p.content ?? null,
          p.importance, p.birthYear ?? null, p.deathYear ?? null,
          p.imageUrl ?? null,
        ]
      );
      const personId = r.rows[0].id;
      personIds[p.slug] = personId;

      // Primary dynasty link
      await client.query(
        `INSERT INTO person_dynasties (person_id, dynasty_id) VALUES ($1,$2)
         ON CONFLICT DO NOTHING`,
        [personId, dynastyId]
      );

      // Additional dynasty links
      if (p.dynastySlugs) {
        for (const ds of p.dynastySlugs) {
          const did = dynastyIds[ds];
          if (did) {
            await client.query(
              `INSERT INTO person_dynasties (person_id, dynasty_id) VALUES ($1,$2)
               ON CONFLICT DO NOTHING`,
              [personId, did]
            );
          }
        }
      }

      // Aliases
      await client.query(
        `DELETE FROM entity_aliases WHERE entity_type='person' AND entity_id=$1`,
        [personId]
      );
      for (const alias of p.aliases) {
        await client.query(
          `INSERT INTO entity_aliases (entity_type, entity_id, alias, normalized_alias, weight)
           VALUES ('person',$1,$2,$3,5)`,
          [personId, alias, alias]
        );
      }
    }
  }

  // Events
  for (const file of files) {
    const dynastyId = dynastyIds[file.dynasty.slug];
    for (const e of file.events) {
      const r = await client.query(
        `INSERT INTO events (slug, name, dynasty_id, time_start, time_end, summary, content, image_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (slug) DO UPDATE SET
           name=$2, dynasty_id=$3, time_start=$4, time_end=$5,
           summary=$6, content=$7, image_url=$8
         RETURNING id`,
        [
          e.slug, e.name, dynastyId,
          e.timeStart, e.timeEnd ?? null,
          e.summary, e.content ?? null, e.imageUrl ?? null,
        ]
      );
      const eventId = r.rows[0].id;
      eventIds[e.slug] = eventId;

      await client.query(
        `INSERT INTO event_dynasties (event_id, dynasty_id) VALUES ($1,$2)
         ON CONFLICT DO NOTHING`,
        [eventId, dynastyId]
      );

      await client.query(
        `DELETE FROM entity_aliases WHERE entity_type='event' AND entity_id=$1`,
        [eventId]
      );
      for (const alias of e.aliases) {
        await client.query(
          `INSERT INTO entity_aliases (entity_type, entity_id, alias, normalized_alias, weight)
           VALUES ('event',$1,$2,$3,5)`,
          [eventId, alias, alias]
        );
      }
    }
  }

  // Relations (delete and re-insert per dynasty to keep idempotent)
  for (const file of files) {
    const dynastyId = dynastyIds[file.dynasty.slug];

    // Collect IDs for this dynasty's persons and events
    const dynastyPersonIds = new Set(
      file.persons.map(p => personIds[p.slug]).filter(Boolean)
    );
    const dynastyEventIds = new Set(
      file.events.map(e => eventIds[e.slug]).filter(Boolean)
    );

    // Delete existing relations where both endpoints belong to this dynasty
    await client.query(
      `DELETE FROM relations
       WHERE (from_entity_type='person' AND from_entity_id = ANY($1)
              AND to_entity_type='person' AND to_entity_id = ANY($1))
          OR (from_entity_type='person' AND from_entity_id = ANY($1)
              AND to_entity_type='event' AND to_entity_id = ANY($2))
          OR (from_entity_type='event' AND from_entity_id = ANY($2)
              AND to_entity_type='person' AND to_entity_id = ANY($1))
          OR (from_entity_type='event' AND from_entity_id = ANY($2)
              AND to_entity_type='event' AND to_entity_id = ANY($2))`,
      [
        Array.from(dynastyPersonIds),
        Array.from(dynastyEventIds),
      ]
    );

    for (const rel of file.relations) {
      const fromId = rel.fromType === 'person' ? personIds[rel.from] : eventIds[rel.from];
      const toId = rel.toType === 'person' ? personIds[rel.to] : eventIds[rel.to];
      if (!fromId || !toId) continue;
      await client.query(
        `INSERT INTO relations (from_entity_type, from_entity_id, to_entity_type, to_entity_id, relation_type, weight, evidence_note)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [rel.fromType, fromId, rel.toType, toId, rel.type, rel.weight, rel.note ?? null]
      );
    }

    // Timeline entries
    await client.query(
      `DELETE FROM timeline_entries WHERE dynasty_id=$1`, [dynastyId]
    );
    for (const t of file.timelines) {
      const eventId = eventIds[t.eventSlug];
      if (!eventId) continue;
      await client.query(
        `INSERT INTO timeline_entries (dynasty_id, event_id, sort_year, label)
         VALUES ($1,$2,$3,$4)`,
        [dynastyId, eventId, t.year, t.label]
      );
    }
  }
}

// ── Projections (from DB) ─────────────────────────────────────────────────────

export async function buildProjections(client: import('pg').PoolClient): Promise<void> {
  const { rows: dynasties } = await client.query(
    `SELECT id, slug, name, start_year, end_year, summary FROM dynasties WHERE status='active' ORDER BY start_year`
  );

  for (const dynasty of dynasties) {
    const { rows: persons } = await client.query(
      `SELECT id, slug, name, primary_role, roles_json, summary, content,
              importance_score, birth_year, death_year, image_url
       FROM persons WHERE dynasty_id=$1 AND status='active'`,
      [dynasty.id]
    );

    const { rows: events } = await client.query(
      `SELECT id, slug, name, time_start, time_end, summary, content, image_url
       FROM events WHERE dynasty_id=$1 AND status='active'`,
      [dynasty.id]
    );

    const personSlugsById = new Map<number, string>(persons.map(p => [p.id, p.slug]));
    const eventSlugsById = new Map<number, string>(events.map(e => [e.id, e.slug]));
    const personBySlug = new Map(persons.map(p => [p.slug, p]));
    const eventBySlug = new Map(events.map(e => [e.slug, e]));

    const personIdSet = new Set(persons.map(p => p.id));
    const eventIdSet = new Set(events.map(e => e.id));

    // Relations within this dynasty
    const { rows: relations } = await client.query(
      `SELECT r.from_entity_type, r.from_entity_id, r.to_entity_type, r.to_entity_id,
              r.relation_type, r.weight, r.evidence_note
       FROM relations r
       WHERE
         (r.from_entity_type='person' AND r.from_entity_id = ANY($1)
          AND r.to_entity_type='person' AND r.to_entity_id = ANY($1))
         OR (r.from_entity_type='person' AND r.from_entity_id = ANY($1)
             AND r.to_entity_type='event' AND r.to_entity_id = ANY($2))
         OR (r.from_entity_type='event' AND r.from_entity_id = ANY($2)
             AND r.to_entity_type='person' AND r.to_entity_id = ANY($1))
         OR (r.from_entity_type='event' AND r.from_entity_id = ANY($2)
             AND r.to_entity_type='event' AND r.to_entity_id = ANY($2))`,
      [Array.from(personIdSet), Array.from(eventIdSet)]
    );

    const { rows: timelines } = await client.query(
      `SELECT te.sort_year, te.label, e.slug as event_slug
       FROM timeline_entries te
       JOIN events e ON e.id = te.event_id
       WHERE te.dynasty_id=$1
       ORDER BY te.sort_year`,
      [dynasty.id]
    );

    // Build graph nodes
    const nodes = [
      ...persons.map(p => ({
        id: `person:${p.slug}`,
        label: p.name,
        entityType: 'person' as const,
        entitySlug: p.slug,
        dynastySlug: dynasty.slug,
        x: 0, y: 0,
        size: nodeSize(p.importance_score, p.primary_role),
        importanceScore: p.importance_score,
        activeYear: p.birth_year ?? dynasty.start_year,
        color: NODE_COLORS[p.primary_role] || NODE_COLORS.other,
        personRole: p.primary_role as PersonRole,
        imageUrl: p.image_url ?? null,
      })),
      ...events.map(e => ({
        id: `event:${e.slug}`,
        label: e.name,
        entityType: 'event' as const,
        entitySlug: e.slug,
        dynastySlug: dynasty.slug,
        x: 0, y: 0,
        size: 9,
        importanceScore: 60,
        activeYear: e.time_start ?? dynasty.start_year,
        color: NODE_COLORS.event,
        imageUrl: e.image_url ?? null,
      })),
    ];

    // Build edges
    const edges = relations.map((r, i) => {
      const fromSlug = r.from_entity_type === 'person'
        ? personSlugsById.get(r.from_entity_id)
        : eventSlugsById.get(r.from_entity_id);
      const toSlug = r.to_entity_type === 'person'
        ? personSlugsById.get(r.to_entity_id)
        : eventSlugsById.get(r.to_entity_id);
      if (!fromSlug || !toSlug) return null;
      return {
        id: `edge-${i}`,
        source: `${r.from_entity_type}:${fromSlug}`,
        target: `${r.to_entity_type}:${toSlug}`,
        relationType: r.relation_type as RelationType,
        color: EDGE_COLORS[r.relation_type] || '#64748B',
        size: r.weight >= 9 ? 3 : r.weight >= 6 ? 2 : 1,
        label: r.evidence_note,
      };
    }).filter((e): e is NonNullable<typeof e> => e !== null);

    // Timeline
    const timeline = timelines.map(t => ({
      year: t.sort_year,
      label: t.label,
      eventSlug: t.event_slug,
      nodeId: `event:${t.event_slug}`,
    }));

    // Core node
    const coreNode = persons.find(p => p.primary_role === 'emperor') || persons[0];

    const bundle: DynastyGraphBundle = {
      dynasty: {
        id: dynasty.id,
        slug: dynasty.slug,
        name: dynasty.name,
        startYear: dynasty.start_year,
        endYear: dynasty.end_year,
        summary: dynasty.summary ?? '',
      },
      dynastyBands: [], // filled by buildGlobalProjection after all dynasties processed
      nodes,
      edges,
      timeline,
      focusDefaults: { coreNodeId: coreNode ? `person:${coreNode.slug}` : '' },
    };

    await client.query(
      `INSERT INTO dynasty_graph_projections (dynasty_id, bundle)
       VALUES ($1,$2)
       ON CONFLICT (dynasty_id) DO UPDATE SET bundle=$2, built_at=NOW()`,
      [dynasty.id, JSON.stringify(bundle)]
    );

    // Entity detail projections – persons
    for (const person of persons) {
      // All relations involving this person
      const { rows: myRels } = await client.query(
        `SELECT r.from_entity_type, r.from_entity_id, r.to_entity_type, r.to_entity_id,
                r.relation_type, r.weight, r.evidence_note
         FROM relations r
         WHERE (r.from_entity_type='person' AND r.from_entity_id=$1)
            OR (r.to_entity_type='person' AND r.to_entity_id=$1)`,
        [person.id]
      );

      const relatedPeople: import('./types').RelatedPerson[] = [];
      const relatedEvents: import('./types').RelatedEvent[] = [];

      for (const rel of myRels) {
        if (rel.from_entity_type === 'person' && rel.to_entity_type === 'person') {
          const otherId = rel.from_entity_id === person.id ? rel.to_entity_id : rel.from_entity_id;
          const otherSlug = personSlugsById.get(otherId);

          if (otherSlug) {
            // Same dynasty
            const other = personBySlug.get(otherSlug);
            if (other) {
              relatedPeople.push({
                slug: other.slug, name: other.name,
                dynastySlug: dynasty.slug,
                relationType: rel.relation_type as RelationType,
                roleDescription: rel.evidence_note ?? '',
                nodeId: `person:${other.slug}`,
              });
            }
          } else {
            // Cross-dynasty: query DB
            const { rows: [cross] } = await client.query(
              `SELECT p.slug, p.name, d.slug as dynasty_slug
               FROM persons p JOIN dynasties d ON d.id=p.dynasty_id WHERE p.id=$1`,
              [otherId]
            );
            if (cross) {
              relatedPeople.push({
                slug: cross.slug, name: cross.name,
                dynastySlug: cross.dynasty_slug,
                relationType: rel.relation_type as RelationType,
                roleDescription: rel.evidence_note ?? '',
                nodeId: `person:${cross.slug}`,
              });
            }
          }
        } else {
          const evId = rel.from_entity_type === 'event' ? rel.from_entity_id : rel.to_entity_id;
          const evSlug = eventSlugsById.get(evId);

          if (evSlug) {
            const ev = eventBySlug.get(evSlug);
            if (ev) {
              relatedEvents.push({
                slug: ev.slug, name: ev.name,
                dynastySlug: dynasty.slug,
                year: ev.time_start,
                description: rel.evidence_note ?? '',
                nodeId: `event:${ev.slug}`,
              });
            }
          } else {
            const { rows: [cross] } = await client.query(
              `SELECT e.slug, e.name, e.time_start, d.slug as dynasty_slug
               FROM events e JOIN dynasties d ON d.id=e.dynasty_id WHERE e.id=$1`,
              [evId]
            );
            if (cross) {
              relatedEvents.push({
                slug: cross.slug, name: cross.name,
                dynastySlug: cross.dynasty_slug,
                year: cross.time_start,
                description: rel.evidence_note ?? '',
                nodeId: `event:${cross.slug}`,
              });
            }
          }
        }
      }

      const dynastyName = dynasty.name as string;
      const detail: import('./types').PersonDetailProjection = {
        entityType: 'person',
        slug: person.slug,
        name: person.name,
        dynastySlug: dynasty.slug,
        dynastyName,
        primaryRole: person.primary_role as PersonRole,
        roles: (person.roles_json ?? []) as PersonRole[],
        summary: person.summary ?? '',
        content: person.content ?? null,
        birthYear: person.birth_year ?? null,
        deathYear: person.death_year ?? null,
        importanceScore: person.importance_score,
        imageUrl: person.image_url ?? null,
        relatedPeople: relatedPeople.slice(0, 10),
        relatedEvents: relatedEvents.slice(0, 8),
        status: 'active',
      };

      await client.query(
        `INSERT INTO entity_detail_projections (entity_type, entity_id, detail)
         VALUES ('person',$1,$2)
         ON CONFLICT (entity_type, entity_id) DO UPDATE SET detail=$2, built_at=NOW()`,
        [person.id, JSON.stringify(detail)]
      );

      // Search document
      const { rows: aliasRows } = await client.query(
        `SELECT alias FROM entity_aliases WHERE entity_type='person' AND entity_id=$1`,
        [person.id]
      );
      await client.query(
        `INSERT INTO search_documents
           (entity_type, entity_id, entity_slug, display_name, aliases, dynasty_slug, subtitle, target_route, weight)
         VALUES ('person',$1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (entity_type, entity_id) DO UPDATE SET
           display_name=$3, aliases=$4, dynasty_slug=$5, subtitle=$6, target_route=$7, weight=$8`,
        [
          person.id, person.slug, person.name,
          aliasRows.map(a => a.alias),
          dynasty.slug,
          `${dynasty.name} · ${person.primary_role}`,
          `/dynasty/${dynasty.slug}?focus=person:${person.slug}`,
          person.importance_score,
        ]
      );
    }

    // Entity detail projections – events
    for (const event of events) {
      const { rows: myRels } = await client.query(
        `SELECT r.from_entity_type, r.from_entity_id, r.to_entity_type, r.to_entity_id,
                r.relation_type, r.weight, r.evidence_note
         FROM relations r
         WHERE r.from_entity_type='event' AND r.from_entity_id=$1`,
        [event.id]
      );

      const participants: import('./types').RelatedPerson[] = myRels
        .filter(r => r.to_entity_type === 'person')
        .sort((a, b) => b.weight - a.weight)
        .map(r => {
          const p = personBySlug.get(personSlugsById.get(r.to_entity_id) ?? '');
          return p ? {
            slug: p.slug,
            name: p.name,
            dynastySlug: dynasty.slug,
            relationType: 'participation' as RelationType,
            roleDescription: r.evidence_note ?? '',
            nodeId: `person:${p.slug}`,
          } : null;
        })
        .filter((x): x is import('./types').RelatedPerson => x !== null);

      const detail: import('./types').EventDetailProjection = {
        entityType: 'event',
        slug: event.slug,
        name: event.name,
        dynastySlug: dynasty.slug,
        dynastyName: dynasty.name,
        timeStart: event.time_start,
        timeEnd: event.time_end ?? null,
        summary: event.summary ?? '',
        content: event.content ?? null,
        imageUrl: event.image_url ?? null,
        participants,
        relatedEvents: [],
        status: 'active',
      };

      await client.query(
        `INSERT INTO entity_detail_projections (entity_type, entity_id, detail)
         VALUES ('event',$1,$2)
         ON CONFLICT (entity_type, entity_id) DO UPDATE SET detail=$2, built_at=NOW()`,
        [event.id, JSON.stringify(detail)]
      );

      const { rows: aliasRows } = await client.query(
        `SELECT alias FROM entity_aliases WHERE entity_type='event' AND entity_id=$1`,
        [event.id]
      );
      const yearLabel = event.time_start < 0
        ? `公元前${Math.abs(event.time_start)}年`
        : `${event.time_start}年`;
      await client.query(
        `INSERT INTO search_documents
           (entity_type, entity_id, entity_slug, display_name, aliases, dynasty_slug, subtitle, target_route, weight)
         VALUES ('event',$1,$2,$3,$4,$5,$6,$7,70)
         ON CONFLICT (entity_type, entity_id) DO UPDATE SET
           display_name=$3, aliases=$4, dynasty_slug=$5, subtitle=$6, target_route=$7, weight=70`,
        [
          event.id, event.slug, event.name,
          aliasRows.map(a => a.alias),
          dynasty.slug,
          `${dynasty.name} · ${yearLabel}`,
          `/dynasty/${dynasty.slug}?focus=event:${event.slug}`,
        ]
      );
    }

    // Dynasty search document
    const yearRange = (y: number) => y < 0 ? `公元前${Math.abs(y)}年` : `${y}年`;
    await client.query(
      `INSERT INTO search_documents
         (entity_type, entity_id, entity_slug, display_name, aliases, dynasty_slug, subtitle, target_route, weight)
       VALUES ('dynasty',$1,$2,$3,'{}','$2',$4,$5,90)
       ON CONFLICT (entity_type, entity_id) DO UPDATE SET
         display_name=$3, subtitle=$4, target_route=$5, weight=90`,
      [
        dynasty.id, dynasty.slug, dynasty.name,
        `${yearRange(dynasty.start_year)} — ${yearRange(dynasty.end_year)}`,
        `/dynasty/${dynasty.slug}`,
      ]
    );
  }
}

// ── Global projection ─────────────────────────────────────────────────────────

export async function buildGlobalProjection(client: import('pg').PoolClient): Promise<void> {
  const { rows: dynasties } = await client.query(
    `SELECT id, slug, name, start_year, end_year FROM dynasties WHERE status='active' ORDER BY start_year`
  );

  const dynastyBands: import('./types').DynastyBand[] = dynasties.map(d => ({
    slug: d.slug,
    name: d.name,
    startYear: d.start_year,
    endYear: d.end_year,
    color: dynastyBandColor(d.slug),
  }));

  // Collect all nodes from per-dynasty projections
  const allNodesMap = new Map<string, import('./types').GraphNode>();
  const allEdgesMap = new Map<string, import('./types').GraphEdge>();
  const allTimeline: import('./types').TimelineEntry[] = [];

  for (const dynasty of dynasties) {
    const { rows } = await client.query(
      `SELECT bundle FROM dynasty_graph_projections WHERE dynasty_id=$1`, [dynasty.id]
    );
    if (!rows.length) continue;
    const bundle = rows[0].bundle as DynastyGraphBundle;

    for (const node of bundle.nodes) {
      if (!allNodesMap.has(node.id)) allNodesMap.set(node.id, node);
    }
    for (const edge of bundle.edges) {
      if (!allEdgesMap.has(edge.id)) {
        allEdgesMap.set(`${edge.source}--${edge.target}--${edge.relationType}`, edge);
      }
    }
    for (const entry of bundle.timeline) {
      allTimeline.push(entry);
    }
  }

  // Cross-dynasty edges: query all relations where endpoints are in different dynasties
  const { rows: crossRels } = await client.query(`
    SELECT r.from_entity_type, r.to_entity_type, r.relation_type, r.weight, r.evidence_note,
           COALESCE(fp.slug, fe.slug) as from_slug,
           COALESCE(tp.slug, te.slug) as to_slug
    FROM relations r
    LEFT JOIN persons fp ON r.from_entity_type='person' AND r.from_entity_id=fp.id
    LEFT JOIN events  fe ON r.from_entity_type='event'  AND r.from_entity_id=fe.id
    LEFT JOIN persons tp ON r.to_entity_type='person'   AND r.to_entity_id=tp.id
    LEFT JOIN events  te ON r.to_entity_type='event'    AND r.to_entity_id=te.id
  `);

  const edgeColors: Record<string, string> = {
    blood: '#DC2626', political: '#2563EB', conflict: '#EA580C',
    participation: '#64748B', subordinate: '#7C3AED',
  };

  crossRels.forEach((r, i) => {
    if (!r.from_slug || !r.to_slug) return;
    const source = `${r.from_entity_type}:${r.from_slug}`;
    const target = `${r.to_entity_type}:${r.to_slug}`;
    const key = `${source}--${target}--${r.relation_type}`;
    if (!allEdgesMap.has(key)) {
      allEdgesMap.set(key, {
        id: `global-edge-${i}`,
        source,
        target,
        relationType: r.relation_type as import('./types').RelationType,
        color: edgeColors[r.relation_type] || '#64748B',
        size: r.weight >= 9 ? 3 : r.weight >= 6 ? 2 : 1,
        label: r.evidence_note,
      });
    }
  });

  // Sort timeline by year
  allTimeline.sort((a, b) => a.year - b.year);

  // For each dynasty, update its stored bundle with dynastyBands + global nodes/edges/timeline
  for (const dynasty of dynasties) {
    const { rows } = await client.query(
      `SELECT bundle FROM dynasty_graph_projections WHERE dynasty_id=$1`, [dynasty.id]
    );
    if (!rows.length) continue;
    const existingBundle = rows[0].bundle as DynastyGraphBundle;

    const globalBundle: DynastyGraphBundle = {
      dynasty: existingBundle.dynasty,
      dynastyBands,
      nodes: Array.from(allNodesMap.values()),
      edges: Array.from(allEdgesMap.values()),
      timeline: allTimeline,
      focusDefaults: existingBundle.focusDefaults,
    };

    await client.query(
      `UPDATE dynasty_graph_projections SET bundle=$1, built_at=NOW() WHERE dynasty_id=$2`,
      [JSON.stringify(globalBundle), dynasty.id]
    );
  }

  // Store a standalone global projection (used if no dynasty context needed)
  const standaloneBundle = {
    dynastyBands,
    nodes: Array.from(allNodesMap.values()),
    edges: Array.from(allEdgesMap.values()),
    timeline: allTimeline,
    focusDefaults: { coreNodeId: dynasties.length > 0
      ? `person:${(Array.from(allNodesMap.values()).find(n => n.entityType === 'person' && n.importanceScore >= 90)?.entitySlug ?? '')}`
      : '' },
  };

  await client.query(
    `INSERT INTO global_graph_projection (bundle)
     VALUES ($1)
     ON CONFLICT DO NOTHING`,
    [JSON.stringify(standaloneBundle)]
  );
  // Always update the latest row
  await client.query(
    `UPDATE global_graph_projection SET bundle=$1, built_at=NOW()`,
    [JSON.stringify(standaloneBundle)]
  );
}

// ── Entry point ───────────────────────────────────────────────────────────────

export async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(SCHEMA_SQL);

    const { rows } = await client.query('SELECT COUNT(*) as count FROM dynasties');
    const isEmpty = parseInt(rows[0].count) === 0;

    if (isEmpty) {
      await seedFromFiles(client);
      await buildProjections(client);
      await buildGlobalProjection(client);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
