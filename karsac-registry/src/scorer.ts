import type { Entity, EntityMap } from './types.js';

export type MatchReason =
  | 'exact-id'
  | 'exact-title'
  | 'exact-title-prefix'
  | 'possessive-title'
  | 'id-slug'
  | 'exact-alias'
  | 'tag-match'
  | 'related-match';

export interface ScoredMatch {
  entity: Entity;
  score: number;
  matchReason: MatchReason;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function isBestMatch(ranked: ScoredMatch[]): boolean {
  if (ranked.length === 0) return false;
  const top = ranked[0];
  if (top.score < 85) return false;
  const nextNonCard = ranked.slice(1).find(m => m.entity.type !== 'entity-card');
  if (!nextNonCard) return true;
  return top.score - nextNonCard.score >= 4;
}

export function scoreMatches(
  query: string,
  candidateIds: string[],
  entities: EntityMap,
): ScoredMatch[] {
  const q = query.toLowerCase().trim();
  const seen = new Set<string>();
  const results: ScoredMatch[] = [];

  for (const id of candidateIds) {
    if (seen.has(id)) continue;
    seen.add(id);

    const entity = entities[id];
    if (!entity) continue;

    const { reason, base } = classifyMatch(q, entity);
    const bonus = typeBonus(entity);
    results.push({ entity, score: base + bonus, matchReason: reason });
  }

  return results.sort(byScoreDescThenId);
}

// ── Classification ────────────────────────────────────────────────────────────

interface Classification {
  reason: MatchReason;
  base: number;
}

function classifyMatch(q: string, entity: Entity): Classification {
  const titleLower = entity.title.toLowerCase();
  const idLower = entity.id.toLowerCase();

  if (q === idLower) return { reason: 'exact-id', base: 100 };
  if (q === titleLower) return { reason: 'exact-title', base: 90 };

  // exact-title-prefix: title's first word/token equals query
  // Word boundary = space or comma immediately after the query token
  if (titleLower.startsWith(q + ' ') || titleLower.startsWith(q + ',')) {
    return { reason: 'exact-title-prefix', base: 80 };
  }

  // possessive-title: entity is owned/associated with the query subject
  // "brynja's hall" — starts with query + apostrophe-s
  if (titleLower.startsWith(q + "'s") || titleLower.startsWith(q + '’s')) {
    return { reason: 'possessive-title', base: 70 };
  }

  // id-slug: last path segment of entity id matches query exactly
  // Handles umlaut-less queries like "torweg" matching id "places/torweg"
  const idSlug = idLower.split('/').pop() ?? '';
  if (idSlug === q) return { reason: 'id-slug', base: 75 };

  // exact-alias: query matches a structural alias (derived from title/id, not just a tag)
  // We exclude tag-generated aliases here so that entities related only by tag fall to tag-match
  if (isStructuralAlias(q, entity)) {
    return { reason: 'exact-alias', base: 60 };
  }

  // tag-match: query exactly matches one of the entity's tags
  if (entity.tags.some(t => t.toLowerCase() === q)) {
    return { reason: 'tag-match', base: 40 };
  }

  return { reason: 'related-match', base: 20 };
}

// ── Type bonus ────────────────────────────────────────────────────────────────

function typeBonus(entity: Entity): number {
  // For entity-cards, use the wrapped entityType for the type bonus
  const effectiveType =
    entity.type === 'entity-card' ? (entity.entityType ?? 'entity-card') : entity.type;

  let bonus = 0;
  switch (effectiveType) {
    case 'npc':      bonus = 10; break;
    case 'pc':       bonus = 8;  break;
    case 'item':     bonus = 5;  break;
    case 'place':    bonus = 4;  break;
    case 'event':    bonus = 4;  break;
    case 'faction':  bonus = 4;  break;
    case 'force':    bonus = 4;  break;
    case 'concept':  bonus = 3;  break;
    case 'mechanics': bonus = 2; break;
    default:         bonus = 3;  break;
  }

  // Canonical files outrank their entity-card wrappers at every tier
  if (entity.type === 'entity-card') bonus -= 4;

  return bonus;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns true if the query matches an alias that was structurally derived from
 * the entity's title or id — not just echoed in from a tag.
 *
 * Background: the indexer adds every tag to the entity's alias list so tag-based
 * lookups work. That means a "brynja" tag on Törweg Council ends up in aliases[],
 * which would otherwise cause it to score as exact-alias rather than tag-match.
 * We demote those cases by checking whether the alias also appears in the tag set.
 */
function isStructuralAlias(q: string, entity: Entity): boolean {
  const tagSet = new Set(entity.tags.map(t => t.toLowerCase()));
  return entity.aliases.some(a => a.toLowerCase() === q && !tagSet.has(q));
}

// ── Sort ──────────────────────────────────────────────────────────────────────

function byScoreDescThenId(a: ScoredMatch, b: ScoredMatch): number {
  if (b.score !== a.score) return b.score - a.score;
  // Stable tie-break: canonical files before entity-cards, then alphabetical id
  const aIsCard = a.entity.type === 'entity-card' ? 1 : 0;
  const bIsCard = b.entity.type === 'entity-card' ? 1 : 0;
  if (aIsCard !== bIsCard) return aIsCard - bIsCard;
  return a.entity.id.localeCompare(b.entity.id);
}
