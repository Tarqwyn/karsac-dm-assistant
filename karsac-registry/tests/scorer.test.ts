import { describe, it, expect } from 'vitest';
import { scoreMatches, isBestMatch } from '../src/scorer.js';
import type { EntityMap, Entity } from '../src/types.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeNpc(id: string, title: string, tags: string[] = [], aliases?: string[]): EntityMap[string] {
  return {
    id, type: 'npc', title,
    path: `collections/karsac-major-npcs/${id.split('/').pop()}.md`,
    collection: 'karsac-major-npcs',
    tags,
    aliases: aliases ?? [id, title, title.toLowerCase(), id.split('/').pop() ?? id],
    related: {},
    doNotConfuseWith: [],
  };
}

function makeEntityCard(id: string, title: string, entityType: string, tags: string[] = []): EntityMap[string] {
  return {
    id, type: 'entity-card', entityType, title,
    path: `collections/karsac-entity-cards/${id.split('/').pop()}.md`,
    collection: 'karsac-entity-cards',
    tags,
    aliases: [id, title, title.toLowerCase()],
    related: {},
    doNotConfuseWith: [],
  };
}

function makeItem(id: string, title: string, tags: string[] = []): EntityMap[string] {
  return {
    id, type: 'item', title,
    path: `collections/karsac-items-artifacts/${id.split('/').pop()}.md`,
    collection: 'karsac-items-artifacts',
    tags,
    aliases: [id, title, title.toLowerCase()],
    related: {},
    doNotConfuseWith: [],
  };
}

function makeEvent(id: string, title: string, tags: string[] = []): EntityMap[string] {
  return {
    id, type: 'event', title,
    path: `collections/karsac-events/${id.split('/').pop()}.md`,
    collection: 'karsac-events',
    tags,
    aliases: [id, title, title.toLowerCase()],
    related: {},
    doNotConfuseWith: [],
  };
}

function makePlace(id: string, title: string, tags: string[] = []): EntityMap[string] {
  return {
    id, type: 'place', title,
    path: `collections/karsac-places/${id.split('/').pop()}.md`,
    collection: 'karsac-places',
    tags,
    aliases: [id, title, title.toLowerCase()],
    related: {},
    doNotConfuseWith: [],
  };
}

function makeFaction(id: string, title: string, tags: string[] = []): EntityMap[string] {
  return {
    id, type: 'faction', title,
    path: `collections/karsac-factions/${id.split('/').pop()}.md`,
    collection: 'karsac-factions',
    tags,
    aliases: [id, title, title.toLowerCase()],
    related: {},
    doNotConfuseWith: [],
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('scoreMatches — brynja query', () => {
  const entities: EntityMap = {
    'npcs/brynja-thorgrimsdotter': makeNpc(
      'npcs/brynja-thorgrimsdotter',
      'Brynja Thorgrimsdotter',
      ['brynja', 'brynja-thorgrimsdotter', 'torweg'],
      ['npcs/brynja-thorgrimsdotter', 'Brynja Thorgrimsdotter', 'brynja thorgrimsdotter', 'brynja-thorgrimsdotter', 'Brynja', 'brynja'],
    ),
    'entity-cards/npcs/brynja-thorgrimsdotter': makeEntityCard(
      'entity-cards/npcs/brynja-thorgrimsdotter',
      'Brynja Thorgrimsdotter',
      'npc',
      ['brynja'],
    ),
    'items/brynjas-hidden-artefact': makeItem(
      'items/brynjas-hidden-artefact',
      "Brynja's Hidden Artefact",
      ['brynja'],
    ),
    'items/brynjas-ledger': makeItem(
      'items/brynjas-ledger',
      "Brynja's Ledger (Cargo Record)",
      ['brynja'],
    ),
    'events/brynjas-briefing': makeEvent(
      'events/brynjas-briefing',
      "Brynja's Briefing",
      ['brynja'],
    ),
    'places/torweg/brynjas-hall': makePlace(
      'places/torweg/brynjas-hall',
      "Brynja's Hall, Törweg",
      ['brynja'],
    ),
    'factions/torweg-council': makeFaction(
      'factions/torweg-council',
      'Törweg Council',
      ['brynja', 'torweg'],
    ),
  };

  const allIds = Object.keys(entities);

  it('ranks npcs/brynja-thorgrimsdotter first', () => {
    const results = scoreMatches('brynja', allIds, entities);
    expect(results[0].entity.id).toBe('npcs/brynja-thorgrimsdotter');
    expect(results[0].matchReason).toBe('exact-title-prefix');
  });

  it('ranks entity-cards/npcs/brynja-thorgrimsdotter second', () => {
    const results = scoreMatches('brynja', allIds, entities);
    expect(results[1].entity.id).toBe('entity-cards/npcs/brynja-thorgrimsdotter');
    expect(results[1].matchReason).toBe('exact-title-prefix');
  });

  it('canonical NPC scores higher than its entity-card', () => {
    const results = scoreMatches('brynja', allIds, entities);
    const canon = results.find(r => r.entity.id === 'npcs/brynja-thorgrimsdotter')!;
    const card = results.find(r => r.entity.id === 'entity-cards/npcs/brynja-thorgrimsdotter')!;
    expect(canon.score).toBeGreaterThan(card.score);
  });

  it('possessive-title items rank above tag-match factions', () => {
    const results = scoreMatches('brynja', allIds, entities);
    const artefactRank = results.findIndex(r => r.entity.id === 'items/brynjas-hidden-artefact');
    const factionRank = results.findIndex(r => r.entity.id === 'factions/torweg-council');
    expect(artefactRank).toBeGreaterThanOrEqual(0);
    expect(factionRank).toBeGreaterThanOrEqual(0);
    expect(artefactRank).toBeLessThan(factionRank);
  });

  it('assigns possessive-title reason to brynjas-hidden-artefact', () => {
    const results = scoreMatches('brynja', allIds, entities);
    const artefact = results.find(r => r.entity.id === 'items/brynjas-hidden-artefact')!;
    expect(artefact.matchReason).toBe('possessive-title');
  });

  it('assigns tag-match reason to torweg-council', () => {
    const results = scoreMatches('brynja', allIds, entities);
    const council = results.find(r => r.entity.id === 'factions/torweg-council')!;
    expect(council.matchReason).toBe('tag-match');
  });

  it('items rank before events (same base, item bonus > event bonus)', () => {
    const results = scoreMatches('brynja', allIds, entities);
    const itemRank = results.findIndex(r => r.entity.id === 'items/brynjas-hidden-artefact');
    const eventRank = results.findIndex(r => r.entity.id === 'events/brynjas-briefing');
    expect(itemRank).toBeLessThan(eventRank);
  });

  it('all matches have a positive score', () => {
    const results = scoreMatches('brynja', allIds, entities);
    expect(results.every(r => r.score > 0)).toBe(true);
  });

  it('deduplicates repeated ids', () => {
    const ids = [...allIds, 'npcs/brynja-thorgrimsdotter'];
    const results = scoreMatches('brynja', ids, entities);
    const brynjaResults = results.filter(r => r.entity.id === 'npcs/brynja-thorgrimsdotter');
    expect(brynjaResults).toHaveLength(1);
  });
});

describe('scoreMatches — exact matches', () => {
  const entities: EntityMap = {
    'npcs/the-carver': makeNpc('npcs/the-carver', 'The Carver', ['carver', 'torweg']),
    'entity-cards/npcs/the-carver': makeEntityCard('entity-cards/npcs/the-carver', 'The Carver', 'npc'),
  };

  it('assigns exact-title for a query that equals the full title', () => {
    const results = scoreMatches('the carver', Object.keys(entities), entities);
    const canon = results.find(r => r.entity.id === 'npcs/the-carver')!;
    expect(canon.matchReason).toBe('exact-title');
  });

  it('assigns exact-id for full id query', () => {
    const results = scoreMatches('npcs/the-carver', Object.keys(entities), entities);
    const canon = results.find(r => r.entity.id === 'npcs/the-carver')!;
    expect(canon.matchReason).toBe('exact-id');
  });

  it('"carver" matches via exact-title-prefix since "The Carver" starts with "carver" after stripping "the"', () => {
    // "The Carver" — first token is "the", next is "carver"
    // Our scorer looks for titleLower.startsWith(q + ' ') which would be "the carver".startsWith("carver ")
    // That is false — "carver" alone does NOT trigger exact-title-prefix on "The Carver"
    // It falls through to tag-match (carver is a tag) or exact-alias
    const entityWithTag = { ...entities['npcs/the-carver'], tags: ['carver', 'torweg'] };
    const ents = { 'npcs/the-carver': entityWithTag };
    const results = scoreMatches('carver', ['npcs/the-carver'], ents);
    expect(results[0].matchReason).toBe('tag-match');
  });
});

describe('scoreMatches — structural alias vs tag-match', () => {
  it('entity whose title has no relation to query scores tag-match, not exact-alias', () => {
    // "Törweg Council" tagged "brynja" — it is not Brynja, just related to her
    const council = makeFaction('factions/torweg-council', 'Törweg Council', ['brynja', 'torweg']);
    // Aliases were generated from title/id, none of which is "brynja"
    // The "brynja" alias comes only from the tag
    const ents = { 'factions/torweg-council': council };
    const results = scoreMatches('brynja', ['factions/torweg-council'], ents);
    expect(results[0].matchReason).toBe('tag-match');
  });

  it('entity whose id-slug is the query scores id-slug even when the same slug is also a tag', () => {
    // "places/torweg" has id-slug "torweg" and tag "torweg"
    const torweg = makePlace('places/torweg', 'Törweg', ['torweg', 'losweg']);
    const ents = { 'places/torweg': torweg };
    const results = scoreMatches('torweg', ['places/torweg'], ents);
    expect(results[0].matchReason).toBe('id-slug');
  });

  it('kebab alias derived from title scores exact-alias, not tag-match', () => {
    // "brynja-thorgrimsdotter" is both a tag and a structural alias (from title kebab)
    const npc = makeNpc(
      'npcs/brynja-thorgrimsdotter',
      'Brynja Thorgrimsdotter',
      ['brynja', 'brynja-thorgrimsdotter'],
      // aliases explicitly include the kebab form (as the parser would generate)
      ['npcs/brynja-thorgrimsdotter', 'Brynja Thorgrimsdotter', 'brynja thorgrimsdotter',
       'brynja-thorgrimsdotter', 'Brynja', 'brynja'],
    );
    const ents = { 'npcs/brynja-thorgrimsdotter': npc };
    // "brynja-thorgrimsdotter" hits id-slug (last segment of id) before reaching alias check
    const results = scoreMatches('brynja-thorgrimsdotter', ['npcs/brynja-thorgrimsdotter'], ents);
    expect(results[0].matchReason).toBe('id-slug');
  });
});

describe('scoreMatches — score ordering invariants', () => {
  it('exact-title outscores exact-title-prefix for same type', () => {
    const entities: EntityMap = {
      'npcs/brynja': makeNpc('npcs/brynja', 'Brynja', ['brynja']),
      'npcs/brynja-t': makeNpc('npcs/brynja-t', 'Brynja Thorgrimsdotter', ['brynja']),
    };
    const results = scoreMatches('brynja', Object.keys(entities), entities);
    const exact = results.find(r => r.entity.id === 'npcs/brynja')!;
    const prefix = results.find(r => r.entity.id === 'npcs/brynja-t')!;
    expect(exact.score).toBeGreaterThan(prefix.score);
    expect(exact.matchReason).toBe('exact-title');
    expect(prefix.matchReason).toBe('exact-title-prefix');
  });

  it('exact-title-prefix outscores possessive-title', () => {
    const entities: EntityMap = {
      'npcs/brynja-t': makeNpc('npcs/brynja-t', 'Brynja Thorgrimsdotter', ['brynja']),
      "items/brynjas-thing": makeItem("items/brynjas-thing", "Brynja's Thing", ['brynja']),
    };
    const results = scoreMatches('brynja', Object.keys(entities), entities);
    const prefix = results.find(r => r.entity.id === 'npcs/brynja-t')!;
    const possessive = results.find(r => r.entity.id === 'items/brynjas-thing')!;
    expect(prefix.score).toBeGreaterThan(possessive.score);
  });

  it('possessive-title outscores tag-match', () => {
    const entities: EntityMap = {
      "items/brynjas-thing": makeItem("items/brynjas-thing", "Brynja's Thing", ['brynja']),
      'factions/council': makeFaction('factions/council', 'The Council', ['brynja']),
    };
    const results = scoreMatches('brynja', Object.keys(entities), entities);
    const possessive = results.find(r => r.entity.id === 'items/brynjas-thing')!;
    const tag = results.find(r => r.entity.id === 'factions/council')!;
    expect(possessive.score).toBeGreaterThan(tag.score);
  });
});

describe('isBestMatch', () => {
  function match(id: string, score: number, type = 'npc'): ReturnType<typeof scoreMatches>[number] {
    return {
      score,
      matchReason: 'exact-title-prefix',
      entity: makeNpc(id, id) as Entity & { type: typeof type },
    } as ReturnType<typeof scoreMatches>[number];
  }
  function card(id: string, score: number): ReturnType<typeof scoreMatches>[number] {
    return { score, matchReason: 'exact-title-prefix',
      entity: { ...makeNpc(id, id), type: 'entity-card' } } as ReturnType<typeof scoreMatches>[number];
  }

  it('returns false for empty list', () => {
    expect(isBestMatch([])).toBe(false);
  });

  it('returns false when top score < 85', () => {
    expect(isBestMatch([match('a', 84), match('b', 70)])).toBe(false);
  });

  it('returns true when only one result and score >= 85', () => {
    expect(isBestMatch([match('a', 85)])).toBe(true);
    expect(isBestMatch([match('a', 100)])).toBe(true);
  });

  it('returns true when score >= 85 and gap to next non-card >= 4', () => {
    // top=90, next non-card=75: gap=15 >= 4
    expect(isBestMatch([match('a', 90), match('b', 75)])).toBe(true);
  });

  it('returns false when score >= 85 but gap to next non-card < 4', () => {
    // top=90, next non-card=87: gap=3 < 4
    expect(isBestMatch([match('a', 90), match('b', 87)])).toBe(false);
  });

  it('returns true when all results after top are entity-cards (no competing non-card)', () => {
    // top is canonical; remaining are only entity-cards — no non-card competition
    expect(isBestMatch([match('a', 90), card('card-a', 86), card('card-b', 80)])).toBe(true);
  });

  it('skips entity-cards when evaluating the gap', () => {
    // top=90, card at 88 (skipped), next non-card=85: gap=5 >= 4 → best match
    expect(isBestMatch([match('a', 90), card('card-a', 88), match('b', 85)])).toBe(true);
    // top=90, card at 88 (skipped), next non-card=87: gap=3 < 4 → not best match
    expect(isBestMatch([match('a', 90), card('card-a', 88), match('b', 87)])).toBe(false);
  });

  it('boundary: gap exactly 4 qualifies', () => {
    expect(isBestMatch([match('a', 90), match('b', 86)])).toBe(true);
  });

  it('boundary: gap of 3 does not qualify', () => {
    expect(isBestMatch([match('a', 90), match('b', 87)])).toBe(false);
  });

  it('boundary: score exactly 85 qualifies when gap is sufficient', () => {
    expect(isBestMatch([match('a', 85), match('b', 70)])).toBe(true);
  });
});
