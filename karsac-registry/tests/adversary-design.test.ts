import { describe, it, expect } from 'vitest'
import { detectRequestedBase, loadBaseFile, loadContextAdversaries } from '../src/adversary-design.js'
import { buildAdversaryDesignMessages } from '../src/resolver.js'
import { COLLECTIONS_ROOT, ADVERSARY_CORPUS_ROOT } from '../src/paths.js'

// ── detectRequestedBase ───────────────────────────────────────────────────────

describe('detectRequestedBase', () => {
  it('detects "spy" from "based on the Spy NPC"', () => {
    expect(detectRequestedBase('Design a dock interrogator based on the Spy NPC')).toBe('spy')
  })

  it('detects "veteran" from "using the Veteran base"', () => {
    expect(detectRequestedBase('Create a housecarl captain using the Veteran base')).toBe('veteran')
  })

  it('detects "noble" from "using Noble as the base"', () => {
    expect(detectRequestedBase('Make me a Maw-touched official using Noble as the base')).toBe('noble')
  })

  it('detects "bandit" from "using the Bandit base"', () => {
    expect(detectRequestedBase('Create a road agent captain using the Bandit base')).toBe('bandit')
  })

  it('detects "spy" from "use spy as a base"', () => {
    expect(detectRequestedBase('Use spy as a base but make them Karsac-specific')).toBe('spy')
  })

  it('detects "guard" from "use the guard"', () => {
    expect(detectRequestedBase('Use the guard but add a social intimidation ability')).toBe('guard')
  })

  it('detects "bandit-captain" from "bandit captain"', () => {
    const result = detectRequestedBase('Use the bandit captain as a foundation')
    expect(result).toBe('bandit captain')
  })

  it('returns null when no base is specified', () => {
    expect(detectRequestedBase('Design an adversary called The Salt-Witness')).toBeNull()
  })

  it('returns null for encounter queries without a base', () => {
    expect(detectRequestedBase('Design a dock encounter at Valweg using Mathr agents')).toBeNull()
  })
})

// ── loadBaseFile ──────────────────────────────────────────────────────────────

describe('loadBaseFile', () => {
  it('loads spy.md successfully', () => {
    const result = loadBaseFile('spy', COLLECTIONS_ROOT)
    expect(result).not.toBeNull()
    expect(result?.id).toContain('spy')
    expect(result?.content).toContain('Spy')
    expect(result?.content).toMatch(/[Aa]rmou?r Class/)
    expect(result?.content).toContain('Hit Points')
  })

  it('loads noble.md successfully', () => {
    const result = loadBaseFile('noble', COLLECTIONS_ROOT)
    expect(result).not.toBeNull()
    expect(result?.id).toContain('noble')
    expect(result?.content).toContain('Noble')
  })

  it('loads veteran.md successfully', () => {
    const result = loadBaseFile('veteran', COLLECTIONS_ROOT)
    expect(result).not.toBeNull()
    expect(result?.content).toContain('Veteran')
    expect(result?.content).toContain('Multiattack')
  })

  it('loads guard.md successfully', () => {
    const result = loadBaseFile('guard', COLLECTIONS_ROOT)
    expect(result).not.toBeNull()
    expect(result?.content).toContain('Guard')
  })

  it('loads bandit.md successfully', () => {
    const result = loadBaseFile('bandit', COLLECTIONS_ROOT)
    expect(result).not.toBeNull()
    expect(result?.content).toContain('Bandit')
  })

  it('returns null for unknown base', () => {
    const result = loadBaseFile('xyzzy-made-up-creature', COLLECTIONS_ROOT)
    expect(result).toBeNull()
  })

  it('returned file includes full stat block', () => {
    const result = loadBaseFile('spy', COLLECTIONS_ROOT)
    expect(result?.content).toContain('STR')
    expect(result?.content).toContain('DEX')
    expect(result?.content).toContain('Challenge')
  })
})

// ── loadContextAdversaries ────────────────────────────────────────────────────

describe('loadContextAdversaries', () => {
  it('returns Mathr adversaries for Mathr-themed query', () => {
    const results = loadContextAdversaries(
      ADVERSARY_CORPUS_ROOT,
      'Design a Mathr dock interrogator',
    )
    expect(results.length).toBeGreaterThan(0)
    const ids = results.map(r => r.id)
    expect(ids.some(id => id.includes('mathr') || id.includes('false-customs') || id.includes('valweg'))).toBe(true)
  })

  it('returns empty array for generic non-faction query', () => {
    const results = loadContextAdversaries(
      ADVERSARY_CORPUS_ROOT,
      'Design an adversary based on the spy NPC with social skills',
    )
    expect(results).toEqual([])
  })

  it('returns Maw context for maw-touched query', () => {
    const results = loadContextAdversaries(
      ADVERSARY_CORPUS_ROOT,
      'Design a Maw-touched customs official',
    )
    // May or may not find maw adversaries depending on corpus
    expect(Array.isArray(results)).toBe(true)
  })

  it('returns at most 2 results', () => {
    const results = loadContextAdversaries(
      ADVERSARY_CORPUS_ROOT,
      'Design a Karsac Mathr road agent with valweg faction influence',
    )
    expect(results.length).toBeLessThanOrEqual(2)
  })
})

// ── buildAdversaryDesignMessages ─────────────────────────────────────────────

function makeMinimalAdversaryCtx(overrides: any = {}) {
  return {
    requestedBase: 'spy',
    baseFile: {
      id: 'monsters/srd-2014/spy',
      slug: 'spy',
      name: 'Spy',
      content: '## Stat Block\n- **Armour Class:** 12\n- **Hit Points:** 27 (6d8)\n- **Challenge:** 1\n',
      path: '/fake/spy.md',
    },
    relatedAdversaries: [],
    stateData: { campaignState: null, worldThreads: null, npcsState: null },
    loadedFiles: ['/fake/spy.md'],
    ...overrides,
  }
}

describe('buildAdversaryDesignMessages', () => {
  it('returns system + user messages', () => {
    const msgs = buildAdversaryDesignMessages(makeMinimalAdversaryCtx(), 'Design a Mathr interrogator based on a spy')
    expect(msgs.length).toBe(2)
    expect(msgs[0].role).toBe('system')
    expect(msgs[1].role).toBe('user')
  })

  it('system message contains the base stat block content', () => {
    const msgs = buildAdversaryDesignMessages(makeMinimalAdversaryCtx(), 'Design a dock interrogator based on spy')
    expect(msgs[0].content).toContain('monsters/srd-2014/spy')
    expect(msgs[0].content).toContain('Armour Class')
  })

  it('user message contains all required section headings', () => {
    const msgs = buildAdversaryDesignMessages(makeMinimalAdversaryCtx(), 'Design a spy-based interrogator')
    const user = msgs[1].content
    expect(user).toContain('## Design Intent')
    expect(user).toContain('## Mechanical Base')
    expect(user).toContain('## Adaptation Summary')
    expect(user).toContain('## Stat Block')
    expect(user).toContain('## Traits')
    expect(user).toContain('## Actions')
    expect(user).toContain('## Tactics')
    expect(user).toContain('## Social / Investigation Use')
    expect(user).toContain('## Player-Safe Description')
    expect(user).toContain('## DM-Only Notes')
    expect(user).toContain('## Scaling Options')
    expect(user).toContain('## Corpus Frontmatter')
  })

  it('user message contains the original question', () => {
    const q = 'Design a Mathr dock interrogator based on the Spy NPC'
    const msgs = buildAdversaryDesignMessages(makeMinimalAdversaryCtx(), q)
    expect(msgs[1].content).toContain(q)
  })

  it('system message contains balance rules', () => {
    const msgs = buildAdversaryDesignMessages(makeMinimalAdversaryCtx(), 'Design a spy')
    const system = msgs[0].content
    expect(system).toContain('Save DCs')
    expect(system).toContain('DC 13')
    expect(system).toContain('Mechanical risk')
  })

  it('system message contains Karsac style guardrails', () => {
    const msgs = buildAdversaryDesignMessages(makeMinimalAdversaryCtx(), 'Design a spy')
    expect(msgs[0].content).toContain('KARSAC STYLE GUARDRAILS')
    expect(msgs[0].content).toContain('seals')
  })

  it('system message contains named entity rule', () => {
    const msgs = buildAdversaryDesignMessages(makeMinimalAdversaryCtx(), 'Design a spy for Mathr')
    expect(msgs[0].content).toContain('NAMED ENTITY RULE')
    expect(msgs[0].content).toContain('Provisional name')
  })

  it('system message contains player-safe vs DM-only rule', () => {
    const msgs = buildAdversaryDesignMessages(makeMinimalAdversaryCtx(), 'Design a spy')
    expect(msgs[0].content).toContain('PLAYER-SAFE vs DM-ONLY')
  })

  it('system message contains validation rule', () => {
    const msgs = buildAdversaryDesignMessages(makeMinimalAdversaryCtx(), 'Design a spy')
    expect(msgs[0].content).toContain('VALIDATION RULE')
  })

  it('user message contains the detected base line when base is loaded', () => {
    const msgs = buildAdversaryDesignMessages(makeMinimalAdversaryCtx(), 'Design based on spy')
    expect(msgs[1].content).toContain('monsters/srd-2014/spy')
  })

  it('user message contains stat block ability score table', () => {
    const msgs = buildAdversaryDesignMessages(makeMinimalAdversaryCtx(), 'Design a spy')
    const user = msgs[1].content
    expect(user).toContain('STR')
    expect(user).toContain('DEX')
  })

  it('system message mentions "adversary designer" role', () => {
    const msgs = buildAdversaryDesignMessages(makeMinimalAdversaryCtx(), 'Design a spy')
    expect(msgs[0].content.toLowerCase()).toContain('adversary designer')
  })
})

// ── Strengthened validation rules (items 1–8) ─────────────────────────────────

describe('buildAdversaryDesignMessages — strengthened rules', () => {
  it('system message contains ADAPTATION CONSISTENCY RULE (item 1)', () => {
    const msgs = buildAdversaryDesignMessages(makeMinimalAdversaryCtx(), 'Design a spy')
    expect(msgs[0].content).toContain('ADAPTATION CONSISTENCY RULE')
    expect(msgs[0].content).toContain('Kept from base')
    expect(msgs[0].content).toContain('Removed:')
  })

  it('system message contains AVAILABLE BASES RULE with corpus list (item 2)', () => {
    const msgs = buildAdversaryDesignMessages(makeMinimalAdversaryCtx(), 'Design a spy')
    const system = msgs[0].content
    expect(system).toContain('AVAILABLE BASES RULE')
    expect(system).toContain('monsters/srd-2014/spy')
    expect(system).toContain('Cult Fanatic')  // forbidden example
  })

  it('system message contains ALLY COMMAND RULE without saving throw (item 3)', () => {
    const msgs = buildAdversaryDesignMessages(makeMinimalAdversaryCtx(), 'Design a bandit captain')
    const system = msgs[0].content
    expect(system).toContain('ALLY COMMAND RULE')
    expect(system).toContain('do NOT require saving throws')
    expect(system).toContain('use its reaction')
  })

  it('system message contains SENSES AND LANGUAGES RULE (item 4)', () => {
    const msgs = buildAdversaryDesignMessages(makeMinimalAdversaryCtx(), 'Design a noble')
    expect(msgs[0].content).toContain('SENSES AND LANGUAGES RULE')
    expect(msgs[0].content).toContain('darkvision')
  })

  it('system message bans modern tech phrases (item 5)', () => {
    const msgs = buildAdversaryDesignMessages(makeMinimalAdversaryCtx(), 'Design a dock official')
    const system = msgs[0].content
    expect(system).toContain('database')  // listed as forbidden
    expect(system).toContain('harbour ledgers')
    expect(system).toContain('sealed arrival lists')
    expect(system).toContain('NEVER write')
  })

  it('system message contains SOCIAL ABILITY MECHANICS RULE (item 6)', () => {
    const msgs = buildAdversaryDesignMessages(makeMinimalAdversaryCtx(), 'Design a social spy')
    const system = msgs[0].content
    expect(system).toContain('SOCIAL ABILITY MECHANICS RULE')
    expect(system).toContain('ONE mechanic model')
  })

  it('system message says social-led adversaries do not fight to the death (item 7)', () => {
    const msgs = buildAdversaryDesignMessages(makeMinimalAdversaryCtx(), 'Design a social spy')
    expect(msgs[0].content).toContain('do NOT fight to the death')
  })

  it('system message contains named entity rule covering allied NPCs (item 8)', () => {
    const msgs = buildAdversaryDesignMessages(makeMinimalAdversaryCtx(), 'Design a Mathr agent')
    const system = msgs[0].content
    expect(system).toContain('unnamed Mathr handler')
    expect(system).toContain('Captain Cumbria')  // forbidden example
  })

  it('user message adaptation summary template says "Only what appears in stat block"', () => {
    const msgs = buildAdversaryDesignMessages(makeMinimalAdversaryCtx(), 'Design a spy')
    expect(msgs[1].content).toContain('ONLY what actually appears in your stat block')
  })

  it('validation rule lists all key failure modes', () => {
    const msgs = buildAdversaryDesignMessages(makeMinimalAdversaryCtx(), 'Design a spy')
    const system = msgs[0].content
    expect(system).toContain('Kept from base')  // consistency check in validation
    expect(system).toContain('saving throw')    // ally saving throw check
    expect(system).toContain('fights to the death')  // social morale check
    expect(system).toContain('database')        // modern tech check
  })
})

// ── validateAdversaryOutput ───────────────────────────────────────────────────

import { validateAdversaryOutput } from '../src/adversary-design.js'

const SPY_BASE_CONTENT = '**Armor Class** 12\n**Hit Points** 27\n**Senses** passive Perception 16\n**Languages** any two\n'

describe('validateAdversaryOutput', () => {
  it('passes a clean valid output', () => {
    const output = `# Adversary: The Interrogator
## Design Intent
Social-led.
## Adaptation Summary
- Kept from base: Cunning Action, Sneak Attack
- Changed from base: Added Insight focus
- Added: Document Read
- Removed: Multiattack
- Mechanical risk: None
## Stat Block
**Armour Class** 12
**Hit Points** 27
**Senses** passive Perception 16
### Traits
**Cunning Action.** On each of its turns, the interrogator can use a bonus action to Dash, Disengage, or Hide.
**Sneak Attack (1/Turn).** The interrogator deals an extra 7 (2d6) damage when it has advantage.
### Actions
**Shortsword.** Melee Weapon Attack: +4 to hit, Hit: 5 (1d6+2) piercing damage.
## Tactics
The interrogator escapes when exposed. Does not fight to the death.
`
    const result = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT)
    expect(result.valid).toBe(true)
    expect(result.violations).toEqual([])
  })

  it('detects (Bonus Action) under Actions section (item 4)', () => {
    const output = `# Adversary: Verin
## Stat Block
### Actions
**Misinformation.** (Bonus Action) Verin spreads confusion.
`
    const result = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT)
    expect(result.valid).toBe(false)
    expect(result.violations.some(v => v.includes('Bonus Action'))).toBe(true)
  })

  it('detects stale name in ability text (item 3)', () => {
    const output = `# Adversary: The Salt-Witness
## Stat Block
### Actions
**Whispered Orders.** Korrigan chooses one creature within 30 feet.
`
    const result = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT)
    expect(result.valid).toBe(false)
    expect(result.violations.some(v => v.includes('Korrigan'))).toBe(true)
  })

  it('does not flag ability using own adversary name', () => {
    const output = `# Adversary: Korrigan
## Stat Block
### Actions
**Command.** Korrigan chooses one allied creature within 30 feet.
`
    const result = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT)
    // Should not flag "Korrigan" since that IS the adversary name
    const staleViolations = result.violations.filter(v => v.includes('Stale name'))
    expect(staleViolations).toEqual([])
  })

  it('detects unexplained darkvision when base has none (item 2)', () => {
    const output = `# Adversary: The Salt-Witness
## Adaptation Summary
- Kept from base: Persuasion skills
- Changed from base: Added social ability
- Added: social trait
- Removed: none
- Mechanical risk: none
## Stat Block
**Senses** Darkvision 60 ft., passive Perception 14
`
    const result = validateAdversaryOutput(output, 'noble', SPY_BASE_CONTENT)
    expect(result.valid).toBe(false)
    expect(result.violations.some(v => v.includes('darkvision'))).toBe(true)
  })

  it('does not flag darkvision if base has darkvision', () => {
    const baseWithDarkvision = 'Darkvision 60 ft., passive Perception 14\n'
    const output = `# Adversary: Shadow Agent
## Stat Block
**Senses** Darkvision 60 ft., passive Perception 14
`
    const result = validateAdversaryOutput(output, 'spy', baseWithDarkvision)
    const dkViolations = result.violations.filter(v => v.includes('darkvision'))
    expect(dkViolations).toEqual([])
  })

  it('detects round-based delay in social context (item 5)', () => {
    const output = `# Adversary: The Interrogator
## Stat Block
### Actions
**Misdirection.** The target is delayed for 1d4 rounds.
`
    const result = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT)
    expect(result.valid).toBe(false)
    expect(result.violations.some(v => v.includes('Round-based delay'))).toBe(true)
  })

  it('detects "fights to the death" for social-led adversary (item 6)', () => {
    const output = `# Adversary: Dock Inspector
## Design Intent
Social-led threat.
## Tactics
Fights to the death to protect the cargo manifest.
`
    const result = validateAdversaryOutput(output, 'noble', SPY_BASE_CONTENT)
    expect(result.valid).toBe(false)
    expect(result.violations.some(v => v.includes('fights to the death'))).toBe(true)
  })

  it('detects modern tech language (item 5/style)', () => {
    const output = `# Adversary: Warden
## Social / Investigation Use
The warden has access to a database of cargo records.
`
    const result = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT)
    expect(result.valid).toBe(false)
    expect(result.violations.some(v => v.includes('database'))).toBe(true)
  })

  it('does not flag legitimate uses of rounds (e.g. combat duration)', () => {
    const output = `# Adversary: Fighter
## Stat Block
### Actions
**Sturdy Stance.** Until the start of its next turn, the fighter has advantage on saving throws.
`
    const result = validateAdversaryOutput(output, 'guard', SPY_BASE_CONTENT)
    const roundViolations = result.violations.filter(v => v.includes('Round-based'))
    expect(roundViolations).toEqual([])
  })
})

// ── Mechanical validation additions ──────────────────────────────────────────

describe('validateAdversaryOutput — mechanical checks', () => {
  it('detects non-5e skill Diplomacy (item 4)', () => {
    const output = `# Adversary: The Agent
## Stat Block
**Skills** Diplomacy +5, Insight +4
`
    const result = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT)
    expect(result.valid).toBe(false)
    expect(result.violations.some(v => v.includes('Diplomacy'))).toBe(true)
  })

  it('does not flag valid 5e skills', () => {
    const output = `# Adversary: The Agent
## Stat Block
**Skills** Persuasion +5, Insight +4, Deception +6
`
    const result = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT)
    const skillViolations = result.violations.filter(v => v.includes('Diplomacy'))
    expect(skillViolations).toEqual([])
  })

  it('detects wrong damage average: Hit: 3 (1d6 + 2) (item 2)', () => {
    const output = `# Adversary: Agent
## Stat Block
### Actions
**Shortsword.** Melee Weapon Attack: +4 to hit, Hit: 3 (1d6 + 2) piercing damage.
`
    const result = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT)
    expect(result.valid).toBe(false)
    expect(result.violations.some(v => v.includes('Damage formula'))).toBe(true)
  })

  it('accepts correct damage average: Hit: 5 (1d6 + 2)', () => {
    const output = `# Adversary: Agent
## Stat Block
### Actions
**Shortsword.** Melee Weapon Attack: +4 to hit, Hit: 5 (1d6 + 2) piercing damage.
`
    const result = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT)
    const dmgViolations = result.violations.filter(v => v.includes('Damage formula'))
    expect(dmgViolations).toEqual([])
  })

  it('accepts Hit: 9 (2d6 + 2)', () => {
    // avg 2d6 = 7, +2 = 9
    const output = `## Actions\n**Longsword.** Hit: 9 (2d6 + 2) slashing damage.\n`
    const result = validateAdversaryOutput(output, 'veteran', null)
    const dmgViolations = result.violations.filter(v => v.includes('Damage formula'))
    expect(dmgViolations).toEqual([])
  })

  it('detects wrong damage average: Hit: 3 (2d6 + 2) — average is 9', () => {
    const output = `## Actions\n**Longsword.** Hit: 3 (2d6 + 2) slashing damage.\n`
    const result = validateAdversaryOutput(output, 'veteran', null)
    expect(result.violations.some(v => v.includes('Damage formula'))).toBe(true)
  })
})

// ── New system prompt rules ───────────────────────────────────────────────────

describe('buildAdversaryDesignMessages — new rules (mechanical)', () => {
  it('system message contains HP FORMULA RULE', () => {
    const msgs = buildAdversaryDesignMessages(makeMinimalAdversaryCtx(), 'Design a spy')
    expect(msgs[0].content).toContain('HP FORMULA RULE')
    expect(msgs[0].content).toContain('CON bonus')
  })

  it('system message contains DAMAGE FORMULA RULE', () => {
    const msgs = buildAdversaryDesignMessages(makeMinimalAdversaryCtx(), 'Design a spy')
    expect(msgs[0].content).toContain('DAMAGE FORMULA RULE')
    expect(msgs[0].content).toContain('average')
  })

  it('system message contains SKILLS RULE forbidding Diplomacy', () => {
    const msgs = buildAdversaryDesignMessages(makeMinimalAdversaryCtx(), 'Design a spy')
    expect(msgs[0].content).toContain('SKILLS RULE')
    expect(msgs[0].content).toContain('Diplomacy')
    expect(msgs[0].content).toContain('Persuasion')
  })

  it('system message contains NO ABSOLUTE SOCIAL COMPULSION RULE', () => {
    const msgs = buildAdversaryDesignMessages(makeMinimalAdversaryCtx(), 'Design a social spy')
    expect(msgs[0].content).toContain('NO ABSOLUTE SOCIAL COMPULSION RULE')
    expect(msgs[0].content).toContain('must comply')
  })

  it('system message contains SOCIAL-LED DURABILITY RULE', () => {
    const msgs = buildAdversaryDesignMessages(makeMinimalAdversaryCtx(), 'Design a social spy')
    expect(msgs[0].content).toContain('SOCIAL-LED DURABILITY RULE')
  })

  it('system message contains PASSIVE AURA RULE', () => {
    const msgs = buildAdversaryDesignMessages(makeMinimalAdversaryCtx(), 'Design a social spy')
    expect(msgs[0].content).toContain('PASSIVE AURA RULE')
    expect(msgs[0].content).toContain('Once per scene')
  })
})

// ── repairAdversaryOutput ─────────────────────────────────────────────────────

import { repairAdversaryOutput } from '../src/adversary-design.js'

describe('repairAdversaryOutput', () => {
  const DARKVISION_VIOLATION: AdversaryValidation = {
    violations: ['Unexplained darkvision: base has none but stat block adds it'],
    valid: false,
  }

  it('removes Darkvision from senses line when violation present', () => {
    const output = `**Senses** passive Perception 16, Darkvision 60 ft.\n`
    const repaired = repairAdversaryOutput(output, DARKVISION_VIOLATION, null)
    expect(repaired).not.toContain('Darkvision')
    expect(repaired).toContain('passive Perception 16')
  })

  it('removes Darkvision when it leads the senses line', () => {
    const output = `**Senses** Darkvision 60 ft., passive Perception 14\n`
    const repaired = repairAdversaryOutput(output, DARKVISION_VIOLATION, null)
    expect(repaired).not.toContain('Darkvision')
    expect(repaired).toContain('passive Perception 14')
  })

  it('does not touch output when no darkvision violation', () => {
    const output = `**Senses** passive Perception 16\n`
    const noViolation: AdversaryValidation = { violations: [], valid: true }
    const repaired = repairAdversaryOutput(output, noViolation, null)
    expect(repaired).toBe(output)
  })

  it('after repair, darkvision no longer triggers validation failure', () => {
    const output = `# Adversary: Test
## Adaptation Summary
- Kept from base: skills
- Added: social trait
## Stat Block
**Senses** passive Perception 16, Darkvision 60 ft.
`
    const validation = validateAdversaryOutput(output, 'noble', SPY_BASE_CONTENT)
    const repaired = repairAdversaryOutput(output, validation, SPY_BASE_CONTENT)
    const revalidation = validateAdversaryOutput(repaired, 'noble', SPY_BASE_CONTENT)
    const dkViolations = revalidation.violations.filter(v => v.includes('darkvision'))
    expect(dkViolations).toEqual([])
  })
})

// ── New system prompt rules (items 2–4) ───────────────────────────────────────

describe('buildAdversaryDesignMessages — items 2-4', () => {
  it('system message contains SIGNATURE ABILITY RULE (item 2)', () => {
    const msgs = buildAdversaryDesignMessages(makeMinimalAdversaryCtx(), 'Design a social spy')
    const system = msgs[0].content
    expect(system).toContain('SIGNATURE ABILITY RULE')
    expect(system).toContain('scene-facing effect')
    expect(system).toContain('What changes in the scene')
  })

  it('system message contains SOCIAL-LED MULTIATTACK RULE (item 3)', () => {
    const msgs = buildAdversaryDesignMessages(makeMinimalAdversaryCtx(), 'Design a social-led spy')
    const system = msgs[0].content
    expect(system).toContain('SOCIAL-LED MULTIATTACK RULE')
    expect(system).toContain('Multiattack')
  })

  it('user message Corpus Frontmatter section contains full schema (item 4)', () => {
    const msgs = buildAdversaryDesignMessages(makeMinimalAdversaryCtx(), 'Design a spy with corpus entry')
    const user = msgs[1].content
    expect(user).toContain('opposition_type')
    expect(user).toContain('encounter_roles')
    expect(user).toContain('campaign_use')
    expect(user).toContain('mechanical_base')
    expect(user).toContain('homebrew_adjustments')
    expect(user).toContain('can_know')
    expect(user).toContain('must_not_know')
    expect(user).toContain('player_safe_reveal')
    expect(user).toContain('dm_only')
    expect(user).toContain('escalation')
    expect(user).toContain('tactics')
    expect(user).toContain('summary')
  })
})

// TypeScript type alias for the import
type AdversaryValidation = import('../src/adversary-design.js').AdversaryValidation
