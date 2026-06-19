export interface Entity {
  id: string;
  type: string;
  source?: 'collections' | 'planning';
  ruleset?: string;
  entityType?: string;
  entityId?: string;
  title: string;
  path: string;
  collection: string;
  visibility?: string;
  canonical?: string;
  summary?: string;
  retrievalSummary?: string;
  canonFileId?: string;
  entityCardId?: string;
  primaryDetailFile?: string;
  tags: string[];
  aliases: string[];
  related: Record<string, string[]>;
  doNotConfuseWith: string[];
  lastUpdated?: string;
}

export interface Section {
  level: number;
  heading: string;
  anchor: string;
}

export type EntityMap = Record<string, Entity>;

// alias (lowercase) → entity id[]
export type AliasMap = Record<string, string[]>;

// entity id → related map
export type RelationshipMap = Record<string, Record<string, string[]>>;

// entity id → section list
export type SectionMap = Record<string, Section[]>;
