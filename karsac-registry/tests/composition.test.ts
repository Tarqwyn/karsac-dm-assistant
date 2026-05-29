import { describe, it, expect } from 'vitest';
import {
  buildEncounterCompositionPlan,
  detectDifficultyIntent,
  formatCompositionDebug,
  formatCompositionPromptBlock,
} from '../src/composition.js';
import type { CandidateForComposition } from '../src/composition.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const POLAR_BEAR: CandidateForComposition = {
  key: 'polar-bear', monsterName: 'Polar Bear',
  monsterId: 'monsters/srd-2014/polar-bear', cr: 2, roles: ['ambusher', 'territorial-threat'],
};
const OGRE: CandidateForComposition = {
  key: 'ogre', monsterName: 'Ogre',
  monsterId: 'monsters/srd-2014/ogre', cr: 2, roles: ['bruiser', 'siege'],
};
const GIANT_EAGLE: CandidateForComposition = {
  key: 'giant-eagle', monsterName: 'Giant Eagle',
  monsterId: 'monsters/srd-2014/giant-eagle', cr: 1, roles: ['aerial-hunter', 'ambusher'],
};
const GIANT_VULTURE: CandidateForComposition = {
  key: 'giant-vulture', monsterName: 'Giant Vulture',
  monsterId: 'monsters/srd-2014/giant-vulture', cr: 1, roles: ['aerial-hunter', 'ambusher'],
};
const ETTIN: CandidateForComposition = {
  key: 'ettin', monsterName: 'Ettin',
  monsterId: 'monsters/srd-2014/ettin', cr: 4, roles: ['bruiser', 'siege'],
};

const LOSWEG_REGION = new Set(['losweg']);
const LÖSWEG_QUERY = 'I need an encounter for the road to Lösweg. The party is 4 lvl 3 characters. Consider giving the creatures Lösweg names reminiscent of the Scandinavian influence.';

// ── detectDifficultyIntent ────────────────────────────────────────────────────

describe('detectDifficultyIntent', () => {
  it('"pushes them" → push', () => {
    expect(detectDifficultyIntent('I need an encounter that pushes them.')).toBe('push');
  });
  it('"push the party" → push', () => {
    expect(detectDifficultyIntent('push the party on the road')).toBe('push');
  });
  it('"challenging encounter" → hard', () => {
    expect(detectDifficultyIntent('a challenging encounter for tonight')).toBe('hard');
  });
  it('"easy encounter" → easy', () => {
    expect(detectDifficultyIntent('give me an easy encounter')).toBe('easy');
  });
  it('no keyword → unknown', () => {
    expect(detectDifficultyIntent('I need an encounter on the road')).toBe('unknown');
  });
});

// ── buildEncounterCompositionPlan ─────────────────────────────────────────────

describe('buildEncounterCompositionPlan', () => {
  it('selects 1 ground primary + 1 aerial secondary', () => {
    const candidates = [OGRE, ETTIN, GIANT_EAGLE, GIANT_VULTURE, POLAR_BEAR];
    const plan = buildEncounterCompositionPlan(candidates, 4, 3, LÖSWEG_QUERY, false, LOSWEG_REGION);
    expect(plan.selectedOpposition).toHaveLength(2);
    const roles = plan.selectedOpposition.map(c => c.role);
    expect(roles).toContain('primary-threat');
    expect(roles).toContain('scout');
  });

  it('primary-threat is useAsCombatant=true', () => {
    const candidates = [OGRE, GIANT_EAGLE, GIANT_VULTURE];
    const plan = buildEncounterCompositionPlan(candidates, 4, 3, LÖSWEG_QUERY, false, LOSWEG_REGION);
    const primary = plan.selectedOpposition.find(c => c.role === 'primary-threat')!;
    expect(primary.useAsCombatant).toBe(true);
  });

  it('scout/aerial is useAsCombatant=false', () => {
    const candidates = [OGRE, GIANT_EAGLE];
    const plan = buildEncounterCompositionPlan(candidates, 4, 3, LÖSWEG_QUERY, false, LOSWEG_REGION);
    const scout = plan.selectedOpposition.find(c => c.role === 'scout');
    expect(scout?.useAsCombatant).toBe(false);
  });

  it('ettin (CR 4, level 3 party) excluded from direct combat when better options exist', () => {
    const candidates = [OGRE, ETTIN, GIANT_EAGLE];
    const plan = buildEncounterCompositionPlan(candidates, 4, 3, LÖSWEG_QUERY, false, LOSWEG_REGION);
    const oppo = plan.selectedOpposition;
    // ettin should NOT be selected when ogre is available as primary
    const ettinInOppo = oppo.find(c => c.monsterName === 'Ettin');
    expect(ettinInOppo).toBeUndefined();
  });

  it('notIncludedFromCandidates contains candidates not in composition', () => {
    const candidates = [OGRE, ETTIN, GIANT_EAGLE, GIANT_VULTURE, POLAR_BEAR];
    const plan = buildEncounterCompositionPlan(candidates, 4, 3, LÖSWEG_QUERY, false, LOSWEG_REGION);
    // Not all 5 should be in selectedOpposition (max 2)
    expect(plan.notIncludedFromCandidates.length).toBeGreaterThanOrEqual(3);
  });

  it('forbiddenMonsterNames includes Dire Wolf and Goblin', () => {
    const plan = buildEncounterCompositionPlan([OGRE, GIANT_EAGLE], 4, 3, LÖSWEG_QUERY, false, LOSWEG_REGION);
    expect(plan.forbiddenMonsterNames).toContain('Dire Wolf');
    expect(plan.forbiddenMonsterNames).toContain('Goblin');
  });

  it('forbiddenMonsterNames includes unselected candidates', () => {
    const candidates = [OGRE, ETTIN, GIANT_EAGLE, GIANT_VULTURE, POLAR_BEAR];
    const plan = buildEncounterCompositionPlan(candidates, 4, 3, LÖSWEG_QUERY, false, LOSWEG_REGION);
    const allowedNames = new Set(plan.allowedMonsterNames);
    for (const n of plan.notIncludedFromCandidates) {
      expect(plan.forbiddenMonsterNames).toContain(n);
    }
    // None of the forbidden names should be in the allowed set
    for (const f of plan.forbiddenMonsterNames) {
      expect(allowedNames.has(f)).toBe(false);
    }
  });

  it('generates Lösweg local names when requested', () => {
    const candidates = [OGRE, GIANT_VULTURE];
    const plan = buildEncounterCompositionPlan(candidates, 4, 3, LÖSWEG_QUERY, false, LOSWEG_REGION);
    expect(plan.allowedLocalNames.length).toBeGreaterThan(0);
    // Ogre → Jötunn, Giant Vulture → Skarvgrip
    const names = plan.allowedLocalNames.map(l => l.localName);
    expect(names).toContain('Jötunn');
    expect(names).toContain('Skarvgrip');
  });

  it('generates no local names when not requested', () => {
    const plan = buildEncounterCompositionPlan(
      [OGRE, GIANT_EAGLE], 4, 3, 'I need a road encounter', false, new Set(),
    );
    expect(plan.allowedLocalNames).toHaveLength(0);
  });

  it('mechanical policy is srd-only by default', () => {
    const plan = buildEncounterCompositionPlan([OGRE], 4, 3, LÖSWEG_QUERY, false, LOSWEG_REGION);
    expect(plan.mechanicalPolicy).toBe('srd-only');
  });

  it('mechanical policy is homebrew-allowed when flag set', () => {
    const plan = buildEncounterCompositionPlan([OGRE], 4, 3, LÖSWEG_QUERY, true, LOSWEG_REGION);
    expect(plan.mechanicalPolicy).toBe('homebrew-allowed');
  });

  it('difficulty is correctly detected', () => {
    const plan = buildEncounterCompositionPlan([OGRE], 4, 3, LÖSWEG_QUERY, false, LOSWEG_REGION);
    // LÖSWEG_QUERY does not contain "push" or "challenging" so should be unknown
    expect(plan.difficultyIntent).toBe('unknown');
  });

  it('allowedMonsterNames matches selectedOpposition names', () => {
    const plan = buildEncounterCompositionPlan([OGRE, GIANT_EAGLE], 4, 3, LÖSWEG_QUERY, false, LOSWEG_REGION);
    const fromOppo = plan.selectedOpposition.map(c => c.monsterName);
    expect(plan.allowedMonsterNames).toEqual(fromOppo);
  });

  it('includes balance notes when selection is non-empty', () => {
    const plan = buildEncounterCompositionPlan([OGRE], 4, 3, LÖSWEG_QUERY, false, LOSWEG_REGION);
    expect(plan.balanceNotes.length).toBeGreaterThan(0);
    expect(plan.balanceNotes.some(n => n.includes('XP'))).toBe(true);
  });

  it('falls back to aerial as primary if no ground candidates', () => {
    const plan = buildEncounterCompositionPlan([GIANT_EAGLE, GIANT_VULTURE], 4, 3, LÖSWEG_QUERY, false, LOSWEG_REGION);
    const primary = plan.selectedOpposition.find(c => c.role === 'primary-threat');
    expect(primary).toBeDefined();
    expect(primary?.monsterName).toBe('Giant Eagle');
  });
});

// ── formatCompositionDebug ────────────────────────────────────────────────────

describe('formatCompositionDebug', () => {
  it('contains "Composition plan:"', () => {
    const plan = buildEncounterCompositionPlan([OGRE, GIANT_VULTURE], 4, 3, LÖSWEG_QUERY, false, LOSWEG_REGION);
    const debug = formatCompositionDebug(plan);
    expect(debug).toContain('Composition plan:');
  });

  it('lists allowed opposition with monster names', () => {
    const plan = buildEncounterCompositionPlan([OGRE, GIANT_VULTURE], 4, 3, LÖSWEG_QUERY, false, LOSWEG_REGION);
    const debug = formatCompositionDebug(plan);
    expect(debug).toContain('Ogre');
    expect(debug).toContain('Giant Vulture');
  });

  it('lists not-included candidates', () => {
    const candidates = [OGRE, ETTIN, GIANT_EAGLE, GIANT_VULTURE, POLAR_BEAR];
    const plan = buildEncounterCompositionPlan(candidates, 4, 3, LÖSWEG_QUERY, false, LOSWEG_REGION);
    const debug = formatCompositionDebug(plan);
    expect(debug).toContain('not included from candidates');
  });
});

// ── formatCompositionPromptBlock ──────────────────────────────────────────────

describe('formatCompositionPromptBlock', () => {
  it('includes ALLOWED FINAL OPPOSITION header', () => {
    const plan = buildEncounterCompositionPlan([OGRE, GIANT_VULTURE], 4, 3, LÖSWEG_QUERY, false, LOSWEG_REGION);
    const block = formatCompositionPromptBlock(plan);
    expect(block).toContain('ALLOWED FINAL OPPOSITION');
  });

  it('lists allowed monster IDs', () => {
    const plan = buildEncounterCompositionPlan([OGRE, GIANT_VULTURE], 4, 3, LÖSWEG_QUERY, false, LOSWEG_REGION);
    const block = formatCompositionPromptBlock(plan);
    expect(block).toContain('monsters/srd-2014/ogre');
    expect(block).toContain('monsters/srd-2014/giant-vulture');
  });

  it('includes forbidden list with Dire Wolf and Goblin', () => {
    const plan = buildEncounterCompositionPlan([OGRE, GIANT_EAGLE], 4, 3, LÖSWEG_QUERY, false, LOSWEG_REGION);
    const block = formatCompositionPromptBlock(plan);
    expect(block).toContain('Dire Wolf');
    expect(block).toContain('Goblin');
  });

  it('includes local name mappings when generated', () => {
    const plan = buildEncounterCompositionPlan([OGRE, GIANT_VULTURE], 4, 3, LÖSWEG_QUERY, false, LOSWEG_REGION);
    const block = formatCompositionPromptBlock(plan);
    expect(block).toContain('Jötunn');
    expect(block).toContain('Skarvgrip');
  });

  it('says "do not invent" when no local names in scope', () => {
    const plan = buildEncounterCompositionPlan(
      [OGRE, GIANT_EAGLE], 4, 3, 'road encounter', false, new Set(),
    );
    const block = formatCompositionPromptBlock(plan);
    expect(block).toContain('No local names are in scope');
  });

  it('includes the "DO NOT say reskinned/based on" rule', () => {
    const plan = buildEncounterCompositionPlan([OGRE], 4, 3, LÖSWEG_QUERY, false, LOSWEG_REGION);
    const block = formatCompositionPromptBlock(plan);
    expect(block).toContain('"reskinned"');
    expect(block).toContain('"based on"');
    expect(block).toContain('"Monster Manual"');
  });

  it('includes scaling constraint', () => {
    const plan = buildEncounterCompositionPlan([OGRE], 4, 3, LÖSWEG_QUERY, false, LOSWEG_REGION);
    const block = formatCompositionPromptBlock(plan);
    expect(block).toContain('Scaling');
    expect(block).toContain('NOT stat changes');
  });
});
