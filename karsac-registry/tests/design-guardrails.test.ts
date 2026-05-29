import { describe, it, expect } from 'vitest';
import {
  checkHomebrewViolations,
  checkNoMonsterViolations,
  checkCompositionViolations,
  validateDesignResponse,
  stripViolatingContent,
} from '../src/design-guardrails.js';
import type { EncounterCompositionPlan } from '../src/composition.js';

// ── Minimal valid response for structure tests ────────────────────────────────

const VALID_RESPONSE = `## Provisional encounter concept
Two ogres displaced from mountain foothills ambush the road.

## Why it fits Karsac
Mountain pressure has pushed large humanoids toward the Lösweg road.

## Encounter setup
Road between the foothills and the coastal path, early morning fog.

## Creatures / opposition
Monster metadata is not yet loaded, so these are encounter roles rather than selected stat blocks.
- displaced mountain bruiser — large, hungry, territorial

## Terrain and pressure
Narrow road with steep banks. Fog limits visibility to 30 ft.

## What this reveals
Evidence of disruption higher in the mountains.

## Running it at the table
Allow a Perception check before initiative.

## Scaling options
Use fewer creatures or start them further away.

## Player-safe description
The fog parts to reveal two hulking shapes on the road ahead.

## Canon status
Provisional table material — not canon until accepted.`;

// ── checkHomebrewViolations ───────────────────────────────────────────────────

describe('checkHomebrewViolations', () => {
  it('detects "Increase HP"', () => {
    expect(checkHomebrewViolations('Increase HP by 10 for a tougher fight.')).toContain('HP modification');
  });

  it('detects "Reduce HP"', () => {
    expect(checkHomebrewViolations("Reduce the Polar Bear's HP to 20.")).toContain('HP modification');
  });

  it('detects "HP to N"', () => {
    expect(checkHomebrewViolations('Set HP to 30 for a softer encounter.')).toContain('HP assignment');
  });

  it('detects "extra hit points"', () => {
    expect(checkHomebrewViolations('Give it extra hit points.')).toContain('extra hit points');
  });

  it('detects "increase bite damage"', () => {
    expect(checkHomebrewViolations('Increase bite damage by 1d6.')).toContain('damage modification');
  });

  it('detects "reduce damage"', () => {
    expect(checkHomebrewViolations('Reduce damage output by one die.')).toContain('damage modification');
  });

  it('detects "advantage on Strength saving throws"', () => {
    expect(checkHomebrewViolations('It has advantage on Strength saving throws.')).toContain('invented saving throw advantage');
  });

  it('detects "disadvantage on saving throws"', () => {
    expect(checkHomebrewViolations('Impose disadvantage on Dexterity saving throws.')).toContain('invented saving throw disadvantage');
  });

  it('detects "saving throw disadvantage"', () => {
    expect(checkHomebrewViolations('saving throw disadvantage against cold')).toContain('invented saving throw modifier');
  });

  it('detects "+2 Strength"', () => {
    expect(checkHomebrewViolations('Give it +2 Strength for the encounter.')).toContain('ability score modifier');
  });

  it('detects "+1 Constitution"', () => {
    expect(checkHomebrewViolations('Add +1 Constitution.')).toContain('ability score modifier');
  });

  it('detects "resistance to" (invented)', () => {
    expect(checkHomebrewViolations('It gains resistance to bludgeoning damage.')).toContain('resistance to (invented)');
  });

  it('detects "damage resistance"', () => {
    expect(checkHomebrewViolations('Grant it damage resistance to fire.')).toContain('damage resistance (invented)');
  });

  it('detects "based on"', () => {
    expect(checkHomebrewViolations('Fjallvarg based on Dire Wolf stats.')).toContain('based on (homebrew reskin)');
  });

  it('detects "new attack"', () => {
    expect(checkHomebrewViolations('Add a new attack: Tail Slam.')).toContain('new attack/ability (invented)');
  });

  it('returns empty for clean text', () => {
    expect(checkHomebrewViolations('Use fewer creatures or start them further away.')).toHaveLength(0);
  });

  it('returns empty for encounter-role language', () => {
    expect(checkHomebrewViolations('a displaced mountain pack predator — fast and hungry')).toHaveLength(0);
  });

  it('does not flag "reduce starting distance"', () => {
    // "reduce" + "distance" does not match any HP/damage/AC pattern
    expect(checkHomebrewViolations('Reduce starting distance to 60 ft.')).toHaveLength(0);
  });

  it('does not flag "change terrain pressure"', () => {
    expect(checkHomebrewViolations('Increase terrain pressure with fog or debris.')).toHaveLength(0);
  });
});

// ── checkNoMonsterViolations ──────────────────────────────────────────────────

describe('checkNoMonsterViolations', () => {
  it('flags missing disclaimer', () => {
    expect(checkNoMonsterViolations('Some text without the disclaimer.')).toContain('missing mandatory disclaimer line');
  });

  it('flags Stone Giant', () => {
    const text = 'monster metadata is not yet loaded, so these are encounter roles rather than selected stat blocks.\nThe Stone Giant blocks the path.';
    expect(checkNoMonsterViolations(text)).toContain('Stone Giant');
  });

  it('passes when disclaimer present and no named monsters', () => {
    const text = 'monster metadata is not yet loaded, so these are encounter roles rather than selected stat blocks.\nA heavy-bodied grazer stands in the road.';
    expect(checkNoMonsterViolations(text)).toHaveLength(0);
  });
});

// ── validateDesignResponse ────────────────────────────────────────────────────

describe('validateDesignResponse', () => {
  it('passes a clean valid response', () => {
    expect(validateDesignResponse(VALID_RESPONSE, true)).toBe(true);
  });

  it('fails if response does not start with ## Provisional encounter concept', () => {
    const bad = VALID_RESPONSE.replace('## Provisional encounter concept', '## Something else');
    expect(validateDesignResponse(bad, true)).toBe(false);
  });

  it('fails if a required heading is missing', () => {
    const bad = VALID_RESPONSE.replace('## Scaling options\n', '');
    expect(validateDesignResponse(bad, true)).toBe(false);
  });

  it('fails if no "provisional table material" in canon status', () => {
    const bad = VALID_RESPONSE.replace('Provisional table material — not canon until accepted.', 'Canon.');
    expect(validateDesignResponse(bad, true)).toBe(false);
  });

  it('fails on homebrew violation when allowHomebrew is false', () => {
    const bad = VALID_RESPONSE + '\nReduce HP by half for scaling.';
    expect(validateDesignResponse(bad, false, false)).toBe(false);
  });

  it('passes on homebrew violation when allowHomebrew is true', () => {
    const withHomebrew = VALID_RESPONSE + '\nReduce HP by half for scaling.';
    expect(validateDesignResponse(withHomebrew, false, true)).toBe(true);
  });
});

// ── stripViolatingContent ─────────────────────────────────────────────────────

describe('stripViolatingContent', () => {
  it('removes a line containing "Reduce HP"', () => {
    const text = `## Scaling options\nReduce HP by half.\nUse fewer creatures.`;
    const { stripped, removed } = stripViolatingContent(text, false, false);
    expect(stripped).not.toContain('Reduce HP');
    expect(stripped).toContain('Use fewer creatures');
    expect(removed).toContain('Reduce HP by half.');
  });

  it('never removes a ## heading line', () => {
    const text = `## Scaling options\nReduce HP by half.`;
    const { stripped } = stripViolatingContent(text, false, false);
    expect(stripped).toContain('## Scaling options');
  });

  it('inserts placeholder when heading would be followed by no content', () => {
    const text = `## Scaling options\nReduce HP by half.`;
    const { stripped } = stripViolatingContent(text, false, false);
    expect(stripped).toContain('*(content removed');
  });

  it('does not strip when allowHomebrew is true', () => {
    const text = `## Scaling options\nReduce HP by half.\nUse fewer creatures.`;
    const { stripped, removed } = stripViolatingContent(text, true, false);
    expect(stripped).toContain('Reduce HP by half.');
    expect(removed).toHaveLength(0);
  });

  it('strips no-monster-data violations when noMonsterData is true', () => {
    const text = `## Creatures / opposition\nThe Stone Giant blocks the path.`;
    const { stripped, removed } = stripViolatingContent(text, false, true);
    expect(stripped).not.toContain('Stone Giant');
    expect(removed.length).toBeGreaterThan(0);
  });

  it('returns empty removed list for fully clean text', () => {
    const { removed } = stripViolatingContent(VALID_RESPONSE, false, true);
    expect(removed).toHaveLength(0);
  });

  it('strips "Reduce the Polar Bears HP" from scaling options', () => {
    const text = [
      '## Scaling options',
      "Reduce the Polar Bear's HP by half for a softer encounter.",
      'Use fewer creatures, start them further away, or give the party warning before initiative.',
    ].join('\n');
    const { stripped, removed } = stripViolatingContent(text, false, false);
    expect(stripped).not.toContain('Polar Bear');
    expect(stripped).toContain('Use fewer creatures');
    expect(removed.length).toBe(1);
  });

  it('strips advantage on saving throws', () => {
    const text = 'It gains advantage on Strength saving throws when bloodied.';
    const { removed } = stripViolatingContent(text, false, false);
    expect(removed.length).toBe(1);
  });
});

// ── checkCompositionViolations — extended checks ──────────────────────────────

const PLAN_WITH_LOCAL_NAMES: EncounterCompositionPlan = {
  partySize: 4, partyLevel: 3, difficultyIntent: 'push',
  allowedMonsterIds: ['monsters/srd-2014/ogre', 'monsters/srd-2014/giant-vulture'],
  allowedMonsterNames: ['Ogre', 'Giant Vulture'],
  selectedOpposition: [
    {
      monsterId: 'monsters/srd-2014/ogre', monsterName: 'Ogre', cr: 2,
      count: 1, role: 'primary-threat', useAsCombatant: true, notes: '',
    },
    {
      monsterId: 'monsters/srd-2014/giant-vulture', monsterName: 'Giant Vulture', cr: 1,
      count: 1, role: 'scout', useAsCombatant: false, notes: '',
    },
  ],
  notIncludedFromCandidates: ['Ettin'],
  forbiddenMonsterNames: ['Ettin', 'Dire Wolf', 'Goblin'],
  allowedLocalNames: [
    { localName: 'Jötunn', monsterId: 'monsters/srd-2014/ogre', monsterName: 'Ogre', meaning: 'mountain giant-kin' },
    { localName: 'Skarvgrip', monsterId: 'monsters/srd-2014/giant-vulture', monsterName: 'Giant Vulture', meaning: 'cliff-grip' },
  ],
  mechanicalPolicy: 'srd-only',
  balanceNotes: [],
};

function makeValidResponse(creatures: string): string {
  return `## Provisional encounter concept
Two displaced mountain creatures block the road.

## Why it fits Karsac
Mountain pressure.

## Encounter setup
The road near Lösweg at dawn.

## Creatures / opposition
${creatures}

## Terrain and pressure
Rocky road, fog.

## What this reveals
Disruption in the mountains.

## Running it at the table
Let players hear it first.

## Scaling options
Use fewer creatures or start them further away.

## Player-safe description
A large shape blocks the road.

## Canon status
Provisional table material — not canon until accepted.`;
}

describe('checkCompositionViolations — local names', () => {
  it('passes when required local names are present', () => {
    const text = makeValidResponse('- **Jötunn** (Ogre) — primary threat.\n- **Skarvgrip** (Giant Vulture) — circling above.');
    expect(checkCompositionViolations(text, PLAN_WITH_LOCAL_NAMES)).toHaveLength(0);
  });

  it('fails when a required local name is absent from creatures section', () => {
    const text = makeValidResponse('- **Ogre** — primary threat.\n- **Giant Vulture** — circling above.');
    const v = checkCompositionViolations(text, PLAN_WITH_LOCAL_NAMES);
    expect(v.some(s => s.includes('Jötunn'))).toBe(true);
    expect(v.some(s => s.includes('Skarvgrip'))).toBe(true);
  });
});

describe('checkCompositionViolations — count mismatch', () => {
  it('fails for "pack of Ogres" when count is 1', () => {
    const text = makeValidResponse('A pack of Ogres blocks the road.\n- **Jötunn** (Ogre).\n- **Skarvgrip** (Giant Vulture).');
    const v = checkCompositionViolations(text, PLAN_WITH_LOCAL_NAMES);
    expect(v.some(s => s.includes('count mismatch'))).toBe(true);
  });

  it('fails for plural "Ogres" when count is 1', () => {
    const text = makeValidResponse('The Ogres approach.\n- **Jötunn** (Ogre).\n- **Skarvgrip** (Giant Vulture).');
    const v = checkCompositionViolations(text, PLAN_WITH_LOCAL_NAMES);
    expect(v.some(s => s.includes('count mismatch'))).toBe(true);
  });

  it('passes for singular "Ogre" when count is 1', () => {
    const text = makeValidResponse('- **Jötunn** (the Ogre) — primary threat.\n- **Skarvgrip** (Giant Vulture) — circles overhead.');
    expect(checkCompositionViolations(text, PLAN_WITH_LOCAL_NAMES)).toHaveLength(0);
  });
});

describe('checkCompositionViolations — non-combatant attack check', () => {
  it('fails when non-combatant is described attacking in creatures section', () => {
    const text = makeValidResponse(
      '- **Jötunn** (Ogre) — primary threat.\n- **Skarvgrip** (Giant Vulture) — attacks the rearmost character.',
    );
    const v = checkCompositionViolations(text, PLAN_WITH_LOCAL_NAMES);
    expect(v.some(s => s.includes('non-combatant') && s.includes('Skarvgrip'))).toBe(true);
  });

  it('fails when non-combatant "giant vulture" described attacking by canonical name', () => {
    const text = makeValidResponse(
      '- **Jötunn** (Ogre) — primary threat.\n- Giant Vulture dive-bombs the party.',
    );
    const v = checkCompositionViolations(text, PLAN_WITH_LOCAL_NAMES);
    expect(v.some(s => s.includes('non-combatant'))).toBe(true);
  });

  it('passes when non-combatant only watches and circles', () => {
    const text = makeValidResponse(
      '- **Jötunn** (Ogre) — primary threat.\n- **Skarvgrip** (Giant Vulture) — circles overhead, watches from above.',
    );
    expect(checkCompositionViolations(text, PLAN_WITH_LOCAL_NAMES)).toHaveLength(0);
  });

  it('does not flag attack words near the combatant', () => {
    const text = makeValidResponse(
      '- **Jötunn** (Ogre) — attacks on sight.\n- **Skarvgrip** (Giant Vulture) — watches from above.',
    );
    const v = checkCompositionViolations(text, PLAN_WITH_LOCAL_NAMES);
    // Jötunn CAN attack; only Skarvgrip violations should appear
    expect(v.some(s => s.includes('Jötunn') && s.includes('non-combatant'))).toBe(false);
  });
});

// ── buildCreatureScaffold integration via resolver ────────────────────────────

import { buildCreatureScaffold } from '../src/composition.js';

describe('buildCreatureScaffold', () => {
  it('produces a line for each creature in the plan', () => {
    const scaffold = buildCreatureScaffold(PLAN_WITH_LOCAL_NAMES);
    expect(scaffold).toContain('Jötunn');
    expect(scaffold).toContain('Skarvgrip');
  });

  it('marks scout as non-combat with ALLOWED/FORBIDDEN lines', () => {
    const scaffold = buildCreatureScaffold(PLAN_WITH_LOCAL_NAMES);
    expect(scaffold).toContain('does NOT attack');
    expect(scaffold).toContain('ALLOWED');
    expect(scaffold).toContain('FORBIDDEN');
  });

  it('does not add ALLOWED/FORBIDDEN for combatants', () => {
    const plan: EncounterCompositionPlan = {
      ...PLAN_WITH_LOCAL_NAMES,
      selectedOpposition: [PLAN_WITH_LOCAL_NAMES.selectedOpposition[0]], // only the ogre
      allowedLocalNames: [PLAN_WITH_LOCAL_NAMES.allowedLocalNames[0]],
    };
    const scaffold = buildCreatureScaffold(plan);
    expect(scaffold).not.toContain('ALLOWED:');
    expect(scaffold).not.toContain('FORBIDDEN:');
  });

  it('includes monster ID reference', () => {
    const scaffold = buildCreatureScaffold(PLAN_WITH_LOCAL_NAMES);
    expect(scaffold).toContain('monsters/srd-2014/ogre');
    expect(scaffold).toContain('monsters/srd-2014/giant-vulture');
  });
});
