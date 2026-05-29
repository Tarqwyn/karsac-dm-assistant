import { describe, it, expect } from 'vitest';
import {
  parseEncounterIntent,
  compileEncounterBrief,
  renderDeterministicFallback,
  formatEncounterBriefDebug,
} from '../src/encounter-brief.js';
import type { EncounterCompositionPlan } from '../src/composition.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PLAN: EncounterCompositionPlan = {
  partySize: 4, partyLevel: 3, difficultyIntent: 'push',
  allowedMonsterIds: ['monsters/srd-2014/ogre', 'monsters/srd-2014/giant-eagle'],
  allowedMonsterNames: ['Ogre', 'Giant Eagle'],
  selectedOpposition: [
    {
      monsterId: 'monsters/srd-2014/ogre', monsterName: 'Ogre', cr: 2,
      count: 1, role: 'primary-threat', useAsCombatant: true, notes: '',
    },
    {
      monsterId: 'monsters/srd-2014/giant-eagle', monsterName: 'Giant Eagle', cr: 1,
      count: 1, role: 'scout', useAsCombatant: false, notes: '',
    },
  ],
  notIncludedFromCandidates: ['Ettin', 'Polar Bear'],
  forbiddenMonsterNames: ['Ettin', 'Polar Bear', 'Dire Wolf', 'Goblin', 'Orc'],
  allowedLocalNames: [
    { localName: 'Jötunn', monsterId: 'monsters/srd-2014/ogre', monsterName: 'Ogre', meaning: 'mountain giant-kin' },
    { localName: 'Fjell-Ørn', monsterId: 'monsters/srd-2014/giant-eagle', monsterName: 'Giant Eagle', meaning: 'mountain eagle' },
  ],
  mechanicalPolicy: 'srd-only',
  balanceNotes: ['Estimated adjusted XP: 600', 'Target for "push": 1312'],
};

const LOSWEG_QUESTION = 'I need an encounter for the party that pushes them while they are on the road to Lösweg. I want creatures that may have been disturbed from the mountains and been forced to move further towards the coast. Make them feel right for the Lösweg region - the party is 4 lvl 3 characters. Consider giving the creatures a Lösweg name reminiscent of Scandinavian influence.';
const LOSWEG_SIGNALS = new Set(['losweg']);

// ── parseEncounterIntent ──────────────────────────────────────────────────────

describe('parseEncounterIntent', () => {
  it('extracts party size and level', () => {
    const i = parseEncounterIntent(LOSWEG_QUESTION, { size: 4, level: 3 }, 'push', LOSWEG_SIGNALS, false);
    expect(i.partySize).toBe(4);
    expect(i.partyLevel).toBe(3);
  });

  it('extracts difficultyIntent', () => {
    const i = parseEncounterIntent(LOSWEG_QUESTION, { size: 4, level: 3 }, 'push', LOSWEG_SIGNALS, false);
    expect(i.difficultyIntent).toBe('push');
  });

  it('extracts location from "road to Lösweg"', () => {
    const i = parseEncounterIntent(LOSWEG_QUESTION, { size: 4, level: 3 }, 'push', LOSWEG_SIGNALS, false);
    expect(i.location).toContain('Lösweg');
  });

  it('sets region to Lösweg', () => {
    const i = parseEncounterIntent(LOSWEG_QUESTION, { size: 4, level: 3 }, 'push', LOSWEG_SIGNALS, false);
    expect(i.region).toBe('Lösweg');
  });

  it('includes Scandinavian-influenced in tone', () => {
    const i = parseEncounterIntent(LOSWEG_QUESTION, { size: 4, level: 3 }, 'push', LOSWEG_SIGNALS, false);
    expect(i.tone).toContain('Scandinavian-influenced');
  });

  it('includes regional Lösweg in tone', () => {
    const i = parseEncounterIntent(LOSWEG_QUESTION, { size: 4, level: 3 }, 'push', LOSWEG_SIGNALS, false);
    expect(i.tone).toContain('regional Lösweg');
  });

  it('includes local creature names in requestedFeatures', () => {
    const i = parseEncounterIntent(LOSWEG_QUESTION, { size: 4, level: 3 }, 'push', LOSWEG_SIGNALS, false);
    expect(i.requestedFeatures).toContain('local creature names');
  });

  it('includes creature-displacement in encounterPressure', () => {
    const i = parseEncounterIntent(LOSWEG_QUESTION, { size: 4, level: 3 }, 'push', LOSWEG_SIGNALS, false);
    expect(i.encounterPressure).toContain('creature-displacement');
  });

  it('includes mountain-origin in encounterPressure', () => {
    const i = parseEncounterIntent(LOSWEG_QUESTION, { size: 4, level: 3 }, 'push', LOSWEG_SIGNALS, false);
    expect(i.encounterPressure).toContain('mountain-origin');
  });

  it('does NOT forward raw creature hints (wolves, bears) as intent fields', () => {
    const q = 'I need an encounter with wolves and bears and goblins on the road.';
    const i = parseEncounterIntent(q, { size: null, level: null }, 'unknown', new Set(), false);
    // None of the intent fields should contain raw monster names
    const intentStr = JSON.stringify(i);
    expect(intentStr).not.toContain('wolves');
    expect(intentStr).not.toContain('bears');
    expect(intentStr).not.toContain('goblins');
  });

  it('type is always "encounter"', () => {
    const i = parseEncounterIntent(LOSWEG_QUESTION, { size: 4, level: 3 }, 'push', LOSWEG_SIGNALS, false);
    expect(i.type).toBe('encounter');
  });
});

// ── compileEncounterBrief ─────────────────────────────────────────────────────

describe('compileEncounterBrief', () => {
  const intent = parseEncounterIntent(LOSWEG_QUESTION, { size: 4, level: 3 }, 'push', LOSWEG_SIGNALS, false);
  const brief = compileEncounterBrief(intent, PLAN);

  it('starts with ENCOUNTER BRIEF header', () => {
    expect(brief.briefText).toContain('ENCOUNTER BRIEF');
  });

  it('includes party info', () => {
    expect(brief.briefText).toContain('4 level 3');
  });

  it('includes difficulty intent', () => {
    expect(brief.briefText).toContain('push');
  });

  it('includes Jötunn / Ogre in opposition', () => {
    expect(brief.briefText).toContain('Jötunn');
    expect(brief.briefText).toContain('Ogre');
  });

  it('includes Fjell-Ørn / Giant Eagle in opposition', () => {
    expect(brief.briefText).toContain('Fjell-Ørn');
    expect(brief.briefText).toContain('Giant Eagle');
  });

  it('marks Fjell-Ørn as non-combat', () => {
    expect(brief.briefText).toContain('Fjell-Ørn does NOT attack');
  });

  it('lists forbidden monster names explicitly', () => {
    expect(brief.briefText).toContain('Dire Wolf');
    expect(brief.briefText).toContain('Goblin');
  });

  it('forbids "reskinned"', () => {
    expect(brief.briefText).toContain('"reskinned"');
  });

  it('forbids "based on"', () => {
    expect(brief.briefText).toContain('"based on"');
  });

  it('forbids Monster Manual', () => {
    expect(brief.briefText).toContain('Monster Manual');
  });

  it('contains scaling constraint', () => {
    expect(brief.briefText).toContain('NOT stat changes');
  });

  it('says "may not write: a different creature list"', () => {
    expect(brief.briefText).toContain('different creature list');
  });

  it('does NOT contain the raw question text', () => {
    // The brief should not contain the original typo-laden raw question
    expect(brief.briefText).not.toContain('scandaniavian');
    expect(brief.briefText).not.toContain('reminscent');
    expect(brief.briefText).not.toContain('LLösweg');
  });

  it('brief allowed-opposition section does not list wolves, goblins as creatures', () => {
    // Goblins/wolves may appear in the FORBIDDEN list (correct) but must not
    // appear in "Allowed final opposition:" as a creature to use.
    const oppositionSection = brief.briefText.split('Locked rules:')[0] ?? brief.briefText;
    expect(oppositionSection.toLowerCase()).not.toContain('wolves');
    expect(oppositionSection.toLowerCase()).not.toContain('goblin');
    expect(oppositionSection.toLowerCase()).not.toContain('wolf\n');
  });
});

// ── renderDeterministicFallback ───────────────────────────────────────────────

describe('renderDeterministicFallback', () => {
  const intent = parseEncounterIntent(LOSWEG_QUESTION, { size: 4, level: 3 }, 'push', LOSWEG_SIGNALS, false);
  const fallback = renderDeterministicFallback(intent, PLAN);

  it('starts with ## Provisional encounter concept', () => {
    expect(fallback.trimStart()).toMatch(/^## Provisional encounter concept/);
  });

  it('contains all 10 required headings', () => {
    const headings = [
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
    ];
    for (const h of headings) {
      expect(fallback.toLowerCase()).toContain(h.toLowerCase());
    }
  });

  it('contains "Provisional table material"', () => {
    expect(fallback).toContain('Provisional table material');
  });

  it('includes Jötunn / Ogre in the fallback', () => {
    expect(fallback).toContain('Jötunn');
    expect(fallback).toContain('Ogre');
  });

  it('includes Fjell-Ørn / Giant Eagle', () => {
    expect(fallback).toContain('Fjell-Ørn');
    expect(fallback).toContain('Giant Eagle');
  });

  it('says scout does not engage in combat', () => {
    expect(fallback).toContain('does not engage in combat');
  });

  it('contains the locked creature scaffold', () => {
    // The scaffold should appear in ## Creatures / opposition
    expect(fallback).toContain('monsters/srd-2014/ogre');
    expect(fallback).toContain('monsters/srd-2014/giant-eagle');
  });

  it('references "loaded SRD 5.1" base', () => {
    expect(fallback).toContain('SRD 5.1');
  });
});

// ── formatEncounterBriefDebug ─────────────────────────────────────────────────

describe('formatEncounterBriefDebug', () => {
  const intent = parseEncounterIntent(LOSWEG_QUESTION, { size: 4, level: 3 }, 'push', LOSWEG_SIGNALS, false);
  const brief = compileEncounterBrief(intent, PLAN);
  const debug = formatEncounterBriefDebug(brief);

  it('contains "Compiled encounter brief:"', () => {
    expect(debug).toContain('Compiled encounter brief:');
  });

  it('lists allowed opposition', () => {
    expect(debug).toContain('Ogre');
    expect(debug).toContain('Giant Eagle');
  });

  it('says raw user question was NOT passed to model', () => {
    expect(debug).toContain('raw user question passed to model');
    expect(debug).toContain('no');
  });

  it('includes party info', () => {
    expect(debug).toContain('4 level 3');
  });
});

// ── Resolver integration — brief replaces raw question ────────────────────────

import { buildDesignMessages } from '../src/resolver.js';

describe('buildDesignMessages with encounterBrief', () => {
  it('uses briefText as user message when brief provided', () => {
    const intent = parseEncounterIntent(LOSWEG_QUESTION, { size: 4, level: 3 }, 'push', LOSWEG_SIGNALS, false);
    const brief = compileEncounterBrief(intent, PLAN);
    const msgs = buildDesignMessages([], [], LOSWEG_QUESTION, [], {
      compositionPlan: PLAN,
      encounterBrief: brief,
    });
    const userMsg = msgs.find(m => m.role === 'user')!;
    expect(userMsg.content).toBe(brief.briefText);
    expect(userMsg.content).not.toBe(LOSWEG_QUESTION);
  });

  it('falls back to raw question when no brief provided', () => {
    const msgs = buildDesignMessages([], [], LOSWEG_QUESTION);
    const userMsg = msgs.find(m => m.role === 'user')!;
    expect(userMsg.content).toBe(LOSWEG_QUESTION);
  });

  it('brief text does not contain typos from raw question', () => {
    const intent = parseEncounterIntent(LOSWEG_QUESTION, { size: 4, level: 3 }, 'push', LOSWEG_SIGNALS, false);
    const brief = compileEncounterBrief(intent, PLAN);
    const msgs = buildDesignMessages([], [], LOSWEG_QUESTION, [], { encounterBrief: brief });
    const userMsg = msgs.find(m => m.role === 'user')!;
    // The acceptance test query has "LLösweg", "scandaniavian", "reminscent"
    expect(userMsg.content).not.toContain('LLösweg');
    expect(userMsg.content).not.toContain('scandaniavian');
    expect(userMsg.content).not.toContain('reminscent');
  });
});
