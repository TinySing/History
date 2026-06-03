export type EntityType = 'person' | 'event' | 'dynasty';
export type PersonRole = 'emperor' | 'strategist' | 'general' | 'minister' | 'royalty' | 'warlord' | 'consort' | 'rebel' | 'other';
export type RelationType = 'blood' | 'political' | 'conflict' | 'participation' | 'subordinate';
export type EntityStatus = 'active' | 'pending';

// DB rows
export interface DynastyRow {
  id: number;
  slug: string;
  name: string;
  start_year: number;
  end_year: number;
  summary: string | null;
  status: EntityStatus;
}

export interface PersonRow {
  id: number;
  slug: string;
  name: string;
  dynasty_id: number;
  primary_role: PersonRole;
  roles_json: PersonRole[];
  summary: string | null;
  content: string | null;
  importance_score: number;
  birth_year: number | null;
  death_year: number | null;
  status: EntityStatus;
}

export interface EventRow {
  id: number;
  slug: string;
  name: string;
  dynasty_id: number;
  time_start: number | null;
  time_end: number | null;
  summary: string | null;
  content: string | null;
  status: EntityStatus;
}

export interface RelationRow {
  id: number;
  from_entity_type: EntityType;
  from_entity_id: number;
  to_entity_type: EntityType;
  to_entity_id: number;
  relation_type: RelationType;
  weight: number;
  direction: 'directed' | 'undirected';
  evidence_note: string | null;
}

// Dynasty background band
export interface DynastyBand {
  slug: string;
  name: string;
  startYear: number;
  endYear: number;
  color: string;
}

// Graph projection types
export interface GraphNode {
  id: string;
  label: string;
  entityType: 'person' | 'event';
  entitySlug: string;
  dynastySlug: string;
  x: number;
  y: number;
  size: number;
  importanceScore: number;
  activeYear: number;
  color: string;
  personRole?: PersonRole;
  imageUrl?: string | null;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationType: RelationType;
  color: string;
  size: number;
  label?: string;
}

export interface TimelineEntry {
  year: number;
  label: string;
  eventSlug?: string;
  nodeId?: string;
}

export interface DynastyGraphBundle {
  dynasty: {
    id: number;
    slug: string;
    name: string;
    startYear: number;
    endYear: number;
    summary: string;
  };
  dynastyBands: DynastyBand[];
  nodes: GraphNode[];
  edges: GraphEdge[];
  timeline: TimelineEntry[];
  focusDefaults: {
    coreNodeId: string;
  };
}

// Detail projection types
export interface RelatedPerson {
  slug: string;
  name: string;
  dynastySlug: string;
  relationType: RelationType;
  roleDescription: string;
  nodeId: string;
}

export interface RelatedEvent {
  slug: string;
  name: string;
  dynastySlug: string;
  year: number | null;
  description: string;
  nodeId: string;
}

export interface PersonDetailProjection {
  entityType: 'person';
  slug: string;
  name: string;
  dynastySlug: string;
  dynastyName: string;
  primaryRole: PersonRole;
  roles: PersonRole[];
  summary: string;
  content: string | null;
  birthYear: number | null;
  deathYear: number | null;
  importanceScore: number;
  imageUrl: string | null;
  relatedPeople: RelatedPerson[];
  relatedEvents: RelatedEvent[];
  status: EntityStatus;
}

export interface EventDetailProjection {
  entityType: 'event';
  slug: string;
  name: string;
  dynastySlug: string;
  dynastyName: string;
  timeStart: number | null;
  timeEnd: number | null;
  summary: string;
  content: string | null;
  imageUrl: string | null;
  participants: RelatedPerson[];
  relatedEvents: RelatedEvent[];
  status: EntityStatus;
}

export type EntityDetailProjection = PersonDetailProjection | EventDetailProjection;

// Search types
export interface SearchResult {
  entityType: EntityType;
  entitySlug: string;
  displayName: string;
  subtitle: string;
  dynastySlug: string | null;
  targetRoute: string;
  focusNodeId: string | null;
  weight: number;
}

// API response types
export interface DynastyListItem {
  id: number;
  slug: string;
  name: string;
  startYear: number;
  endYear: number;
  summary: string;
}

export interface DynastiesResponse {
  dynasties: DynastyListItem[];
  featured: FeaturedEntry[];
}

export interface FeaturedEntry {
  label: string;
  description: string;
  targetRoute: string;
  focusNodeId?: string;
}
