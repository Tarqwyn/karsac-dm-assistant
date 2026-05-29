import { describe, it, expect } from 'vitest';
import { resolveEntities, resolveQuestion, resolveRulesQuestion, MAX_ENTITIES, normalizeRelatedId, buildRulesMessages, buildDesignMessages } from '../src/resolver.js';
import type { EntityMap, AliasMap } from '../src/types.js';
import type { StructuredEntry, CanonFile } from '../src/resolver.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PARSER_STOP_WORDS = new Set(['a', 'an', 'the', 'of', 'in', 'at', 'and', 'or', 'to']);

/** Mirror the alias generation logic from src/parser.ts buildAliases. */
function buildEntityAliases(id: string, title: string, tags: string[]): string[] {
  const seen = new Set<string>();
  const add = (s: string) => { if (s.trim()) seen.add(s.trim()); };
  const toKebab = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');

  add(id);
  add(title);
  add(title.toLowerCase());
  add(toKebab(title));

  const words = title.split(/\s+/);
  if (words.length > 1) {
    const first = words[0];
    if (!PARSER_STOP_WORDS.has(first.toLowerCase())) {
      add(first);
      add(first.toLowerCase());
    }
    if (first.toLowerCase() === 'the') {
      const withoutThe = words.slice(1).join(' ');
      add(withoutThe);
      add(withoutThe.toLowerCase());
      add(toKebab(withoutThe));
    }
  }

  for (const tag of tags) add(tag);
  return [...seen];
}

function makeNpc(id: string, title: string, tags: string[] = [], extra: Partial<EntityMap[string]> = {}): EntityMap[string] {
  const slug = id.split('/').pop() ?? id;
  return {
    id, type: 'npc', title,
    path: `openwebui-runtime-collections/karsac-major-npcs/${slug}.md`,
    collection: 'karsac-major-npcs',
    tags,
    aliases: buildEntityAliases(id, title, tags),
    related: {},
    doNotConfuseWith: [],
    ...extra,
  };
}

function makeEntityCard(id: string, title: string, primaryDetailFile: string): EntityMap[string] {
  const slug = id.split('/').pop() ?? id;
  return {
    id, type: 'entity-card', title,
    path: `openwebui-runtime-collections/karsac-entity-cards/${slug}.md`,
    collection: 'karsac-entity-cards',
    tags: [],
    aliases: [id, title, title.toLowerCase()],
    related: {},
    doNotConfuseWith: [],
    primaryDetailFile,
  };
}

function makeItem(id: string, title: string, tags: string[] = []): EntityMap[string] {
  const slug = id.split('/').pop() ?? id;
  return {
    id, type: 'item', title,
    path: `openwebui-runtime-collections/karsac-items/${slug}.md`,
    collection: 'karsac-items',
    tags,
    aliases: buildEntityAliases(id, title, tags),
    related: {},
    doNotConfuseWith: [],
  };
}

/**
 * Build an AliasMap from an EntityMap — mirrors what build-index.ts produces.
 * Maps every alias in entity.aliases (lowercase) → [entity.id].
 * Merges multiple entities sharing the same alias into one array.
 */
function buildAliases(entities: EntityMap): AliasMap {
  const aliases: AliasMap = {};
  for (const entity of Object.values(entities)) {
    for (const alias of entity.aliases) {
      const key = alias.toLowerCase();
      if (!aliases[key]) aliases[key] = [];
      if (!aliases[key].includes(entity.id)) aliases[key].push(entity.id);
    }
  }
  return aliases;
}

// ── Core test fixtures ────────────────────────────────────────────────────────

const BRYNJA = makeNpc(
  'npcs/brynja-thorgrimsdotter',
  'Brynja Thorgrimsdotter',
  ['brynja'],
  { summary: 'The reluctant heir' },
);

const BRYNJA_CARD = makeEntityCard(
  'entity-cards/brynja-thorgrimsdotter',
  'Brynja Thorgrimsdotter',
  'npcs/brynja-thorgrimsdotter',
);

const CARVER = makeNpc(
  'npcs/the-carver',
  'The Carver',
  ['carver'],
);

const ARTEFACT = makeItem(
  'items/brynjas-hidden-artefact',
  "Brynja's Hidden Artefact",
  ['brynja'],
);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('resolveEntities — single entity', () => {
  it('resolves a single named entity from a simple question', () => {
    const entities: EntityMap = { [BRYNJA.id]: BRYNJA };
    const aliases = buildAliases(entities);
    const result = resolveEntities('Tell me about Brynja', aliases, entities);
    expect(result).toHaveLength(1);
    expect(result[0].entity.id).toBe('npcs/brynja-thorgrimsdotter');
  });

  it('resolves entity using full title', () => {
    const entities: EntityMap = { [BRYNJA.id]: BRYNJA, [CARVER.id]: CARVER };
    const aliases = buildAliases(entities);
    const result = resolveEntities('What does Brynja Thorgrimsdotter want?', aliases, entities);
    expect(result).toHaveLength(1);
    expect(result[0].entity.id).toBe('npcs/brynja-thorgrimsdotter');
  });

  it('returns empty array when no entity matches', () => {
    const entities: EntityMap = { [BRYNJA.id]: BRYNJA };
    const aliases = buildAliases(entities);
    const result = resolveEntities('Tell me about Lord Winterglass', aliases, entities);
    expect(result).toHaveLength(0);
  });

  it('fallback: resolves via possessive alias when no strict match exists', () => {
    // "Brynja's hall" — possessive match should trigger fallback single-entity path
    // ARTEFACT has a possessive alias "brynja's hidden artefact", but we only want
    // the fallback to return something; here test that fallback fires at all
    const entities: EntityMap = { [BRYNJA.id]: BRYNJA };
    const aliases: AliasMap = {
      ...buildAliases(entities),
      "brynja's": ['npcs/brynja-thorgrimsdotter'],
    };
    const result = resolveEntities("Tell me about Brynja's background", aliases, entities);
    // Fallback should find something
    expect(result.length).toBeGreaterThanOrEqual(1);
  });
});

describe('resolveEntities — multi-entity', () => {
  it('resolves two named entities from a comparison question', () => {
    const entities: EntityMap = { [BRYNJA.id]: BRYNJA, [CARVER.id]: CARVER };
    const aliases = buildAliases(entities);
    const result = resolveEntities('Compare Brynja and The Carver', aliases, entities);
    const ids = result.map(r => r.entity.id);
    expect(ids).toContain('npcs/brynja-thorgrimsdotter');
    expect(ids).toContain('npcs/the-carver');
    expect(result).toHaveLength(2);
  });

  it('orders results by first occurrence in the question', () => {
    const entities: EntityMap = { [BRYNJA.id]: BRYNJA, [CARVER.id]: CARVER };
    const aliases = buildAliases(entities);
    const result = resolveEntities('Compare Brynja and The Carver', aliases, entities);
    expect(result[0].entity.id).toBe('npcs/brynja-thorgrimsdotter');
    expect(result[1].entity.id).toBe('npcs/the-carver');
  });

  it('orders correctly when Carver appears first', () => {
    const entities: EntityMap = { [BRYNJA.id]: BRYNJA, [CARVER.id]: CARVER };
    const aliases = buildAliases(entities);
    const result = resolveEntities('How does The Carver differ from Brynja?', aliases, entities);
    expect(result[0].entity.id).toBe('npcs/the-carver');
    expect(result[1].entity.id).toBe('npcs/brynja-thorgrimsdotter');
  });

  it('does NOT include possessive-match entities in multi-entity results', () => {
    // "Brynja's Hidden Artefact" shares the brynja tag/possessive alias
    // It must NOT appear when strict multi-entity pass runs
    const entities: EntityMap = {
      [BRYNJA.id]: BRYNJA,
      [CARVER.id]: CARVER,
      [ARTEFACT.id]: ARTEFACT,
    };
    const aliases: AliasMap = {
      ...buildAliases(entities),
      "brynja's hidden artefact": ['items/brynjas-hidden-artefact'],
      "brynjas-hidden-artefact": ['items/brynjas-hidden-artefact'],
    };
    const result = resolveEntities('Compare Brynja and The Carver', aliases, entities);
    const ids = result.map(r => r.entity.id);
    expect(ids).not.toContain('items/brynjas-hidden-artefact');
    expect(ids).toHaveLength(2);
  });

  it('deduplicates entity-card and canon file — returns canon file only', () => {
    const entities: EntityMap = {
      [BRYNJA.id]: BRYNJA,
      [BRYNJA_CARD.id]: BRYNJA_CARD,
      [CARVER.id]: CARVER,
    };
    const aliases = buildAliases(entities);
    const result = resolveEntities('Compare Brynja and The Carver', aliases, entities);
    const ids = result.map(r => r.entity.id);
    // Entity card should be collapsed into canon file — not appear separately
    expect(ids).not.toContain('entity-cards/brynja-thorgrimsdotter');
    expect(ids).toContain('npcs/brynja-thorgrimsdotter');
    expect(result).toHaveLength(2);
  });

  it('caps results at MAX_ENTITIES', () => {
    const npcs: EntityMap = {};
    for (let i = 1; i <= 7; i++) {
      const id = `npcs/npc-${i}`;
      npcs[id] = makeNpc(id, `NPC ${i}`);
    }
    const aliases = buildAliases(npcs);
    // Question naming 7 entities
    const question = Object.values(npcs).map(n => n.title).join(' and ');
    const result = resolveEntities(question, aliases, npcs);
    expect(result.length).toBeLessThanOrEqual(MAX_ENTITIES);
  });
});

describe('resolveEntities — edge cases', () => {
  it('handles trailing punctuation on entity names', () => {
    const entities: EntityMap = { [BRYNJA.id]: BRYNJA };
    const aliases = buildAliases(entities);
    const result = resolveEntities('Who is Brynja?', aliases, entities);
    expect(result).toHaveLength(1);
    expect(result[0].entity.id).toBe('npcs/brynja-thorgrimsdotter');
  });

  it('ignores stop words as standalone tokens', () => {
    const entities: EntityMap = { [BRYNJA.id]: BRYNJA };
    const aliases = buildAliases(entities);
    // "the" is a stop word — should not match anything on its own
    const result = resolveEntities('What is the deal with Brynja', aliases, entities);
    expect(result).toHaveLength(1);
    expect(result[0].entity.id).toBe('npcs/brynja-thorgrimsdotter');
  });

  it('returns empty for a question with only stop words', () => {
    const entities: EntityMap = { [BRYNJA.id]: BRYNJA };
    const aliases = buildAliases(entities);
    const result = resolveEntities('what is the', aliases, entities);
    expect(result).toHaveLength(0);
  });
});

// ── Acceptance tests: resolveQuestion ────────────────────────────────────────
// These use synthetic fixtures that mirror real alias structure (including the
// parenthetical suffix on the ledger title) to validate the full comparison path.

const ALDRIC = makeNpc('npcs/aldric-vane', 'Aldric Vane');

// Item with parenthetical title — "Brynja's Ledger" is NOT a standalone alias key;
// only "brynja's ledger (cargo record)" exists, matching via prefix scan.
function makeLedger(): EntityMap[string] {
  const id = 'items/brynjas-ledger';
  const title = "Brynja's Ledger (Cargo Record)";
  return {
    id, type: 'item', title,
    path: `openwebui-runtime-collections/karsac-items/brynjas-ledger.md`,
    collection: 'karsac-items',
    tags: ['brynja', 'ledger', 'chapter-2'],
    aliases: buildEntityAliases(id, title, ['brynja', 'ledger', 'chapter-2']),
    related: {},
    doNotConfuseWith: [],
  };
}

const LEDGER = makeLedger();

describe('resolveQuestion — acceptance tests', () => {
  it('A: Compare Brynja and The Carver → resolves both, no unresolved', () => {
    const entities: EntityMap = { [BRYNJA.id]: BRYNJA, [CARVER.id]: CARVER };
    const aliases = buildAliases(entities);
    const result = resolveQuestion('Compare Brynja and The Carver', aliases, entities);
    expect(result.unresolved).toHaveLength(0);
    const ids = result.resolved.map(r => r.entity.id);
    expect(ids).toContain('npcs/brynja-thorgrimsdotter');
    expect(ids).toContain('npcs/the-carver');
    expect(result.resolved).toHaveLength(2);
  });

  it('A: resolved entities are ordered by first occurrence (Brynja before Carver)', () => {
    const entities: EntityMap = { [BRYNJA.id]: BRYNJA, [CARVER.id]: CARVER };
    const aliases = buildAliases(entities);
    const result = resolveQuestion('Compare Brynja and The Carver', aliases, entities);
    expect(result.resolved[0].entity.id).toBe('npcs/brynja-thorgrimsdotter');
    expect(result.resolved[1].entity.id).toBe('npcs/the-carver');
  });

  it('B: Compare Brynja, Aldric Vane, and The Carver → resolves all three', () => {
    const entities: EntityMap = {
      [BRYNJA.id]: BRYNJA,
      [ALDRIC.id]: ALDRIC,
      [CARVER.id]: CARVER,
    };
    const aliases = buildAliases(entities);
    const result = resolveQuestion(
      'Compare Brynja, Aldric Vane, and The Carver', aliases, entities,
    );
    expect(result.unresolved).toHaveLength(0);
    const ids = result.resolved.map(r => r.entity.id);
    expect(ids).toContain('npcs/brynja-thorgrimsdotter');
    expect(ids).toContain('npcs/aldric-vane');
    expect(ids).toContain('npcs/the-carver');
    expect(result.resolved).toHaveLength(3);
  });

  it('C: Compare Brynja and Lord Winterglass → Brynja resolved, Winterglass unresolved', () => {
    const entities: EntityMap = { [BRYNJA.id]: BRYNJA };
    const aliases = buildAliases(entities);
    const result = resolveQuestion('Compare Brynja and Lord Winterglass', aliases, entities);
    expect(result.resolved.map(r => r.entity.id)).toContain('npcs/brynja-thorgrimsdotter');
    expect(result.unresolved).toContain('Lord Winterglass');
    expect(result.unresolved).toHaveLength(1);
  });

  it('D: Compare Brynja and Brynja\'s Ledger → both resolved via prefix alias', () => {
    const entities: EntityMap = { [BRYNJA.id]: BRYNJA, [LEDGER.id]: LEDGER };
    // Manually add the parenthetical alias key (mirrors what the real indexer writes)
    const aliases = buildAliases(entities);
    aliases["brynja's ledger (cargo record)"] = ['items/brynjas-ledger'];
    const result = resolveQuestion("Compare Brynja and Brynja's Ledger", aliases, entities);
    expect(result.unresolved).toHaveLength(0);
    const ids = result.resolved.map(r => r.entity.id);
    expect(ids).toContain('npcs/brynja-thorgrimsdotter');
    expect(ids).toContain('items/brynjas-ledger');
    expect(result.resolved).toHaveLength(2);
  });

  it('E: Tell me about Brynja → single entity, no unresolved', () => {
    const entities: EntityMap = {
      [BRYNJA.id]: BRYNJA,
      [LEDGER.id]: LEDGER,
    };
    const aliases = buildAliases(entities);
    const result = resolveQuestion('Tell me about Brynja', aliases, entities);
    expect(result.unresolved).toHaveLength(0);
    expect(result.resolved).toHaveLength(1);
    expect(result.resolved[0].entity.id).toBe('npcs/brynja-thorgrimsdotter');
  });

  it('E: single-entity query does not pull in possessive-tagged entities', () => {
    const entities: EntityMap = {
      [BRYNJA.id]: BRYNJA,
      [LEDGER.id]: LEDGER,
      [ARTEFACT.id]: ARTEFACT,
    };
    const aliases = buildAliases(entities);
    const result = resolveQuestion('Tell me about Brynja', aliases, entities);
    const ids = result.resolved.map(r => r.entity.id);
    expect(ids).not.toContain('items/brynjas-hidden-artefact');
    expect(ids).not.toContain('items/brynjas-ledger');
    expect(result.resolved).toHaveLength(1);
  });
});

// ── normalizeRelatedId ────────────────────────────────────────────────────────

describe('normalizeRelatedId', () => {
  it('prefixes a bare slug', () => {
    expect(normalizeRelatedId('forces', 'vishara')).toBe('forces/vishara');
  });

  it('prefixes a bare slug for npcs', () => {
    expect(normalizeRelatedId('npcs', 'brynja-thorgrimsdotter')).toBe('npcs/brynja-thorgrimsdotter');
  });

  it('does not double-prefix an already-prefixed slug', () => {
    expect(normalizeRelatedId('places', 'places/torweg')).toBe('places/torweg');
  });

  it('does not double-prefix npcs/ slug', () => {
    expect(normalizeRelatedId('npcs', 'npcs/brynja-thorgrimsdotter')).toBe('npcs/brynja-thorgrimsdotter');
  });

  it('sub-location slug torweg/council-archives → places/torweg/council-archives', () => {
    expect(normalizeRelatedId('places', 'torweg/council-archives')).toBe('places/torweg/council-archives');
  });

  it('sub-location slug torweg/south-dock → places/torweg/south-dock', () => {
    expect(normalizeRelatedId('places', 'torweg/south-dock')).toBe('places/torweg/south-dock');
  });

  it('already-fully-qualified places/torweg/council-archives returned as-is', () => {
    expect(normalizeRelatedId('places', 'places/torweg/council-archives')).toBe('places/torweg/council-archives');
  });

  it('bare place slug gets places/ prefix', () => {
    expect(normalizeRelatedId('places', 'stormwatch-mountains')).toBe('places/stormwatch-mountains');
  });

  it('uses fallback prefix for unknown relType', () => {
    expect(normalizeRelatedId('customs', 'something')).toBe('customs/something');
  });

  it('rules/ slug returned as-is (fully qualified)', () => {
    expect(normalizeRelatedId('rules', 'rules/core/advantage-disadvantage')).toBe('rules/core/advantage-disadvantage');
  });

  it('bare rule slug gets rules/ prefix', () => {
    expect(normalizeRelatedId('rules', 'concentration')).toBe('rules/concentration');
  });
});

// ── resolveRulesQuestion ──────────────────────────────────────────────────────

function makeRule(id: string, title: string, tags: string[] = [], related: Record<string, string[]> = {}): EntityMap[string] {
  const slug = id.split('/').pop() ?? id;
  return {
    id, type: 'rule', title,
    path: `openwebui-runtime-collections/karsac-rules-dnd-2014-core/${slug}.md`,
    collection: 'karsac-rules-dnd-2014-core',
    ruleset: 'dnd-5e-2014',
    tags,
    aliases: buildEntityAliases(id, title, tags),
    related,
    doNotConfuseWith: [],
  };
}

function makePlace(id: string, title: string, tags: string[] = []): EntityMap[string] {
  const slug = id.split('/').pop() ?? id;
  return {
    id, type: 'place', title,
    path: `openwebui-runtime-collections/karsac-places/${slug}.md`,
    collection: 'karsac-places',
    tags,
    aliases: buildEntityAliases(id, title, tags),
    related: {},
    doNotConfuseWith: [],
  };
}

const GRAPPLE_RULE = makeRule('rules/core/grapple-and-shove', 'Grapple and Shove', ['grapple', 'shove'], {
  rules: ['rules/core/ability-checks'],
});
const KARSAC_PLACE = makePlace('places/karsac', 'Karsac', ['karsac']);
const TABLE_PRINCIPLES = makeRule('rules/house/table-ruling-principles', 'Table Ruling Principles', ['karsac', 'table']);
const CONCENTRATION_RULE = makeRule('rules/core/concentration', 'Concentration', ['concentration', 'spell']);
const ABILITY_CHECKS_RULE = makeRule('rules/core/ability-checks', 'Ability Checks', ['ability-checks', 'skills']);

describe('resolveRulesQuestion', () => {
  it('resolves a rules query to the rule entity', () => {
    const entities: EntityMap = { [GRAPPLE_RULE.id]: GRAPPLE_RULE };
    const aliases = buildAliases(entities);
    const result = resolveRulesQuestion('How does grapple work?', aliases, entities);
    expect(result.unresolved).toHaveLength(0);
    expect(result.resolved).toHaveLength(1);
    expect(result.resolved[0].entity.id).toBe('rules/core/grapple-and-shove');
  });

  it('strips "Karsac table" and does NOT resolve places/karsac', () => {
    const entities: EntityMap = {
      [GRAPPLE_RULE.id]: GRAPPLE_RULE,
      [KARSAC_PLACE.id]: KARSAC_PLACE,
      [TABLE_PRINCIPLES.id]: TABLE_PRINCIPLES,
    };
    const aliases = buildAliases(entities);
    const result = resolveRulesQuestion(
      'How does grapple work at the Karsac table?',
      aliases,
      entities,
    );
    const ids = result.resolved.map(r => r.entity.id);
    expect(ids).not.toContain('places/karsac');
    expect(ids).toContain('rules/core/grapple-and-shove');
  });

  it('strips "at the Karsac table" variant', () => {
    const entities: EntityMap = {
      [CONCENTRATION_RULE.id]: CONCENTRATION_RULE,
      [KARSAC_PLACE.id]: KARSAC_PLACE,
    };
    const aliases = buildAliases(entities);
    const result = resolveRulesQuestion(
      'How does concentration work at the Karsac table?',
      aliases,
      entities,
    );
    const ids = result.resolved.map(r => r.entity.id);
    expect(ids).not.toContain('places/karsac');
    expect(ids).toContain('rules/core/concentration');
  });

  it('prefers rule entity over lore entity when alias is shared', () => {
    // Both KARSAC_PLACE and TABLE_PRINCIPLES share the alias "karsac"
    // Rule bias should prefer the rule entity
    const entities: EntityMap = {
      [KARSAC_PLACE.id]: KARSAC_PLACE,
      [TABLE_PRINCIPLES.id]: TABLE_PRINCIPLES,
    };
    const aliases = buildAliases(entities);
    const result = resolveRulesQuestion('karsac ruling principles', aliases, entities);
    const ids = result.resolved.map(r => r.entity.id);
    expect(ids).not.toContain('places/karsac');
  });

  it('regression: resolveQuestion (not rules) still resolves places/karsac for lore query', () => {
    const entities: EntityMap = {
      [KARSAC_PLACE.id]: KARSAC_PLACE,
      [GRAPPLE_RULE.id]: GRAPPLE_RULE,
    };
    const aliases = buildAliases(entities);
    const result = resolveQuestion('Tell me about Karsac', aliases, entities);
    const ids = result.resolved.map(r => r.entity.id);
    expect(ids).toContain('places/karsac');
  });

  it('unresolved list is always empty (rules profile does not halt on unresolved)', () => {
    const entities: EntityMap = { [CONCENTRATION_RULE.id]: CONCENTRATION_RULE };
    const aliases = buildAliases(entities);
    const result = resolveRulesQuestion('How does concentration work?', aliases, entities);
    expect(result.unresolved).toHaveLength(0);
  });
});

// ── buildRulesMessages — structured entries ───────────────────────────────────

const STUB_CANON: CanonFile = {
  id: 'rules/core/conditions',
  title: 'Conditions',
  path: 'openwebui-runtime-collections/karsac-rules-dnd-2014-core/conditions.md',
  content: '# Conditions\nEach condition has a fixed rules meaning.',
};

const FRIGHTENED_ENTRY: StructuredEntry = {
  id: 'condition/frightened',
  name: 'Frightened',
  summary: 'A frightened creature has disadvantage on ability checks and attack rolls while the source of fear is in sight, and cannot willingly move closer to it.',
  sourceDataFile: 'rules-data/conditions.json',
  sourceRule: 'rules/core/conditions',
};

describe('buildRulesMessages — structured data injection', () => {
  it('includes the structured data block when entries are supplied', () => {
    const msgs = buildRulesMessages([STUB_CANON], 'What does frightened do?', [FRIGHTENED_ENTRY]);
    const system = msgs[0].content;
    expect(system).toContain('condition/frightened');
    expect(system).toContain('rules-data/conditions.json');
  });

  it('includes the exact condition summary in the prompt', () => {
    const msgs = buildRulesMessages([STUB_CANON], 'What does frightened do?', [FRIGHTENED_ENTRY]);
    const system = msgs[0].content;
    expect(system).toContain('while the source of fear is in sight');
    expect(system).toContain('cannot willingly move closer');
  });

  it('does NOT contain the structured data block when no entries are supplied', () => {
    const msgs = buildRulesMessages([STUB_CANON], 'What does grapple do?');
    const system = msgs[0].content;
    expect(system).not.toContain('Structured Data');
    expect(system).not.toContain('condition/frightened');
  });

  it('marks structured entries as authoritative in the rules list', () => {
    const msgs = buildRulesMessages([STUB_CANON], 'What does frightened do?', [FRIGHTENED_ENTRY]);
    const system = msgs[0].content;
    expect(system.toLowerCase()).toContain('authoritative');
  });

  it('output contract headings are always present', () => {
    const msgs = buildRulesMessages([STUB_CANON], 'What does frightened do?', [FRIGHTENED_ENTRY]);
    const system = msgs[0].content;
    for (const h of ['## Ruling', '## Base 5e rule', '## Karsac table rule', '## At the table', '## Edge cases', '## DM call']) {
      expect(system).toContain(h);
    }
  });

  it('multiple entries all appear in the block', () => {
    const prone: StructuredEntry = {
      id: 'condition/prone',
      name: 'Prone',
      summary: 'A prone creature must crawl or stand to end the condition.',
      sourceDataFile: 'rules-data/conditions.json',
    };
    const msgs = buildRulesMessages([STUB_CANON], 'What are frightened and prone?', [FRIGHTENED_ENTRY, prone]);
    const system = msgs[0].content;
    expect(system).toContain('condition/frightened');
    expect(system).toContain('condition/prone');
  });
});

// ── buildDesignMessages ───────────────────────────────────────────────────────

const LOSWEG_CANON: CanonFile = {
  id: 'places/losweg',
  title: 'Lösweg',
  path: 'openwebui-runtime-collections/karsac-places/losweg.md',
  content: '# Lösweg\nA fortified port town under Zörsdkog authority.',
};

const MOVEMENT_RULES: CanonFile = {
  id: 'rules/core/movement-and-position',
  title: 'Movement and Position',
  path: 'openwebui-runtime-collections/karsac-rules-dnd-2014-core/movement-and-position.md',
  content: '# Movement and Position\nSpeed determines how far a creature can move.',
};

describe('buildDesignMessages', () => {
  it('output contract headings all present with canon + rules', () => {
    const msgs = buildDesignMessages([LOSWEG_CANON], [MOVEMENT_RULES], 'I need a road encounter near Lösweg');
    const system = msgs[0].content;
    for (const h of [
      '## Provisional encounter concept',
      '## Why it fits Karsac',
      '## Encounter setup',
      '## Creatures / opposition',
      '## Terrain and pressure',
      '## What this reveals',
      '## Running it at the table',
      '## Scaling options',
      '## Player-safe description',
      '## Canon status',
    ]) {
      expect(system).toContain(h);
    }
  });

  it('provisional label always present in output contract', () => {
    const msgs = buildDesignMessages([LOSWEG_CANON], [MOVEMENT_RULES], 'I need a road encounter');
    expect(msgs[0].content).toContain('Provisional table material — not canon until accepted');
  });

  it('canon file content is included in the prompt', () => {
    const msgs = buildDesignMessages([LOSWEG_CANON], [MOVEMENT_RULES], 'encounter near Lösweg');
    expect(msgs[0].content).toContain('places/losweg');
    expect(msgs[0].content).toContain('Lösweg');
  });

  it('rules file content is included in the prompt', () => {
    const msgs = buildDesignMessages([LOSWEG_CANON], [MOVEMENT_RULES], 'encounter near Lösweg');
    expect(msgs[0].content).toContain('rules/core/movement-and-position');
  });

  it('works with no canon files (graceful empty state)', () => {
    const msgs = buildDesignMessages([], [MOVEMENT_RULES], 'I need a road encounter');
    const system = msgs[0].content;
    expect(system).toContain('No specific canon context loaded');
    expect(system).toContain('## Provisional encounter concept');
  });

  it('works with no rules files', () => {
    const msgs = buildDesignMessages([LOSWEG_CANON], [], 'I need a road encounter');
    expect(msgs[0].content).toContain('## Provisional encounter concept');
  });

  it('user message is the question', () => {
    const msgs = buildDesignMessages([LOSWEG_CANON], [MOVEMENT_RULES], 'I need a road encounter near Lösweg');
    expect(msgs[1].role).toBe('user');
    expect(msgs[1].content).toBe('I need a road encounter near Lösweg');
  });

  it('marks assistant role as system', () => {
    const msgs = buildDesignMessages([LOSWEG_CANON], [MOVEMENT_RULES], 'encounter');
    expect(msgs[0].role).toBe('system');
  });

  it('provisional table material phrase appears in canon status instructions', () => {
    const msgs = buildDesignMessages([], [], 'any encounter');
    expect(msgs[0].content).toContain('Provisional table material — not canon until accepted');
  });

  // Monster guardrails
  it('when no monster data: hard guardrail header appears at start of prompt', () => {
    const msgs = buildDesignMessages([LOSWEG_CANON], [MOVEMENT_RULES], 'I need a road encounter');
    expect(msgs[0].content).toContain('NO MONSTER DATA LOADED — CREATURE GUARDRAILS ACTIVE');
  });

  it('when no monster data: guardrail is the first content (before persona)', () => {
    const msgs = buildDesignMessages([LOSWEG_CANON], [MOVEMENT_RULES], 'I need a road encounter');
    const system = msgs[0].content;
    expect(system.indexOf('NO MONSTER DATA LOADED')).toBeLessThan(system.indexOf('You are Karsac Design Assistant'));
  });

  it('when no monster data: includes the mandatory encounter-roles disclaimer line', () => {
    const msgs = buildDesignMessages([LOSWEG_CANON], [MOVEMENT_RULES], 'I need a road encounter');
    expect(msgs[0].content).toContain('Monster metadata is not yet loaded, so these are encounter roles rather than selected stat blocks.');
  });

  it('when no monster data: explicitly lists Dire Wolf and CR ratings as forbidden', () => {
    const msgs = buildDesignMessages([], [], 'I need an encounter near the mountains');
    const system = msgs[0].content;
    expect(system).toContain('DO NOT write any of the following');
    expect(system).toContain('Dire Wolf');
    expect(system).toContain('CR ratings');
  });

  it('when no monster data: output contract section instructs encounter ROLES only', () => {
    const msgs = buildDesignMessages([], [], 'I need an encounter');
    expect(msgs[0].content).toContain('creature ROLES');
  });

  it('when monster data IS loaded: does not include no-corpus guardrails', () => {
    const monsterFile: CanonFile = {
      id: 'monsters/mountain-boar',
      title: 'Mountain Boar',
      path: 'karsac-monsters/mountain-boar.md',
      content: '# Mountain Boar\nCR 1 beast.',
    };
    const msgs = buildDesignMessages([LOSWEG_CANON], [MOVEMENT_RULES], 'I need an encounter', [monsterFile]);
    const system = msgs[0].content;
    expect(system).not.toContain('NO MONSTER DATA LOADED');
    expect(system).toContain('Monster metadata loaded');
    expect(system).toContain('monsters/mountain-boar');
  });

  it('when user requests provisional homebrew explicitly: relaxes strict guardrails', () => {
    const msgs = buildDesignMessages([], [], 'I need an encounter, give me provisional homebrew stats');
    const system = msgs[0].content;
    expect(system).toContain('User requested provisional homebrew');
    expect(system).not.toContain('NO MONSTER DATA LOADED — CREATURE GUARDRAILS ACTIVE');
  });

  // ── Party-aware and homebrew gate ─────────────────────────────────────────

  it('party context block appears when partyInfo has a level', () => {
    const msgs = buildDesignMessages([], [], 'road encounter', [], {
      partyInfo: { size: 4, level: 3 },
    });
    const system = msgs[0].content;
    expect(system).toContain('PARTY CONTEXT');
    expect(system).toContain('Party level: 3');
    expect(system).toContain('Party size: 4');
  });

  it('party context block is absent when partyInfo is null', () => {
    const msgs = buildDesignMessages([], [], 'road encounter');
    expect(msgs[0].content).not.toContain('PARTY CONTEXT');
  });

  it('homebrew gate is active by default (no --allow-homebrew, no explicit request)', () => {
    const msgs = buildDesignMessages([], [], 'road encounter', [], {});
    const system = msgs[0].content;
    expect(system).toContain('HOMEBREW GATE — ACTIVE');
    expect(system).toContain('LOCAL/REGIONAL NAMES');
  });

  it('homebrew gate relaxes when --allow-homebrew is passed', () => {
    const msgs = buildDesignMessages([], [], 'road encounter', [], { allowHomebrew: true });
    const system = msgs[0].content;
    expect(system).not.toContain('HOMEBREW GATE — ACTIVE');
    expect(system).toContain('HOMEBREW GATE: Homebrew is permitted');
  });

  it('noSuitableMonsters: fallback instruction appears when flag is set', () => {
    const msgs = buildDesignMessages([], [], 'road encounter', [], {
      partyInfo: { size: 4, level: 3 },
      noSuitableMonsters: true,
    });
    const system = msgs[0].content;
    expect(system).toContain('NO SUITABLE LEVEL-APPROPRIATE MONSTERS FOUND');
    expect(system).toContain('Using encounter roles only');
  });

  it('noSuitableMonsters: even with loaded monster files, treats as no-data', () => {
    const monsterFile: CanonFile = {
      id: 'monsters/srd-2014/stone-giant',
      title: 'Stone Giant',
      path: 'karsac-monsters-srd-2014/stone-giant.md',
      content: '# Stone Giant\nCR 7.',
    };
    const msgs = buildDesignMessages([], [], 'road encounter', [monsterFile], {
      noSuitableMonsters: true,
    });
    const system = msgs[0].content;
    expect(system).toContain('NO SUITABLE LEVEL-APPROPRIATE MONSTERS FOUND');
    expect(system).not.toContain('Monster metadata loaded');
  });

  it('local names gate instructions appear in the homebrew gate active block', () => {
    const msgs = buildDesignMessages([], [], 'road encounter');
    const system = msgs[0].content;
    expect(system).toContain('LOCAL/REGIONAL NAMES');
    expect(system).toContain('Fjallvarg');  // example name should be cited
  });

  it('local names gate: allowed format example is present', () => {
    const msgs = buildDesignMessages([], [], 'road encounter');
    expect(msgs[0].content).toContain("local name for Wolf");
  });

  // ── Composition plan prompt block ─────────────────────────────────────────

  it('composition plan block appears when plan is provided', () => {
    const plan = {
      partySize: 4, partyLevel: 3, difficultyIntent: 'push' as const,
      allowedMonsterIds: ['monsters/srd-2014/ogre'],
      allowedMonsterNames: ['Ogre'],
      selectedOpposition: [{
        monsterId: 'monsters/srd-2014/ogre', monsterName: 'Ogre',
        cr: 2, count: 1, role: 'primary-threat' as const,
        useAsCombatant: true, notes: 'CR 2',
      }],
      notIncludedFromCandidates: ['Ettin'],
      forbiddenMonsterNames: ['Ettin', 'Dire Wolf', 'Goblin'],
      allowedLocalNames: [{ localName: 'Jötunn', monsterId: 'monsters/srd-2014/ogre', monsterName: 'Ogre', meaning: 'mountain giant-kin' }],
      mechanicalPolicy: 'srd-only' as const,
      balanceNotes: [],
    };
    const msgs = buildDesignMessages([], [], 'road encounter', [], { compositionPlan: plan });
    const system = msgs[0].content;
    expect(system).toContain('ALLOWED FINAL OPPOSITION');
    expect(system).toContain('monsters/srd-2014/ogre');
    expect(system).toContain('Dire Wolf');
    expect(system).toContain('Jötunn');
  });

  it('composition block is absent when no plan provided', () => {
    const msgs = buildDesignMessages([], [], 'road encounter');
    expect(msgs[0].content).not.toContain('ALLOWED FINAL OPPOSITION');
  });
});
