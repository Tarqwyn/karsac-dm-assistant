import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { resolve } from 'path';
import { tmpdir } from 'os';
import { parseFile, extractSections } from '../src/parser.js';
import { extractPartyInfo } from '../src/resolver.js';

const TMP = resolve(tmpdir(), 'karsac-test-' + process.pid);

function writeTmp(name: string, content: string): string {
  mkdirSync(TMP, { recursive: true });
  const p = resolve(TMP, name);
  writeFileSync(p, content, { encoding: 'utf-8' });
  return p;
}

describe('parseFile', () => {
  it('returns null for a file with no frontmatter id', () => {
    const p = writeTmp('no-id.md', '# Hello\n\nNo frontmatter here.');
    expect(parseFile(p, TMP)).toBeNull();
  });

  it('parses basic NPC file correctly', () => {
    const content = `---
id: npcs/brynja-thorgrimsdotter
type: npc
visibility: mixed
canonical: provisional
tags: [brynja, brynja-thorgrimsdotter, torweg, major-npc]
related:
  places: [torweg]
  npcs: [floki]
summary: "Head of the Törweg council"
last_updated: 2026-05-26
---

# Brynja Thorgrimsdotter

**Canon File ID:** \`npcs/brynja-thorgrimsdotter\`

**Retrieval Summary:** Brynja is the sixty-two-year-old head of the Törweg council.

**Do Not Confuse With:** Jarl Beorn (Valweg leader), Jarl Mathr (antagonist).
`;
    const p = writeTmp('brynja.md', content);
    const entity = parseFile(p, TMP);

    expect(entity).not.toBeNull();
    expect(entity!.id).toBe('npcs/brynja-thorgrimsdotter');
    expect(entity!.title).toBe('Brynja Thorgrimsdotter');
    expect(entity!.type).toBe('npc');
    expect(entity!.visibility).toBe('mixed');
    expect(entity!.canonical).toBe('provisional');
    expect(entity!.summary).toBe('Head of the Törweg council');
    expect(entity!.canonFileId).toBe('npcs/brynja-thorgrimsdotter');
    expect(entity!.retrievalSummary).toContain('sixty-two-year-old');
    expect(entity!.related).toEqual({ places: ['torweg'], npcs: ['floki'] });
    expect(entity!.lastUpdated).toBe('2026-05-26');
  });

  it('preserves UTF-8 characters in titles and summaries', () => {
    const content = `---
id: places/torweg
type: place
tags: [torweg, losweg]
summary: "Lösweg's harder second city; home of Dhurvaq resistance and Törweg council"
---

# Törweg

**Canon File ID:** \`places/torweg\`

**Retrieval Summary:** Lösweg's second city. Xyrrathh passed through.
`;
    const p = writeTmp('torweg.md', content);
    const entity = parseFile(p, TMP)!;

    expect(entity.title).toBe('Törweg');
    expect(entity.summary).toContain('Lösweg');
    expect(entity.retrievalSummary).toContain('Xyrrathh');
  });

  it('parses Do Not Confuse With correctly including entries with parenthetical descriptions', () => {
    const content = `---
id: npcs/test
type: npc
tags: []
---

# Test NPC

**Do Not Confuse With:** The Carver (cooperage NPC; male), Jarl Beorn (Valweg council leader; not Törweg), House Mathr genealogy figures (Sven, Soren — archive-only).
`;
    const p = writeTmp('test-dnc.md', content);
    const entity = parseFile(p, TMP)!;

    expect(entity.doNotConfuseWith).toEqual([
      'The Carver',
      'Jarl Beorn',
      'House Mathr genealogy figures',
    ]);
  });

  it('builds aliases including entity id, title, lowercase, kebab, and tags', () => {
    const content = `---
id: npcs/brynja-thorgrimsdotter
type: npc
tags: [brynja, brynja-thorgrimsdotter, torweg]
---

# Brynja Thorgrimsdotter
`;
    const p = writeTmp('brynja-aliases.md', content);
    const entity = parseFile(p, TMP)!;

    expect(entity.aliases).toContain('npcs/brynja-thorgrimsdotter');
    expect(entity.aliases).toContain('Brynja Thorgrimsdotter');
    expect(entity.aliases).toContain('brynja thorgrimsdotter');
    expect(entity.aliases).toContain('brynja-thorgrimsdotter');
    expect(entity.aliases).toContain('Brynja');
    expect(entity.aliases).toContain('brynja');
    expect(entity.aliases).toContain('torweg');
  });

  it('handles "The X" title by also aliasing without "The"', () => {
    const content = `---
id: npcs/the-carver
type: npc
tags: [carver, torweg]
---

# The Carver
`;
    const p = writeTmp('the-carver.md', content);
    const entity = parseFile(p, TMP)!;

    expect(entity.aliases).toContain('The Carver');
    expect(entity.aliases).toContain('the carver');
    expect(entity.aliases).toContain('Carver');
    expect(entity.aliases).toContain('carver');
  });

  it('parses entity card with Primary Detail File from body', () => {
    const content = `---
id: entity-cards/npcs/brynja-thorgrimsdotter
type: entity-card
entity_type: npc
entity_id: npcs/brynja-thorgrimsdotter
tags: [brynja]
related:
  primary_detail_file: npcs/brynja-thorgrimsdotter
  places: [torweg]
---

# Brynja Thorgrimsdotter

**Canon File ID:** \`npcs/brynja-thorgrimsdotter\`
**Entity Card ID:** \`entity-cards/npcs/brynja-thorgrimsdotter\`
**Primary Detail File:** \`npcs/brynja-thorgrimsdotter\`
`;
    const p = writeTmp('brynja-card.md', content);
    const entity = parseFile(p, TMP)!;

    expect(entity.entityType).toBe('npc');
    expect(entity.entityId).toBe('npcs/brynja-thorgrimsdotter');
    expect(entity.entityCardId).toBe('entity-cards/npcs/brynja-thorgrimsdotter');
    expect(entity.primaryDetailFile).toBe('npcs/brynja-thorgrimsdotter');
    // primary_detail_file should not appear in related
    expect(entity.related).not.toHaveProperty('primary_detail_file');
    expect(entity.related).toEqual({ places: ['torweg'] });
  });

  it('parses rule metadata including ruleset and related.rules', () => {
    const content = `---
id: rules/core/saving-throws
type: rule
ruleset: dnd-5e-2014
visibility: dm-and-player
canonical: srd-5.1
tags: [saving-throws, d20, saves]
related:
  rules: [rules/core/ability-checks, rules/core/proficiency-bonus]
summary: "Saving throws resist harmful effects."
source:
  title: "D&D SRD 5.1"
  licence: "SRD 5.1 / OGL 1.0a source used by project"
---

# Saving Throws

**Rule ID:** \`rules/core/saving-throws\`

**Retrieval Summary:** Saving throws are d20 rolls used to resist harmful effects.
`;
    const p = writeTmp('saving-throws-rule.md', content);
    const entity = parseFile(p, TMP)!;

    expect(entity.type).toBe('rule');
    expect(entity.ruleset).toBe('dnd-5e-2014');
    expect(entity.visibility).toBe('dm-and-player');
    expect(entity.canonical).toBe('srd-5.1');
    expect(entity.related).toEqual({
      rules: ['rules/core/ability-checks', 'rules/core/proficiency-bonus'],
    });
  });
});

describe('extractSections', () => {
  it('extracts H2 and H3 headings', () => {
    const content = `---
id: test/entity
type: place
tags: []
---

# Title

## Overview

Some text.

## Description

### Sub-section

More text.
`;
    const p = writeTmp('sections.md', content);
    const secs = extractSections(p);

    expect(secs).toHaveLength(3);
    expect(secs[0]).toEqual({ level: 2, heading: 'Overview', anchor: 'overview' });
    expect(secs[1]).toEqual({ level: 2, heading: 'Description', anchor: 'description' });
    expect(secs[2]).toEqual({ level: 3, heading: 'Sub-section', anchor: 'sub-section' });
  });
});

// ── extractPartyInfo ──────────────────────────────────────────────────────────

describe('extractPartyInfo', () => {
  it('extracts "4 lvl 3" → size 4, level 3', () => {
    const r = extractPartyInfo('the party is 4 lvl 3 characters');
    expect(r.size).toBe(4);
    expect(r.level).toBe(3);
  });

  it('extracts "4 level 3" variant', () => {
    const r = extractPartyInfo('4 level 3 players on the road');
    expect(r.size).toBe(4);
    expect(r.level).toBe(3);
  });

  it('extracts standalone level when no size given', () => {
    const r = extractPartyInfo('an encounter for level 5 characters');
    expect(r.level).toBe(5);
    expect(r.size).toBeNull();
  });

  it('extracts "party of 4" with separate level reference', () => {
    const r = extractPartyInfo('a party of 4, they are level 2');
    expect(r.size).toBe(4);
    expect(r.level).toBe(2);
  });

  it('returns null/null when no party info present', () => {
    const r = extractPartyInfo('I need a road encounter near Lösweg');
    expect(r.size).toBeNull();
    expect(r.level).toBeNull();
  });

  it('handles acceptance test query', () => {
    const q = 'I need an encounter for the party that pushes them while they are on the road to Lösweg. Make them feel right for the Lösweg region - the party is 4 lvl 3 characters.';
    const r = extractPartyInfo(q);
    expect(r.size).toBe(4);
    expect(r.level).toBe(3);
  });
});
