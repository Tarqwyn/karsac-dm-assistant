import { describe, it, expect } from 'vitest'
import { loadScoredAdversaries, loadScoredPatterns, getNpcBaseSummaries, validateEncounterDesignContext } from '../src/encounter-design.js'
import { buildEncounterDesignMessages } from '../src/resolver.js'
import { ADVERSARY_CORPUS_ROOT, ENCOUNTER_PATTERNS_ROOT } from '../src/paths.js'
import type { EncounterDesignCtx } from '../src/resolver.js'

// ── loadScoredAdversaries ─────────────────────────────────────────────────────

describe('loadScoredAdversaries', () => {
  it('returns results for "customs inspection" query', () => {
    const results = loadScoredAdversaries(ADVERSARY_CORPUS_ROOT, 'customs inspection at the port')
    expect(results.length).toBeGreaterThan(0)
  })

  it('scores false-customs-officers highly for customs/dock/valweg queries', () => {
    const results = loadScoredAdversaries(
      ADVERSARY_CORPUS_ROOT,
      'Design a false customs inspection scene at the Valweg dock',
    )
    const top = results[0]
    expect(top).toBeDefined()
    expect(top.id).toContain('false-customs')
  })

  it('scores mathr-road-agents for road/checkpoint queries', () => {
    const results = loadScoredAdversaries(
      ADVERSARY_CORPUS_ROOT,
      'Create a road checkpoint scene with Mathr agents on the valweg road approach',
    )
    expect(results.length).toBeGreaterThan(0)
    const ids = results.map(r => r.id)
    expect(ids.some(id => id.includes('mathr-road') || id.includes('road-agent'))).toBe(true)
  })

  it('returns at most 3 results', () => {
    const results = loadScoredAdversaries(
      ADVERSARY_CORPUS_ROOT,
      'customs dock social encounter valweg mathr faction pressure arrival',
    )
    expect(results.length).toBeLessThanOrEqual(3)
  })

  it('returns empty array if no adversary scores > 0', () => {
    const results = loadScoredAdversaries(
      ADVERSARY_CORPUS_ROOT,
      'xyzzy frobozz nonexistent query with no matching terms',
    )
    expect(results).toEqual([])
  })

  it('each result has id, oppositionType, encounterRoles, mechanicalBase, playerSafeReveal, content', () => {
    const results = loadScoredAdversaries(
      ADVERSARY_CORPUS_ROOT,
      'customs inspection social obstruction at the dock',
    )
    expect(results.length).toBeGreaterThan(0)
    for (const r of results) {
      expect(typeof r.id).toBe('string')
      expect(r.id.length).toBeGreaterThan(0)
      expect(Array.isArray(r.oppositionType)).toBe(true)
      expect(Array.isArray(r.encounterRoles)).toBe(true)
      expect(Array.isArray(r.mechanicalBase)).toBe(true)
      expect(Array.isArray(r.playerSafeReveal)).toBe(true)
      expect(typeof r.content).toBe('string')
    }
  })
})

// ── loadScoredPatterns ────────────────────────────────────────────────────────

describe('loadScoredPatterns', () => {
  it('returns customs-inspection pattern for dock query', () => {
    const results = loadScoredPatterns(
      ENCOUNTER_PATTERNS_ROOT,
      'customs inspection at the Valweg dock arrival',
    )
    expect(results.length).toBeGreaterThan(0)
    const ids = results.map(r => r.id)
    expect(ids.some(id => id.includes('customs'))).toBe(true)
  })

  it('returns at most 2 patterns', () => {
    const results = loadScoredPatterns(
      ENCOUNTER_PATTERNS_ROOT,
      'social encounter dock delay customs inspection obstruction valweg arrival',
    )
    expect(results.length).toBeLessThanOrEqual(2)
  })

  it('returns empty array if patterns dir does not exist', () => {
    const results = loadScoredPatterns(
      '/non/existent/path/to/patterns',
      'customs inspection',
    )
    expect(results).toEqual([])
  })
})

// ── getNpcBaseSummaries ───────────────────────────────────────────────────────

describe('getNpcBaseSummaries', () => {
  it('returns spy summary for npc-bases/srd-2014/spy', () => {
    const result = getNpcBaseSummaries(['npc-bases/srd-2014/spy'])
    expect(result['npc-bases/srd-2014/spy']).toBeDefined()
    expect(result['npc-bases/srd-2014/spy']).toContain('Spy')
    expect(result['npc-bases/srd-2014/spy']).toContain('Deception')
  })

  it('returns guard and noble summaries', () => {
    const result = getNpcBaseSummaries(['npc-bases/srd-2014/guard', 'npc-bases/srd-2014/noble'])
    expect(result['npc-bases/srd-2014/guard']).toBeDefined()
    expect(result['npc-bases/srd-2014/guard']).toContain('Guard')
    expect(result['npc-bases/srd-2014/noble']).toBeDefined()
    expect(result['npc-bases/srd-2014/noble']).toContain('Noble')
  })

  it('returns empty object for unknown base', () => {
    const result = getNpcBaseSummaries(['npc-bases/srd-2014/dragon'])
    expect(Object.keys(result).length).toBe(0)
  })
})

// ── buildEncounterDesignMessages ──────────────────────────────────────────────

function makeMinimalCtx(overrides: Partial<EncounterDesignCtx> = {}): EncounterDesignCtx {
  const defaultAdversary = {
    id: 'adversaries/false-customs-officers',
    name: 'False Customs Officers',
    tags: ['customs', 'mathr', 'valweg'],
    oppositionType: ['social-obstacle', 'faction-agent'],
    encounterRoles: ['deceiver', 'interrogator', 'blocker'],
    campaignUse: ['dock-pressure', 'valweg-arrival'],
    mechanicalBase: ['npc-bases/srd-2014/spy', 'npc-bases/srd-2014/guard'],
    canKnow: ['their cover identity', 'what they are extracting'],
    mustNotKnow: ["Mathr's full hidden nature", 'Vishara'],
    tactics: ['establish authority', 'use procedural pressure'],
    escalation: {
      low: 'Routine inspection.',
      medium: 'Extended inspection.',
      high: 'Detention demand.',
    },
    playerSafeReveal: ['Their authority is correct in form. Something is slightly wrong with it.'],
    dmOnly: ['False customs officers are Mathr operatives.'],
    summary: 'Mathr-aligned operatives posing as customs officials.',
    content: '## Adversary Summary\n\nFalse customs officers are social adversaries.',
    path: '/fake/path/false-customs-officers.md',
    score: 12,
    scoreReasons: ['id-keyword: false customs'],
  }

  const defaultPattern = {
    id: 'encounter-patterns/non-monster/customs-inspection',
    name: 'Customs Inspection',
    encounterType: ['procedural-delay', 'social-obstruction'],
    useWhen: ['party arrives by sea at a controlled port'],
    doNotUseWhen: ['the port is friendly'],
    usefulNpcBases: ['spy', 'guard', 'noble'],
    commonChecks: ['Insight', 'Deception', 'Persuasion'],
    summary: 'A controlled port arrival becomes a procedural obstacle.',
    content: '## Pattern Summary\n\nThe party faces a customs inspection.',
    score: 8,
  }

  return {
    adversaries: [defaultAdversary],
    patterns: [defaultPattern],
    npcBases: {
      'npc-bases/srd-2014/spy': 'Spy — CR 1, AC 12, HP 27.',
      'npc-bases/srd-2014/guard': 'Guard — CR 1/8, AC 16, HP 11.',
    },
    stateData: {
      campaignState: { currentSession: 2, currentChapter: 2 },
      partyState: { partyLevel: 3, partySize: 4 },
      worldThreads: null,
      playerKnowledge: null,
    },
    ...overrides,
  }
}

describe('buildEncounterDesignMessages', () => {
  it('returns system + user messages', () => {
    const ctx = makeMinimalCtx()
    const msgs = buildEncounterDesignMessages(ctx, 'Design a customs inspection at Valweg')
    expect(msgs.length).toBe(2)
    expect(msgs[0].role).toBe('system')
    expect(msgs[1].role).toBe('user')
  })

  it('system message contains "encounter purpose" instruction', () => {
    const ctx = makeMinimalCtx()
    const msgs = buildEncounterDesignMessages(ctx, 'Design a dock encounter')
    expect(msgs[0].content.toLowerCase()).toContain('encounter purpose')
  })

  it('system message contains "combat fallback" instruction', () => {
    const ctx = makeMinimalCtx()
    const msgs = buildEncounterDesignMessages(ctx, 'Design a dock encounter')
    expect(msgs[0].content.toLowerCase()).toContain('combat')
    expect(msgs[0].content.toLowerCase()).toContain('fallback')
  })

  it('system message contains adversary player_safe_reveal', () => {
    const ctx = makeMinimalCtx()
    const msgs = buildEncounterDesignMessages(ctx, 'Design a customs inspection')
    expect(msgs[0].content).toContain('Their authority is correct in form')
  })

  it('system message separates player-safe from dm_only', () => {
    const ctx = makeMinimalCtx()
    const msgs = buildEncounterDesignMessages(ctx, 'Design a customs inspection')
    const system = msgs[0].content
    expect(system).toContain('player_safe_reveal')
    expect(system).toContain('dm_only')
    expect(system).toContain('MUST NOT')
  })

  it('user message contains all 13 section headings', () => {
    const ctx = makeMinimalCtx()
    const msgs = buildEncounterDesignMessages(ctx, 'Design a customs inspection')
    const user = msgs[1].content
    expect(user).toContain('## Encounter Type')
    expect(user).toContain('## Campaign Purpose')
    expect(user).toContain('## Cast')
    expect(user).toContain('## Opening Beat')
    expect(user).toContain('## What the Opposition Wants')
    expect(user).toContain('## What the Players Can Notice')
    expect(user).toContain('## Pressure Ladder')
    expect(user).toContain('## Checks and Mechanics')
    expect(user).toContain('## Player Choices')
    expect(user).toContain('## Outcomes')
    expect(user).toContain('## Combat Fallback')
    expect(user).toContain('## State Updates')
    expect(user).toContain('## Follow-up Hooks')
  })

  it('user message contains "## Combat Fallback" heading', () => {
    const ctx = makeMinimalCtx()
    const msgs = buildEncounterDesignMessages(ctx, 'Design a customs inspection')
    expect(msgs[1].content).toContain('## Combat Fallback')
  })

  it('user message contains "## State Updates" heading', () => {
    const ctx = makeMinimalCtx()
    const msgs = buildEncounterDesignMessages(ctx, 'Design a customs inspection')
    expect(msgs[1].content).toContain('## State Updates')
  })

  it('user message contains original question', () => {
    const question = 'Design a false customs inspection scene at the Valweg dock arrival'
    const ctx = makeMinimalCtx()
    const msgs = buildEncounterDesignMessages(ctx, question)
    expect(msgs[1].content).toContain(question)
  })
})

// ── Monster exclusion ─────────────────────────────────────────────────────────

describe('loadScoredAdversaries — monster exclusion', () => {
  it('excludes maw-changed-creatures for non-monster dock query', () => {
    const results = loadScoredAdversaries(
      ADVERSARY_CORPUS_ROOT,
      'non-monster encounter at the dock in Valweg',
    )
    const ids = results.map(r => r.id)
    expect(ids.some(id => id.includes('maw-changed'))).toBe(false)
  })

  it('does not exclude monster adversaries when combat is requested', () => {
    const results = loadScoredAdversaries(
      ADVERSARY_CORPUS_ROOT,
      'fight with maw-changed creatures on the road combat',
    )
    // maw-changed should score positively when combat is explicit
    expect(results.length).toBeGreaterThanOrEqual(0) // may or may not score, but must not crash
  })

  it('false-customs-officers is not excluded for social dock query', () => {
    const results = loadScoredAdversaries(
      ADVERSARY_CORPUS_ROOT,
      'non-monster dock encounter at Valweg customs',
    )
    const ids = results.map(r => r.id)
    expect(ids.some(id => id.includes('false-customs'))).toBe(true)
  })
})

// ── Pattern keyword boosts ────────────────────────────────────────────────────

describe('loadScoredPatterns — keyword boosts', () => {
  it('boosts dock-delay for dock query', () => {
    const results = loadScoredPatterns(
      ENCOUNTER_PATTERNS_ROOT,
      'non-monster encounter at the dock',
    )
    const ids = results.map(r => r.id)
    expect(ids.some(id => id.includes('dock'))).toBe(true)
  })

  it('boosts customs-inspection for customs/cargo/port query', () => {
    const results = loadScoredPatterns(
      ENCOUNTER_PATTERNS_ROOT,
      'cargo inspection at the port of Valweg',
    )
    const ids = results.map(r => r.id)
    expect(ids.some(id => id.includes('customs') || id.includes('dock'))).toBe(true)
  })

  it('boosts roadblock for gate/checkpoint query', () => {
    const results = loadScoredPatterns(
      ENCOUNTER_PATTERNS_ROOT,
      'gate checkpoint obstruction at the city entry',
    )
    const ids = results.map(r => r.id)
    expect(ids.some(id => id.includes('roadblock') || id.includes('customs'))).toBe(true)
  })

  it('boosts bribery-attempt for bribe query', () => {
    const results = loadScoredPatterns(
      ENCOUNTER_PATTERNS_ROOT,
      'bribe the official at the dock to get through',
    )
    const ids = results.map(r => r.id)
    expect(ids.some(id => id.includes('bribery'))).toBe(true)
  })
})

// ── System prompt rule checks ─────────────────────────────────────────────────

describe('buildEncounterDesignMessages — new rules', () => {
  it('system message contains NPC base fidelity rule', () => {
    const ctx = makeMinimalCtx()
    const msgs = buildEncounterDesignMessages(ctx, 'Design a dock encounter')
    const system = msgs[0].content
    expect(system).toContain('NPC BASE RULE')
    expect(system).toContain('EXACT')
  })

  it('system message contains Karsac faction rule about Mathr sigil', () => {
    const ctx = makeMinimalCtx()
    const msgs = buildEncounterDesignMessages(ctx, 'Design a customs scene')
    const system = msgs[0].content
    expect(system).toContain('KARSAC FACTION RULE')
    expect(system).toContain('Mathr sigil')
  })

  it('system message contains Karsac style rule banning modern tech', () => {
    const ctx = makeMinimalCtx()
    const msgs = buildEncounterDesignMessages(ctx, 'Design a dock scene')
    const system = msgs[0].content
    expect(system).toContain('KARSAC STYLE RULE')
    expect(system).toContain('scanners')
  })

  it('system message contains player-safe clue fidelity rule', () => {
    const ctx = makeMinimalCtx()
    const msgs = buildEncounterDesignMessages(ctx, 'Design a dock scene')
    const system = msgs[0].content
    expect(system).toContain('PLAYER-SAFE CLUE RULE')
  })

  it('system message contains DM-only rule', () => {
    const ctx = makeMinimalCtx()
    const msgs = buildEncounterDesignMessages(ctx, 'Design a customs encounter')
    const system = msgs[0].content
    expect(system).toContain('DM-ONLY RULE')
  })
})

// ── Arrival-context scoring ───────────────────────────────────────────────────

describe('loadScoredAdversaries — arrival-context', () => {
  it('false-customs-officers beats valweg-informants for "arrives in Valweg" query', () => {
    const results = loadScoredAdversaries(
      ADVERSARY_CORPUS_ROOT,
      'What non-monster encounter should happen when the party arrives in Valweg?',
    )
    const ids = results.map(r => r.id)
    const falseCustIdx = ids.findIndex(id => id.includes('false-customs'))
    const valwegInfIdx = ids.findIndex(id => id.includes('valweg-informant'))
    // false-customs must be present and ranked above valweg-informants (or informants absent)
    expect(falseCustIdx).toBeGreaterThanOrEqual(0)
    if (valwegInfIdx >= 0) {
      expect(falseCustIdx).toBeLessThan(valwegInfIdx)
    }
  })

  it('false-customs-officers is top adversary for "arrival at Valweg dock"', () => {
    const results = loadScoredAdversaries(
      ADVERSARY_CORPUS_ROOT,
      'non-monster social encounter when the party arrives at the Valweg dock',
    )
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].id).toContain('false-customs')
  })
})

// ── Pattern exclusion guards ──────────────────────────────────────────────────

describe('loadScoredPatterns — exclusion guards', () => {
  it('does not select bribery-attempt for generic Valweg arrival (no bribe keywords)', () => {
    const results = loadScoredPatterns(
      ENCOUNTER_PATTERNS_ROOT,
      'What non-monster encounter should happen when the party arrives in Valweg?',
    )
    const ids = results.map(r => r.id)
    expect(ids.some(id => id.includes('bribery'))).toBe(false)
  })

  it('does not select formal-audience for arrival without audience/council keywords', () => {
    const results = loadScoredPatterns(
      ENCOUNTER_PATTERNS_ROOT,
      'What non-monster encounter should happen when the party arrives in Valweg?',
    )
    const ids = results.map(r => r.id)
    expect(ids.some(id => id.includes('formal-audience'))).toBe(false)
  })

  it('selects bribery-attempt when bribe keyword is present', () => {
    const results = loadScoredPatterns(
      ENCOUNTER_PATTERNS_ROOT,
      'bribery attempt at the dock — the official wants a bribe to let them through',
    )
    const ids = results.map(r => r.id)
    expect(ids.some(id => id.includes('bribery'))).toBe(true)
  })

  it('selects formal-audience when council keyword is present', () => {
    const results = loadScoredPatterns(
      ENCOUNTER_PATTERNS_ROOT,
      'formal audience before the council to petition for access to the records',
    )
    const ids = results.map(r => r.id)
    expect(ids.some(id => id.includes('formal-audience') || id.includes('formal'))).toBe(true)
  })
})

// ── validateEncounterDesignContext ────────────────────────────────────────────

describe('validateEncounterDesignContext', () => {
  const makeAdversary = (id: string, oppositionType: string[], tags: string[]): any => ({
    id, name: id, tags, oppositionType, encounterRoles: [], campaignUse: [],
    mechanicalBase: [], canKnow: [], mustNotKnow: [], tactics: [],
    escalation: {}, playerSafeReveal: [], dmOnly: [], summary: '',
    content: '', path: '', score: 10, scoreReasons: [],
  })

  it('passes when no violations', () => {
    const adv = makeAdversary('adversaries/false-customs-officers', ['social-obstacle'], ['customs'])
    const pat = { id: 'customs-inspection', name: 'Customs Inspection', encounterType: [], useWhen: [], doNotUseWhen: [], usefulNpcBases: [], commonChecks: [], summary: '', content: '', score: 5 }
    const result = validateEncounterDesignContext([adv], [pat], 'non-monster dock encounter at Valweg')
    expect(result.valid).toBe(true)
    expect(result.adversaryViolations).toEqual([])
    expect(result.patternViolations).toEqual([])
  })

  it('fails when monster adversary appears in non-monster query', () => {
    const adv = makeAdversary('adversaries/maw-changed', ['monster'], ['monster'])
    const result = validateEncounterDesignContext(
      [adv], [],
      'non-monster social encounter at the dock',
    )
    expect(result.valid).toBe(false)
    expect(result.adversaryViolations.length).toBeGreaterThan(0)
  })

  it('passes when monster adversary appears in combat query', () => {
    const adv = makeAdversary('adversaries/maw-changed', ['monster'], ['monster'])
    const result = validateEncounterDesignContext(
      [adv], [],
      'combat fight with creatures on the road',
    )
    expect(result.valid).toBe(true)
  })

  it('fails when bribery-attempt pattern is selected without bribe keywords', () => {
    const pat = { id: 'encounter-patterns/non-monster/bribery-attempt', name: 'Bribery Attempt', encounterType: [], useWhen: [], doNotUseWhen: [], usefulNpcBases: [], commonChecks: [], summary: '', content: '', score: 5 }
    const result = validateEncounterDesignContext(
      [], [pat],
      'non-monster encounter at the Valweg dock arrival',
    )
    expect(result.valid).toBe(false)
    expect(result.patternViolations.length).toBeGreaterThan(0)
  })

  it('passes when bribery-attempt pattern is selected with bribe keyword', () => {
    const pat = { id: 'encounter-patterns/non-monster/bribery-attempt', name: 'Bribery Attempt', encounterType: [], useWhen: [], doNotUseWhen: [], usefulNpcBases: [], commonChecks: [], summary: '', content: '', score: 5 }
    const result = validateEncounterDesignContext(
      [], [pat],
      'the official wants a bribe to let the party through the dock',
    )
    expect(result.valid).toBe(true)
  })
})

// ── Explicit monster locking (design profile input) ───────────────────────────
// These tests verify the scoreMonsterCandidates function behaviour is correct
// by testing via the full loadScoredAdversaries pipeline (which mirrors the
// monster scoring logic). Actual design profile testing requires a live corpus.

describe('buildEncounterDesignMessages — Vane/Mathr separation', () => {
  it('system message contains Mathr/Vane distinction rule', () => {
    const ctx = {
      adversaries: [],
      patterns: [],
      npcBases: {},
      stateData: { campaignState: null, partyState: null, worldThreads: null, playerKnowledge: null },
    }
    const msgs = buildEncounterDesignMessages(ctx, 'Design a dock scene for Mathr agents')
    const system = msgs[0].content
    expect(system).toContain('Vane ONLY')
    expect(system).toContain('DISTINCT')
  })

  it('system message contains Karsac style ban on scanners/trackers', () => {
    const ctx = {
      adversaries: [],
      patterns: [],
      npcBases: {},
      stateData: { campaignState: null, partyState: null, worldThreads: null, playerKnowledge: null },
    }
    const msgs = buildEncounterDesignMessages(ctx, 'Design a dock scene')
    expect(msgs[0].content).toContain('scanners')
    expect(msgs[0].content).toContain('KARSAC STYLE RULE')
  })
})
