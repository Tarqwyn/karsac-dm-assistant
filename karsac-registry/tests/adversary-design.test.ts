import { describe, it, expect } from 'vitest'
import {
  detectRequestedBase,
  extractProposalConstraints,
  loadBaseFile,
  loadContextAdversaries,
  repairFactionMetadata,
} from '../src/adversary-design.js'
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

describe('extractProposalConstraints', () => {
  it('treats negated faction lists as forbidden, not required', () => {
    const result = extractProposalConstraints(
      'They are part of the Shadow Walkers faction, not Mathr, Yngondi or Vishara.',
      'spy',
    )

    expect(result.lockedFaction).toBe('shadow-walkers')
    expect(result.forbiddenFactions).toEqual(['mathr', 'yngondi', 'vishara'])
  })

  it('does not treat comparison phrases as forbidden affiliations', () => {
    const result = extractProposalConstraints(
      'Make them part of the Shadow Walkers faction but not as dangerous as Mathr enforcers.',
      'spy',
    )

    expect(result.lockedFaction).toBe('shadow-walkers')
    expect(result.forbiddenFactions).toEqual([])
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
    expect(user).toContain('## Doctrine Under Pressure')
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

  it('requires only the positive faction, not factions mentioned only in a negated list', () => {
    const prompt = 'They are part of the Shadow Walkers faction, not Mathr, Yngondi or Vishara.'
    const output = `# Adversary: Veilward
## DM-Only Notes
This adversary is a Shadow Walker operative used for urban infiltration.
## Corpus Frontmatter
related:
  factions: [shadow-walkers]
`
    const result = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT, prompt)

    expect(result.violations.some(v => v.includes('Mathr'))).toBe(false)
    expect(result.violations.some(v => v.includes('Vishara'))).toBe(false)
    expect(result.valid).toBe(true)
  })

  it('flags forbidden active affiliations from negated prompt factions', () => {
    const prompt = 'They are part of the Shadow Walkers faction, not Mathr, Yngondi or Vishara.'
    const output = `# Adversary: Veilward
## DM-Only Notes
This adversary serves Mathr while posing as a Shadow Walker operative.
## Corpus Frontmatter
related:
  factions: [shadow-walkers, mathr]
`
    const result = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT, prompt)

    expect(result.valid).toBe(false)
    expect(result.violations.some(v => v.includes('Forbidden faction affiliation: "mathr"'))).toBe(true)
  })

  it('does not treat must-not-know references as forbidden affiliation', () => {
    const prompt = 'They are part of the Shadow Walkers faction, not Mathr, Yngondi or Vishara.'
    const output = `# Adversary: Veilward
## DM-Only Notes
They must not know the true nature of the bone disc symbol or its connection to Vishara.
This adversary is a Shadow Walker operative used for urban infiltration.
## Corpus Frontmatter
related:
  factions: [shadow-walkers]
must_not_know:
  - connection to Vishara
`
    const result = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT, prompt)

    expect(result.violations.some(v => v.includes('Forbidden faction affiliation: "vishara"'))).toBe(false)
  })

  it('does not treat negated non-affiliation phrasing as forbidden faction affiliation', () => {
    const prompt = 'They are part of the Shadow Walkers faction, not Mathr, Yngondi or Vishara.'
    const output = `# Adversary: Greycloak
## DM-Only Notes
Greycloaks are independent operatives, not directly controlled by Mathr or Vishara.
This adversary is a Shadow Walker operative used for urban infiltration.
## Corpus Frontmatter
related:
  factions: [shadow-walkers]
`
    const result = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT, prompt)

    expect(result.violations.some(v => v.includes('Forbidden faction affiliation: "mathr"'))).toBe(false)
    expect(result.violations.some(v => v.includes('Forbidden faction affiliation: "vishara"'))).toBe(false)
  })

  it('flags active Yngondi affiliation phrasing from forbidden prompt factions', () => {
    const prompt = 'They are part of the Shadow Walkers faction, not Mathr, Yngondi or Vishara.'
    const output = `# Adversary: Greycloak
## DM-Only Notes
They are potentially aligned with broader Yngondi interests, likely tied to a Yngondi directive, and protecting a Yngondi asset.
This adversary is a Shadow Walker operative used for urban infiltration.
## Corpus Frontmatter
related:
  factions: [shadow-walkers]
`
    const result = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT, prompt)

    expect(result.valid).toBe(false)
    expect(result.violations.some(v => v.includes('Forbidden faction affiliation: "yngondi"'))).toBe(true)
  })

  it('allows knowledge-boundary and under-the-radar mentions for forbidden factions', () => {
    const prompt = 'They are part of the Shadow Walkers faction, not Mathr, Yngondi or Vishara.'
    const output = `# Adversary: Greycloak
## DM-Only Notes
Greycloaks are independent operatives, not directly controlled by Mathr or Vishara.
They are operating under the radar of Yngondi and are unaware of Vishara's true connection.
This adversary is a Shadow Walker operative used for urban infiltration.
## Corpus Frontmatter
related:
  factions: [shadow-walkers]
`
    const result = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT, prompt)

    expect(result.violations.some(v => v.includes('Forbidden faction affiliation: "mathr"'))).toBe(false)
    expect(result.violations.some(v => v.includes('Forbidden faction affiliation: "vishara"'))).toBe(false)
    expect(result.violations.some(v => v.includes('Forbidden faction affiliation: "yngondi"'))).toBe(false)
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

  it('flags expertise claimed as kept when expertise is not explicit in the stat block', () => {
    const output = `# Adversary: Veilward
## Adaptation Summary
- Kept from base: Expertise in Deception
## Stat Block
**Skills** Deception +6, Insight +4
`
    const result = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT)

    expect(result.valid).toBe(false)
    expect(result.violations.some(v => v.includes('Expertise is not explicitly represented'))).toBe(true)
  })

  it('flags tool proficiencies claimed as kept when no Tool Proficiencies line exists', () => {
    const output = `# Adversary: Veilward
## Adaptation Summary
- Kept from base: Disguise Kit proficiency, Poisoner's Kit proficiency
## Stat Block
**Skills** Deception +6, Insight +4
`
    const result = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT)

    expect(result.valid).toBe(false)
    expect(result.violations.some(v => v.includes('no Tool Proficiencies line'))).toBe(true)
  })

  it('detects mismatched hit point averages in the main Hit Points line', () => {
    const output = `# Adversary: Veilward
## Stat Block
**Hit Points** 45 (6d8 + 12)
`
    const result = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT)

    expect(result.valid).toBe(false)
    expect(result.violations.some(v => v.includes('Hit point formula'))).toBe(true)
  })

  it('flags forbidden faction names in the Languages line', () => {
    const prompt = 'They are part of the Shadow Walkers faction, not Mathr, Yngondi or Vishara.'
    const output = `# Adversary: Veilward
## DM-Only Notes
This adversary is a Shadow Walker operative.
## Stat Block
**Languages** Common, Yngondi
## Corpus Frontmatter
related:
  factions: [shadow-walkers]
`
    const result = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT, prompt)

    expect(result.valid).toBe(false)
    expect(result.violations.some(v => v.includes('Forbidden faction ambiguity'))).toBe(true)
  })

  it('flags modular options that are names only without concrete mechanics', () => {
    const output = `# Adversary: Veilward
## Variant Options
Choose 2 traits, 1 signature action, and 1 reaction.

### Traits
- Local Knowledge
- Silver Tongue

### Signature Actions
- False Lead

### Reactions
- Evasive Manoeuvre
`
    const result = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT)

    expect(result.valid).toBe(false)
    expect(result.violations.some(v => v.includes('Variant options must be concrete mechanics'))).toBe(true)
  })

  it('fails when doctrine-expressive mechanics are named but absent from the stat block', () => {
    const output = `# Adversary: Weaver
## Doctrine-Expressive Mechanics
- Mapped Exits expresses pre-planned movement.
- Crowd Break expresses extraction through urban cover.
- Information First expresses message preservation.
- No Last Stand expresses mission-first surrender logic.

## Stat Block
### Traits
**Urban Camouflage.** The weaver has advantage on Dexterity (Stealth) checks made in a settled environment.
`
    const result = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT)

    expect(result.valid).toBe(false)
    expect(result.violations.some(v => v.includes('Doctrine-expressive mechanic "Mapped Exits"'))).toBe(true)
    expect(result.violations.some(v => v.includes('Doctrine-expressive mechanic "Crowd Break"'))).toBe(true)
    expect(result.violations.some(v => v.includes('Doctrine-expressive mechanic "Information First"'))).toBe(true)
    expect(result.violations.some(v => v.includes('Doctrine-expressive mechanic "No Last Stand"'))).toBe(true)
  })

  it('flags Charisma (Insight) as an invalid 5e skill pairing', () => {
    const output = `# Adversary: Weaver
## Actions
**Whispered Rumor.** One creature must succeed on a DC 14 Charisma (Insight) check or accept the planted story.
`
    const result = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT)

    expect(result.valid).toBe(false)
    expect(result.violations.some(v => v.includes('Wisdom (Insight), not Charisma (Insight)'))).toBe(true)
  })

  it('hard-fails non-standard 5e check pairings such as Charisma (Reputation)', () => {
    const output = `# Adversary: Weaver
## Actions
**Social Standing.** One creature must succeed on a DC 13 Charisma (Reputation) check or accept the cover story.
`
    const result = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT)

    expect(result.valid).toBe(false)
    expect(result.violations.some(v => v.includes('non-standard skill "Reputation"'))).toBe(true)
  })

  it('flags doubled article strings in final adversary text', () => {
    const output = `# Adversary: The Weaver
## Stat Block
### Traits
**Mapped Exits.** If the The Weaver has spent at least 10 minutes in a settlement location before combat begins, it has advantage on initiative.
`
    const result = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT)

    expect(result.valid).toBe(false)
    expect(result.violations.some(v => v.includes('Doubled article string'))).toBe(true)
  })

  it('flags disguise kit actions and mundane social charm effects', () => {
    const output = `# Adversary: Weaver
## Stat Block
### Actions
**Disguise Kit.** The Weaver can use a Disguise Kit to alter their appearance.
**Persuasion.** Social Action. The target must succeed on a DC 13 Wisdom (Insight) check or be charmed for 1 minute.
`
    const result = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT)

    expect(result.valid).toBe(false)
    expect(result.violations.some(v => v.includes('Disguise Kit appears under Actions'))).toBe(true)
    expect(result.violations.some(v => v.includes('Mundane social action applies the charmed condition'))).toBe(true)
  })

  it('flags overly broad Quick Step area-effect wording', () => {
    const output = `# Adversary: Weaver
## Reactions
**Quick Step.** The weaver can move out of an area-of-effect spell or attack before it lands.
`
    const result = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT)

    expect(result.valid).toBe(false)
    expect(result.violations.some(v => v.includes('Quick Step is too broad/vague'))).toBe(true)
  })

  it('flags vague Counter-Observation wording', () => {
    const output = `# Adversary: Weaver
## Reactions
**Counter-Observation.** The weaver is hard to pin down and can interfere with scrutiny.
`
    const result = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT)

    expect(result.valid).toBe(false)
    expect(result.violations.some(v => v.includes('Counter-Observation is too vague'))).toBe(true)
  })

  it('flags over-broad citywide blackout DM-only consequence', () => {
    const output = `# Adversary: Weaver
## DM-Only Notes
If cornered, the weaver can trigger a citywide blackout to cover its escape.
`
    const result = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT)

    expect(result.valid).toBe(false)
    expect(result.violations.some(v => v.includes('citywide blackout'))).toBe(true)
  })

  it('flags loose Quick Concealment wording', () => {
    const output = `# Adversary: Weaver
## Variant Options
### Reactions
- **Quick Concealment.** When the adversary takes damage, they can use their reaction to attempt to hide as quickly as possible.
`
    const result = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT)

    expect(result.valid).toBe(false)
    expect(result.violations.some(v => v.includes('Quick Concealment is too loose'))).toBe(true)
  })

  it('warns when doctrine exists but doctrine under pressure is missing', () => {
    const output = `# Adversary: Veilward
## Doctrine
They retreat when exposed and preserve secrecy over victory.

## Stat Block
**Armour Class** 12
**Hit Points** 27
### Actions
**Shortsword.** Melee Weapon Attack: +4 to hit, Hit: 5 (1d6 + 2) piercing damage.
`
    const result = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT)

    expect(result.valid).toBe(true)
    expect(result.violations).toContain('WARN: Adversary has Doctrine but lacks "## Doctrine Under Pressure" section.')
  })

  it('fails for faction adversary that has doctrine but lacks doctrine under pressure', () => {
    const prompt = 'They are part of the Shadow Walkers faction, not Mathr.'
    const output = `# Adversary: Veilward
## Doctrine
They retreat when exposed and preserve secrecy over victory.

## DM-Only Notes
This adversary is a Shadow Walker operative.

## Corpus Frontmatter
related:
  factions: [shadow-walkers]
`
    const result = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT, prompt)

    expect(result.valid).toBe(false)
    expect(result.violations).toContain('Faction adversary missing required "## Doctrine Under Pressure" section.')
  })

  it('warns when retreat doctrine is not backed by enough mechanical support', () => {
    const output = `# Adversary: Veilward
## Doctrine
They retreat when exposed, preserve secrecy, and avoid direct combat.

## Doctrine Under Pressure
- Round one if attacked: fall back and protect the message.
- Avoid being pinned down by: staying near exits.
- Prioritises preserving: the message.
- Retreats when: identified.
- If escape is impossible: surrender after hiding the evidence.
- Will not do: fight to the death.

## Stat Block
**Armour Class** 12
**Hit Points** 27
### Actions
**Shortsword.** Melee Weapon Attack: +4 to hit, Hit: 5 (1d6 + 2) piercing damage.
`
    const result = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT)

    expect(result.valid).toBe(true)
    expect(result.violations).toContain(
      'WARN: Doctrine not mechanically supported under pressure: adversary claims to escape/misdirect when exposed but lacks reliable mechanics against a combat-optimised party.',
    )
  })

  it('does not warn when retreat doctrine has multiple supporting mechanics', () => {
    const output = `# Adversary: Veilward
## Doctrine
They retreat when exposed, preserve secrecy, and avoid direct combat.

## Doctrine Under Pressure
- Round one if attacked: fall back through the crowd and preserve the coded tally.
- Avoid being pinned down by: Urban Camouflage and a retreat reaction.
- Prioritises preserving: the coded tally and the cover identity.
- Retreats when: identified or cut off from the crowd.
- If escape is impossible: destroy the tally and surrender.
- Will not do: die for appearances.

## Doctrine-Expressive Mechanics
- Mapped Exits expresses pre-planned movement.
- Crowd Break expresses extraction through urban cover.

## Stat Block
**Armour Class** 12
**Hit Points** 27
### Traits
**Mapped Exits.** If the veilward has spent at least 10 minutes in a settlement location before combat begins, it has advantage on initiative. On the first round of combat, it can move up to half its speed without provoking opportunity attacks.
### Reactions
**Crowd Break.** When the veilward is hit or missed by an attack while at least two non-hostile creatures or significant cover are within 30 feet, it can use its reaction to move up to half its speed without provoking opportunity attacks.
`
    const result = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT)

    expect(result.violations.some(v => v.includes('Doctrine not mechanically supported'))).toBe(false)
  })

  it('warns when the only support is a missed-attack reaction', () => {
    const output = `# Adversary: Weaver
## Doctrine
They retreat when exposed, preserve cover, and refuse to fight to the death.

## Doctrine Under Pressure
- Round one if attacked: seek an escape lane.
- Avoid being pinned down by: slipping away if pressure breaks.
- Prioritises preserving: cover identity and the carried message.
- Retreats when: identified publicly.
- If escape is impossible: surrender under a false name.
- Will not do: die for appearances.

## Stat Block
### Reactions
**Evasive Manoeuvre.** When a creature misses the weaver with an attack, the weaver can move up to half its speed without provoking opportunity attacks.
`
    const result = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT)

    expect(result.valid).toBe(true)
    expect(result.violations.some(v => v.includes('Doctrine not mechanically supported under pressure'))).toBe(true)
  })

  it('does not count optional variant mechanics as satisfying core doctrine support', () => {
    const output = `# Adversary: Weaver
## Doctrine
They retreat when exposed, preserve cover, and refuse direct combat.

## Doctrine Under Pressure
- Round one if attacked: fall back through the crowd.
- Avoid being pinned down by: movement and misdirection.
- Prioritises preserving: cover identity and carried message.
- Retreats when: identified publicly.
- If escape is impossible: surrender under a false name.
- Will not do: fight to the death.

## Stat Block
### Traits
**Local Knowledge.** The weaver has advantage on Intelligence checks related to local customs and routes.
### Reactions
None

## Variant Options
Choose 2 traits and 1 reaction.

### Traits
- **Mapped Exits.** If the weaver has spent at least 10 minutes in a settlement location before combat begins, it has advantage on initiative. On the first round of combat, it can move up to half its speed without provoking opportunity attacks.

### Reactions
- **Crowd Break.** When the weaver is hit or missed by an attack while at least two non-hostile creatures or significant cover are within 30 feet, it can use its reaction to move up to half its speed without provoking opportunity attacks.
`
    const result = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT)

    expect(result.valid).toBe(true)
    expect(result.violations.some(v => v.includes('Doctrine not mechanically supported under pressure'))).toBe(true)
  })

  it('does not warn when there are two supports and one works on hit or pressure', () => {
    const output = `# Adversary: Weaver
## Doctrine
They retreat when exposed, preserve cover, and refuse to fight to the death.

## Doctrine Under Pressure
- Round one if attacked: move through the crowd and protect the message.
- Avoid being pinned down by: mapped exits and crowd break.
- Prioritises preserving: the message and its cover identity.
- Retreats when: identified publicly or reduced below half hit points.
- If escape is impossible: conceal the cipher strip and surrender under a false name.
- Will not do: fight to the death.

## Stat Block
### Traits
**Mapped Exits.** If the weaver has spent at least 10 minutes in a settlement location before combat begins, it has advantage on initiative. On the first round of combat, it can move up to half its speed without provoking opportunity attacks.
### Reactions
**Crowd Break.** When the weaver is hit or missed by an attack while at least two non-hostile creatures or significant cover are within 30 feet, it can use its reaction to move up to half its speed without provoking opportunity attacks.
`
    const result = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT)

    expect(result.violations.some(v => v.includes('Doctrine not mechanically supported under pressure'))).toBe(false)
  })

  it('fails Shadow Walker faction validation when Undercommon appears in Languages', () => {
    const prompt = 'They are part of the Shadow Walkers faction, not Mathr, Yngondi or Vishara.'
    const output = `# Adversary: Veilward
## Doctrine
Secrecy, restraint, and information preservation matter more than pride.

## Doctrine Under Pressure
They withdraw when exposed and preserve the message first.

## Tactical Notes
They avoid direct combat, preserve cover identity, and use controlled withdrawal.

## DM-Only Notes
This adversary is a Shadow Walker operative.

## Stat Block
*Medium humanoid, neutral*
**Languages** Common, Undercommon
## Corpus Frontmatter
related:
  factions: [shadow-walkers]
`
    const result = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT, prompt)

    expect(result.valid).toBe(false)
    expect(result.violations.some(v => v.includes('should not use "Undercommon"'))).toBe(true)
  })

  it('fails Shadow Walker faction validation on Neutral Evil alignment', () => {
    const prompt = 'They are part of the Shadow Walkers faction.'
    const output = `# Adversary: Veilward
## Doctrine
Mission-first behaviour and controlled withdrawal come before pride.

## Doctrine Under Pressure
They withdraw if exposed and preserve the message.

## Tactical Notes
They use restraint and secrecy rather than public bloodshed.

## DM-Only Notes
This adversary is a Shadow Walker operative.

## Stat Block
*Medium humanoid, neutral evil*
**Languages** Common, Shadow Walker Sign
## Corpus Frontmatter
related:
  factions: [shadow-walkers]
`
    const result = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT, prompt)

    expect(result.valid).toBe(false)
    expect(result.violations.some(v => v.includes('alignment mismatch'))).toBe(true)
  })

  it('fails Shadow Walker faction validation on spellcasting without override', () => {
    const prompt = 'They are part of the Shadow Walkers faction.'
    const output = `# Adversary: Veilward
## Doctrine
Mission-first behaviour and secrecy come before public heroics.

## Doctrine Under Pressure
They preserve information and withdraw when exposed.

## Tactical Notes
They use restraint and controlled withdrawal.

## DM-Only Notes
This adversary is a Shadow Walker operative.

## Stat Block
*Medium humanoid, neutral*
**Languages** Common, Shadow Walker Sign
### Actions
**Minor Illusion.** The adversary casts the minor illusion cantrip.
## Corpus Frontmatter
related:
  factions: [shadow-walkers]
`
    const result = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT, prompt)

    expect(result.valid).toBe(false)
    expect(result.violations.some(v => v.includes('spellcasting mismatch'))).toBe(true)
  })

  it('fails Shadow Walker faction validation when the type line leaks Yngondi', () => {
    const prompt = 'They are part of the Shadow Walkers faction, not Mathr, Yngondi or Vishara.'
    const output = `# Adversary: Veilward
## Doctrine
Mission-first behaviour and secrecy come before public heroics.

## Doctrine Under Pressure
They preserve information and withdraw when exposed.

## Tactical Notes
They use restraint and controlled withdrawal.

## DM-Only Notes
This adversary is a Shadow Walker operative.

## Stat Block
*Medium humanoid (Yngondi), neutral*
**Languages** Common, Shadow Walker Sign
## Corpus Frontmatter
related:
  factions: [shadow-walkers]
`
    const result = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT, prompt)

    expect(result.valid).toBe(false)
    expect(result.violations.some(v => v.includes('creature-type mismatch'))).toBe(true)
  })

  it('fails when a Shadow Walker cover identity carries a shortbow without override', () => {
    const prompt = 'They are part of the Shadow Walkers faction.'
    const output = `# Adversary: Veilward
## Doctrine
Secrecy and cover identity matter more than direct combat.

## Doctrine Under Pressure
They break contact, preserve the tally, and withdraw through the crowd.

## Tactical Notes
They use an unremarkable civilian identity and avoid public escalation.

## DM-Only Notes
This adversary is a Shadow Walker operative.

## Stat Block
*Medium humanoid, neutral*
**Languages** Common, Shadow Walker Sign, one local trade tongue
### Actions
**Shortbow.** Ranged Weapon Attack: +4 to hit, range 80/320 ft., one target. Hit: 5 (1d6 + 2) piercing damage.
## Corpus Frontmatter
related:
  factions: [shadow-walkers]
`
    const result = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT, prompt)

    expect(result.valid).toBe(false)
    expect(result.violations.some(v => v.includes('cover-identity mismatch'))).toBe(true)
  })

  it('allows an obvious weapon to remain when frontmatter override provides a reason', () => {
    const prompt = 'They are part of the Shadow Walkers faction.'
    const output = `# Adversary: Veilward
## Doctrine
Secrecy and cover identity matter more than direct combat.

## Doctrine Under Pressure
They break contact, preserve the tally, and withdraw through the crowd.

## Tactical Notes
They use an unremarkable civilian identity and avoid public escalation.

## DM-Only Notes
This adversary is a Shadow Walker operative.

## Stat Block
*Medium humanoid, neutral*
**Languages** Common, Shadow Walker Sign, one local trade tongue
### Actions
**Shortbow.** Ranged Weapon Attack: +4 to hit, range 80/320 ft., one target. Hit: 5 (1d6 + 2) piercing damage.

## Corpus Frontmatter
faction_profile_overrides:
  allow_obvious_weapon: true
  reason: This operative is posing as a caravan guard rather than a civilian infiltrator.
related:
  factions: [shadow-walkers]
`
    const result = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT, prompt)

    expect(result.valid).toBe(true)
    expect(result.violations.some(v => v.includes('override allows obvious weapon'))).toBe(true)
  })

  it('warns when observer doctrine drops Wisdom below the Shadow Walker floor', () => {
    const prompt = 'They are part of the Shadow Walkers faction.'
    const output = `# Adversary: Veilward
## Doctrine
Observation, reading people, and mapping social patterns matter more than force.

## Doctrine Under Pressure
They preserve cover identity and withdraw when exposed.

## Tactical Notes
They read the room, assess motives, and preserve secrecy first.

## DM-Only Notes
This adversary is a Shadow Walker operative.

## Stat Block
*Medium humanoid, neutral*
| STR | DEX | CON | INT | WIS | CHA |
|---:|---:|---:|---:|---:|---:|
| 10 (+0) | 14 (+2) | 12 (+1) | 13 (+1) | 10 (+0) | 14 (+2) |
**Languages** Common, Shadow Walker Sign
## Corpus Frontmatter
related:
  factions: [shadow-walkers]
`
    const result = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT, prompt)

    expect(result.valid).toBe(true)
    expect(result.violations.some(v => v.includes('observer floor'))).toBe(true)
  })

  it('passes Shadow Walker faction validation with neutral alignment, canonical languages, and no magic', () => {
    const prompt = 'They are part of the Shadow Walkers faction, not Mathr, Yngondi or Vishara.'
    const output = `# Adversary: Veilward
## Doctrine
Secrecy, restraint, mission-first behaviour, controlled withdrawal, and information preservation define this operative.

## Doctrine Under Pressure
When exposed, the operative breaks contact, preserves the message, and withdraws through prepared exits rather than die in place.

## Behavioural Stages
Stage One - Observe quietly and preserve cover identity.
Stage Two - If blocked, use misdirection and controlled withdrawal.
Stage Three - If cornered, protect the tally and escape if possible.

## Tactical Notes
They avoid direct combat, preserve cover identity, and use controlled withdrawal while keeping information out of enemy hands.

## DM-Only Notes
This adversary is a Shadow Walker operative who preserves secrecy and information before pride.

## Stat Block
*Medium humanoid, neutral*
| STR | DEX | CON | INT | WIS | CHA |
|---:|---:|---:|---:|---:|---:|
| 10 (+0) | 14 (+2) | 12 (+1) | 13 (+1) | 12 (+1) | 14 (+2) |
**Languages** Common, Shadow Walker Sign, one local trade tongue
### Traits
**Mapped Exits.** If the operative has spent at least 10 minutes in a settlement location before combat begins, it has advantage on initiative.
**No Last Stand.** If exposed, it withdraws rather than die for appearances.
**Information First.** When pressed, it protects the tally before pride.
### Reactions
**Crowd Break.** When hit or missed by an attack near a crowd, it can move up to half its speed without provoking opportunity attacks.
## Corpus Frontmatter
related:
  factions: [shadow-walkers]
`
    const result = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT, prompt)

    expect(result.violations.some(v => v.includes('Faction profile'))).toBe(false)
  })

  it('warns when Shadow Walker doctrine lacks restraint-as-discipline wording', () => {
    const prompt = 'They are part of the Shadow Walkers faction.'
    const output = `# Adversary: Veilward
## Doctrine
Secrecy and information preservation matter more than public glory.

## Doctrine Under Pressure
They break contact and preserve the tally before retreating.

## Tactical Notes
They avoid direct combat and preserve cover identity.

## DM-Only Notes
This adversary is a Shadow Walker operative.

## Stat Block
*Medium humanoid, neutral*
**Languages** Common, Shadow Walker Sign
## Corpus Frontmatter
related:
  factions: [shadow-walkers]
`
    const result = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT, prompt)

    expect(result.valid).toBe(true)
    expect(result.violations.some(v => v.includes('restraint-as-discipline theme'))).toBe(true)
  })

  it('warns for weak and vague variant mechanics', () => {
    const output = `# Adversary: Weaver
## Variant Options
Choose 2 traits and 1 reaction.

### Traits
- **Silver Tongue.** +2 to Persuasion checks.
- **Quick Study.** Learns a new skill proficiency after an hour.
- **Information Broker.** Can often acquire information.
`
    const result = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT)

    expect(result.valid).toBe(true)
    expect(result.violations.some(v => v.includes('flat bonus'))).toBe(true)
    expect(result.violations.some(v => v.includes('long-horizon proficiency'))).toBe(true)
    expect(result.violations.some(v => v.includes('descriptive rather than runnable'))).toBe(true)
  })

  it('warns when a trait is descriptive rather than runnable', () => {
    const output = `# Adversary: Weaver
## Stat Block
### Traits
**Ordinary Face.** Most people ignore the weaver in a crowd.
`
    const result = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT)

    expect(result.valid).toBe(true)
    expect(result.violations.some(v => v.includes('Trait is descriptive rather than runnable'))).toBe(true)
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

  it('injects named doctrine-expressive mechanics into the core stat block', () => {
    const output = `# Adversary: Weaver
## Doctrine
They retreat when exposed, preserve secrecy, and refuse to fight to the death.

## Doctrine Under Pressure
- Round one if attacked: escape through a prepared route.
- Avoid being pinned down by: movement through crowds and cover.
- Prioritises preserving: the carried message and cover identity.
- Retreats when: publicly identified.
- If escape is impossible: surrender under a false name.
- Will not do: die for appearances.

## Doctrine-Expressive Mechanics
- Mapped Exits expresses pre-planned movement.
- No Last Stand expresses surrender and escape logic.
- Crowd Break expresses extraction through urban cover.
- Information First expresses message preservation.

## Stat Block
### Traits
**Urban Camouflage.** The weaver has advantage on Dexterity (Stealth) checks made in a settled environment.
**Local Knowledge.** The weaver has advantage on Intelligence checks related to local customs and routes.

### Bonus Actions
None

### Reactions
None
`
    const validation = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT)
    const repaired = repairAdversaryOutput(output, validation, SPY_BASE_CONTENT)
    const revalidation = validateAdversaryOutput(repaired, 'spy', SPY_BASE_CONTENT)

    expect(repaired).toContain('**Mapped Exits.**')
    expect(repaired).toContain('**No Last Stand.**')
    expect(repaired).toContain('**Information First.**')
    expect(repaired).toContain('**Crowd Break.**')
    expect(repaired).not.toContain('### Reactions\nNone')
    expect(revalidation.violations.some(v => v.includes('Doctrine-expressive mechanic "Mapped Exits"'))).toBe(false)
    expect(revalidation.violations.some(v => v.includes('Doctrine-expressive mechanic "No Last Stand"'))).toBe(false)
    expect(revalidation.violations.some(v => v.includes('Doctrine-expressive mechanic "Information First"'))).toBe(false)
    expect(revalidation.violations.some(v => v.includes('Doctrine-expressive mechanic "Crowd Break"'))).toBe(false)
    expect(revalidation.violations.some(v => v.includes('Doctrine not mechanically supported under pressure'))).toBe(false)
  })

  it('normalises final hit points and plain leather armour AC during repair', () => {
    const output = `# Adversary: Weaver
## Stat Block
**Armour Class** 14 (Leather Armor)
**Hit Points** 45 (6d8 + 12)

| STR | DEX | CON | INT | WIS | CHA |
|-----|-----|-----|-----|-----|-----|
| 10 (+0) | 14 (+2) | 14 (+2) | 13 (+1) | 12 (+1) | 14 (+2) |
`
    const validation = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT)
    const repaired = repairAdversaryOutput(output, validation, SPY_BASE_CONTENT)

    expect(validation.violations.some(v => v.includes('Hit point formula'))).toBe(true)
    expect(validation.violations.some(v => v.includes('Armour Class formula'))).toBe(true)
    expect(repaired).toContain('**Hit Points** 39 (6d8 + 12)')
    expect(repaired).toContain('**Armour Class** 13 (Leather Armor)')
  })

  it('cleans article duplication, device language, disguise actions, social charm, and quick concealment during repair', () => {
    const output = `# Adversary: The Weaver
## Stat Block
**Armour Class** 14 (Leather Armor)
**Hit Points** 45 (6d8 + 12)

| STR | DEX | CON | INT | WIS | CHA |
|-----|-----|-----|-----|-----|-----|
| 10 (+0) | 14 (+2) | 14 (+2) | 13 (+1) | 12 (+1) | 14 (+2) |

### Traits
**Mapped Exits.** If the The Weaver has spent at least 10 minutes in a settlement location before combat begins, it has advantage on initiative.

### Actions
**Disguise Kit.** The Weaver can use a Disguise Kit to alter their appearance.
**Persuasion.** Social Action. The target must succeed on a DC 13 Wisdom (Insight) check or be charmed for 1 minute.

### Reactions
**Crowd Break.** When the The Weaver is hit or missed by an attack while at least two non-hostile creatures or significant cover are within 30 feet, it can move up to half its speed without provoking opportunity attacks.

## Variant Options
### Reactions
- **Quick Concealment.** When the adversary takes damage, they can use their reaction to attempt to hide as quickly as possible.

## DM-Only Notes
The Weaver carries a coded communication device (disguised as a trinket) that transmits encrypted messages.
`
    const validation = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT)
    const repaired = repairAdversaryOutput(output, validation, SPY_BASE_CONTENT)

    expect(repaired).not.toContain('the The')
    expect(repaired).not.toContain('communication device')
    expect(repaired).not.toContain('transmits encrypted')
    expect(repaired).not.toContain('**Disguise Kit.**')
    expect(repaired).toContain('**Tool Proficiencies** disguise kit, forgery kit')
    expect(repaired).toContain('**Prepared Cover.**')
    expect(repaired).toContain('**Social Pressure.**')
    expect(repaired).not.toContain('be charmed for 1 minute')
    expect(repaired).toContain('**Quick Concealment.** When The Weaver takes damage while within 10 feet of cover, a crowd, or a prepared hiding place')
    expect(repaired).toContain('coded trinket and waxed cipher strip')
  })

  it('adds Shadow Walker affiliation, normalizes invalid languages, and clears those faction-profile violations after repair', () => {
    const prompt = 'They are part of the Shadow Walkers faction, not Mathr, Yngondi or Vishara.'
    const constraints = extractProposalConstraints(prompt, 'spy')
    const output = `# Adversary: Veilward
## Doctrine
Secrecy and restraint come before pride.

## Tactical Notes
They preserve cover identity inside ordinary settlement life.

## DM-Only Notes
They preserve information before retreating.

## Stat Block
*Medium humanoid, neutral*
**Languages** Common, Undercommon

## Corpus Frontmatter
related:
  factions: [shadow-walkers]
`
    const validation = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT, prompt, constraints)
    const repaired = repairAdversaryOutput(output, validation, SPY_BASE_CONTENT, constraints)
    const revalidation = validateAdversaryOutput(repaired, 'spy', SPY_BASE_CONTENT, prompt, constraints)

    expect(repaired).toContain('Shadow Walker operative')
    expect(repaired).toContain('**Languages** Common, Trade Tongue (local), Shadow Walker Sign')
    expect(revalidation.violations.some(v => v.includes('Faction profile language mismatch'))).toBe(false)
    expect(revalidation.violations.some(v => v.includes('Faction not in DM-Only Notes'))).toBe(false)
  })

  it('replaces shortbow with a concealable ranged weapon for cover-identity Shadow Walkers', () => {
    const prompt = 'They are part of the Shadow Walkers faction.'
    const constraints = extractProposalConstraints(prompt, 'spy')
    const output = `# Adversary: Veilward
## Doctrine
Secrecy and cover identity matter more than direct combat.

## Doctrine Under Pressure
They break contact and preserve the tally first.

## Tactical Notes
They maintain an unremarkable civilian identity in the settlement.

## DM-Only Notes
This adversary is a Shadow Walker operative.

## Stat Block
*Medium humanoid, neutral*
**Languages** Common, Shadow Walker Sign, one local trade tongue
### Actions
**Shortbow.** Ranged Weapon Attack: +4 to hit, range 80/320 ft., one target. Hit: 5 (1d6 + 2) piercing damage.

## Corpus Frontmatter
related:
  factions: [shadow-walkers]
`
    const validation = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT, prompt, constraints)
    const repaired = repairAdversaryOutput(output, validation, SPY_BASE_CONTENT, constraints)
    const revalidation = validateAdversaryOutput(repaired, 'spy', SPY_BASE_CONTENT, prompt, constraints)

    expect(repaired).not.toContain('**Shortbow.**')
    expect(repaired).toContain('**Throwing Spike.**')
    expect(repaired).toContain('Ranged Weapon Attack: +4 to hit, range 20/60 ft., one target. Hit: 4 (1d4 + 2) piercing damage.')
    expect(repaired).toContain('DC 13 Constitution saving throw')
    expect(revalidation.violations.some(v => v.includes('cover-identity mismatch'))).toBe(false)
  })

  it('repairs Shadow Walker subtype and prohibited spellcasting before revalidation', () => {
    const prompt = 'Propose a new adversary: a Shadow Walker urban variant designed to blend into normal Karsac cities and towns. Use Spy as the preferred mechanical base. They are part of the Shadow Walkers faction, not Mathr, Yngondi or Vishara.'
    const constraints = extractProposalConstraints(prompt, 'spy')
    const output = `# Adversary: Veilstrider
## Doctrine
Secrecy and mission-first behaviour matter more than pride.

## Doctrine Under Pressure
Break contact, preserve the message, and withdraw through the crowd when exposed.

## Tactical Notes
They maintain a cover identity and avoid direct combat.

## DM-Only Notes
This adversary is a Shadow Walker operative.

## Stat Block
*Medium humanoid (Yngondi), neutral evil*
**Languages** Common, Undercommon
| STR | DEX | CON | INT | WIS | CHA |
|---:|---:|---:|---:|---:|---:|
| 10 (+0) | 14 (+2) | 14 (+2) | 13 (+1) | 12 (+1) | 14 (+2) |
**Challenge** 3 (700 XP) · **Proficiency Bonus** +2
### Actions
**Minor Illusion.** The adversary casts the minor illusion cantrip.
**Shortbow.** Ranged Weapon Attack: +4 to hit, range 80/320 ft., one target. Hit: 5 (1d6 + 2) piercing damage.

## Corpus Frontmatter
related:
  factions: [shadow-walkers]
`
    const validation = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT, prompt, constraints)
    const repaired = repairAdversaryOutput(output, validation, SPY_BASE_CONTENT, constraints)
    const revalidation = validateAdversaryOutput(repaired, 'spy', SPY_BASE_CONTENT, prompt, constraints)

    expect(repaired).not.toContain('Humanoid (Yngondi)')
    expect(repaired).toContain('*Medium humanoid, neutral*')
    expect(repaired).not.toContain('Minor Illusion')
    expect(repaired).toContain('**False Surface.**')
    expect(repaired).not.toContain('Shortbow')
    expect(repaired).toContain('Throwing Spike')
    expect(revalidation.violations.some(v => v.includes('creature-type mismatch'))).toBe(false)
    expect(revalidation.violations.some(v => v.includes('spellcasting mismatch'))).toBe(false)
    expect(revalidation.violations.some(v => v.includes('cover-identity mismatch'))).toBe(false)
    expect(revalidation.valid).toBe(true)
  })

  it('replaces colon-style inherited shortbow entries during Shadow Walker cover-identity repair', () => {
    const prompt = 'Propose a new adversary: a Shadow Walker urban variant designed to blend into normal Karsac cities and towns. Use Spy as the preferred mechanical base. They are part of the Shadow Walkers faction, not Mathr, Yngondi or Vishara.'
    const constraints = extractProposalConstraints(prompt, 'spy')
    const output = `# Adversary: Veilstrider
## Doctrine
Secrecy and cover identity matter more than direct combat.

## Doctrine Under Pressure
They break contact, preserve the tally, and withdraw through the crowd.

## Tactical Notes
They use an unremarkable civilian identity and avoid public escalation.

## DM-Only Notes
This adversary is a Shadow Walker operative.

## Stat Block
*Medium humanoid, neutral*
| STR | DEX | CON | INT | WIS | CHA |
|---:|---:|---:|---:|---:|---:|
| 10 (+0) | 14 (+2) | 14 (+2) | 13 (+1) | 12 (+1) | 14 (+2) |
**Languages** Common, Shadow Walker Sign, one local trade tongue
**Challenge** 3 (700 XP) · **Proficiency Bonus** +2
### Actions
**Shortbow:** Ranged Weapon Attack: +4 to hit, range 80/320 ft., one target. Hit: 5 (1d6 + 2) piercing damage.

## Corpus Frontmatter
related:
  factions: [shadow-walkers]
`
    const validation = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT, prompt, constraints)
    const repaired = repairAdversaryOutput(output, validation, SPY_BASE_CONTENT, constraints)

    expect(repaired).not.toContain('**Shortbow:**')
    expect(repaired).toContain('**Throwing Spike.**')
  })

  it('repairs colon-style weak variant options into concrete mechanics', () => {
    const prompt = 'They are part of the Shadow Walkers faction, not Mathr, Yngondi or Vishara.'
    const constraints = extractProposalConstraints(prompt, 'spy')
    const output = `# Adversary: The Veiled Broker
## Doctrine
Secrecy and cover identity matter more than direct combat.

## Doctrine Under Pressure
They break contact, preserve the tally, and withdraw through the crowd.

## Tactical Notes
They use an unremarkable civilian identity and avoid public escalation.

## DM-Only Notes
This adversary is a Shadow Walker operative.

## Stat Block
*Medium humanoid, neutral*
**Languages** Common, Trade Tongue (local), Shadow Walker Sign
### Traits
**Mapped Exits.** If The Veiled Broker has spent at least 10 minutes in a settlement location before combat begins, it has advantage on initiative.
**No Last Stand.** The Veiled Broker does not fight to the death.
**Information First.** When The Veiled Broker is reduced below half its hit points, captured, or forced to reveal information, it can conceal, destroy, or pass on one carried note.
### Reactions
**Crowd Break.** When The Veiled Broker is hit or missed by an attack while at least two non-hostile creatures or significant cover are within 30 feet, it can move up to half its speed without provoking opportunity attacks.

## Variant Options
Choose 2 traits from:

Silver Tongue: The adversary can re-roll one failed Charisma check per long rest.
Contacts: The adversary knows several individuals within the settlement who can provide information or assistance.
Quick Study: The adversary can learn one new skill proficiency from observing a skilled individual.
`
    const validation = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT, prompt, constraints)
    const repaired = repairAdversaryOutput(output, validation, SPY_BASE_CONTENT, constraints)
    const revalidation = validateAdversaryOutput(repaired, 'spy', SPY_BASE_CONTENT, prompt, constraints)

    expect(repaired).toContain('**Silver Tongue.** Once per scene')
    expect(repaired).toContain('**Contacts.** Once per scene in a settlement')
    expect(repaired).toContain('**Quick Study.** After observing a creature for 1 minute')
    expect(revalidation.violations.some(v => v.includes('Variant options must be concrete mechanics'))).toBe(false)
  })

  it('repairs City Shade style body frontmatter and cover-identity weapon conflicts together', () => {
    const prompt = 'Propose a new adversary: a Shadow Walker urban variant designed to blend into normal Karsac cities and towns. Use Spy as the preferred mechanical base. They are part of the Shadow Walkers faction, not Mathr, Yngondi or Vishara.'
    const constraints = extractProposalConstraints(prompt, 'spy')
    const output = `# Adversary: City Shade
## Doctrine
The City Shade operates under the Shadow Walkers' doctrine of subtle influence and calculated retreat.

## Doctrine Under Pressure
On round one of combat, the City Shade immediately activates Mapped Exits to exploit pre-established escape routes.

## Tactical Notes
They are highly adaptive, leveraging the urban environment, social dynamics, and prepared identities to remain one step ahead of their pursuers.

## DM-Only Notes
This adversary is a Shadow Walker operative.

## Stat Block
*Medium humanoid, neutral*
| STR | DEX | CON | INT | WIS | CHA |
|---:|---:|---:|---:|---:|---:|
| 10 (+0) | 14 (+2) | 14 (+2) | 13 (+1) | 12 (+1) | 16 (+3) |
**Languages** Common, Trade Tongue (local), Shadow Walker Sign
**Challenge** 3 (700 XP) · **Proficiency Bonus** +2
### Traits
**Prepared Cover.** City Shade has advantage on Charisma (Deception) checks made to maintain a prepared civilian identity or pass as an unremarkable worker, clerk, or passerby in the current settlement.
**Mapped Exits.** If City Shade has spent at least 10 minutes in a settlement location before combat begins, it has advantage on initiative.
**No Last Stand.** City Shade does not fight to the death.
**Information First.** When City Shade is reduced below half its hit points, captured, or forced to reveal information, it can conceal, destroy, or pass on one carried note.
### Actions
**Shortbow:** Ranged Weapon Attack: +4 to hit, range 80/320 ft., one target. Hit: 5 (1d6 + 2) piercing damage.
### Reactions
**Crowd Break.** When City Shade is hit or missed by an attack while at least two non-hostile creatures or significant cover are within 30 feet, it can move up to half its speed without provoking opportunity attacks.

## Variant Options
**Choose 2 traits from:**
* **Network Contact:** The adversary can, once per long rest, send a coded message to another Shadow Walker operative within a 50-mile radius.
* **Master of Disguise:** The adversary gains proficiency with the Disguise Kit and can spend 1 minute to alter their appearance to resemble a different person.
* **Keen Observer:** The adversary has advantage on Wisdom (Insight) checks.

## Corpus Frontmatter
\`\`\`yaml
---
id: adversaries/city-shade
type: adversary
visibility: dm-only
canonical: provisional
ruleset: dnd-5e-2014
tags: [adversary, social-obstacle, shadow-walker, urban, chapter-3]
\`\`\`
`
    const repairedMetadata = repairFactionMetadata(output, constraints)
    const validation = validateAdversaryOutput(repairedMetadata, 'spy', SPY_BASE_CONTENT, prompt, constraints)
    const repaired = repairAdversaryOutput(repairedMetadata, validation, SPY_BASE_CONTENT, constraints)
    const revalidation = validateAdversaryOutput(repaired, 'spy', SPY_BASE_CONTENT, prompt, constraints)

    expect(repaired).toContain('related:\n  factions: [shadow-walkers]')
    expect(repaired).not.toContain('**Shortbow:**')
    expect(repaired).toContain('**Throwing Spike.**')
    expect(repaired).toContain('**Contacts.** Once per scene in a settlement')
    expect(repaired).toContain('**Prepared Cover.** Once per scene')
    expect(repaired).toContain('**Keen Observer.** Once per scene')
    expect(revalidation.violations.some(v => v.includes('Faction missing from related.factions'))).toBe(false)
    expect(revalidation.violations.some(v => v.includes('cover-identity mismatch'))).toBe(false)
    expect(revalidation.violations.some(v => v.includes('Variant options must be concrete mechanics'))).toBe(false)
  })

  it('repairs active Yngondi affiliation phrasing for locked Shadow Walker proposals before revalidation', () => {
    const prompt = 'Propose a new adversary: a Shadow Walker urban variant designed to blend into normal Karsac cities and towns. Use Spy as the preferred mechanical base. They are part of the Shadow Walkers faction, not Mathr, Yngondi or Vishara.'
    const constraints = extractProposalConstraints(prompt, 'spy')
    const output = `# Adversary: Veilstrider
## Doctrine
Secrecy and mission-first behaviour matter more than pride.

## Doctrine Under Pressure
Break contact, preserve the message, and withdraw through the crowd when exposed.

## Tactical Notes
They maintain a cover identity and avoid direct combat.

## DM-Only Notes
This adversary is a Shadow Walker operative.
They are potentially aligned with broader Yngondi interests, likely tied to a Yngondi directive, and protecting a Yngondi asset.

## Stat Block
*Medium humanoid, neutral*
**Languages** Common, Trade Tongue (local), Shadow Walker Sign
| STR | DEX | CON | INT | WIS | CHA |
|---:|---:|---:|---:|---:|---:|
| 10 (+0) | 14 (+2) | 14 (+2) | 13 (+1) | 12 (+1) | 14 (+2) |
**Challenge** 3 (700 XP) · **Proficiency Bonus** +2
### Traits
**Mapped Exits.** If Veilstrider has spent at least 10 minutes in a settlement location before combat begins, it has advantage on initiative. During the first round of combat, it can move up to half its speed without provoking opportunity attacks.
**No Last Stand.** Veilstrider does not fight to the death.
**Information First.** When Veilstrider is reduced below half its hit points, captured, or forced to reveal information, it can conceal, destroy, or pass on one carried note.
### Reactions
**Crowd Break.** When Veilstrider is hit or missed by an attack while at least two non-hostile creatures or significant cover are within 30 feet, it can move up to half its speed without provoking opportunity attacks.

## Corpus Frontmatter
related:
  factions: [shadow-walkers]
`
    const validation = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT, prompt, constraints)
    const repaired = repairAdversaryOutput(output, validation, SPY_BASE_CONTENT, constraints)
    const revalidation = validateAdversaryOutput(repaired, 'spy', SPY_BASE_CONTENT, prompt, constraints)

    expect(repaired).not.toContain('Yngondi interests')
    expect(repaired).not.toContain('Yngondi directive')
    expect(repaired).not.toContain('Yngondi asset')
    expect(repaired).toContain('internal Shadow Walker directive')
    expect(repaired).toContain('Shadow Walker contact, cache, or dead-drop route')
    expect(revalidation.violations.some(v => v.includes('Forbidden faction affiliation: "yngondi"'))).toBe(false)
  })

  it('normalizes malformed Shadow Walker creature lines before revalidation', () => {
    const prompt = 'They are part of the Shadow Walkers faction, not Mathr, Yngondi or Vishara.'
    const constraints = extractProposalConstraints(prompt, 'spy')
    const output = `# Adversary: Greycloak
## Doctrine
Secrecy and mission-first behaviour matter more than pride.

## Doctrine Under Pressure
Break contact, preserve the message, and withdraw through the crowd when exposed.

## Tactical Notes
They maintain a cover identity and avoid direct combat.

## DM-Only Notes
This adversary is a Shadow Walker operative.

## Stat Block
*Medium Humanoid, Urban Infiltrator*
**Languages** Common, Shadow Walker Sign

## Corpus Frontmatter
related:
  factions: [shadow-walkers]
`
    const validation = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT, prompt, constraints)
    const repaired = repairAdversaryOutput(output, validation, SPY_BASE_CONTENT, constraints)
    const revalidation = validateAdversaryOutput(repaired, 'spy', SPY_BASE_CONTENT, prompt, constraints)

    expect(repaired).toContain('*Medium humanoid, neutral*')
    expect(revalidation.violations.some(v => v.includes('alignment mismatch'))).toBe(false)
  })

  it('rewrites adaptation summary from the final stat block when kept claims are stale', () => {
    const output = `# Adversary: Veilward
## Adaptation Summary
- Kept from base: Expertise in Deception, Disguise Kit proficiency
- Changed from base: none

## Stat Block
**Languages** Common, Shadow Walker Sign
### Traits
**Mapped Exits.** If the veilward has spent at least 10 minutes in a settlement location before combat begins, it has advantage on initiative.
### Actions
**Dagger.** Melee Weapon Attack: +4 to hit, Hit: 4 (1d4 + 2) piercing damage.
`
    const validation = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT)
    const repaired = repairAdversaryOutput(output, validation, SPY_BASE_CONTENT)
    const revalidation = validateAdversaryOutput(repaired, 'spy', SPY_BASE_CONTENT)

    expect(repaired).toContain('## Adaptation Summary')
    expect(repaired).not.toContain('Expertise in Deception')
    expect(repaired).not.toContain('Disguise Kit proficiency')
    expect(repaired).toContain('Kept from base: Languages, ability scores')
    expect(revalidation.violations.some(v => v.startsWith('Adaptation mismatch:'))).toBe(false)
  })

  it('injects the Shadow Walker restraint-as-discipline theme during repair', () => {
    const prompt = 'They are part of the Shadow Walkers faction.'
    const constraints = extractProposalConstraints(prompt, 'spy')
    const output = `# Adversary: Veilward
## Doctrine
Secrecy and information preservation matter more than public glory.

## Tactical Notes
They avoid direct combat and preserve cover identity.

## DM-Only Notes
This adversary is a Shadow Walker operative.

## Stat Block
*Medium humanoid, neutral*
**Languages** Common, Shadow Walker Sign

## Corpus Frontmatter
related:
  factions: [shadow-walkers]
`
    const validation = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT, prompt, constraints)
    const repaired = repairAdversaryOutput(output, validation, SPY_BASE_CONTENT, constraints)
    const revalidation = validateAdversaryOutput(repaired, 'spy', SPY_BASE_CONTENT, prompt, constraints)

    expect(repaired).toContain('Their restraint is not mercy; it is discipline.')
    expect(revalidation.violations.some(v => v.includes('restraint-as-discipline theme'))).toBe(false)
  })

  it('repairs weak variant mechanics and invalid whispered rumour checks into runnable text', () => {
    const output = `# Adversary: Weaver
## Variant Options
Choose 2 traits and 1 reaction.

### Traits
- **Silver Tongue.** +2 to Persuasion checks.
- **Quick Study.** Learns a new skill proficiency after an hour.
- **Information Broker.** Can often acquire information.

### Signature Actions
- **Whispered Rumour.** One creature must succeed on a DC 13 Charisma (Reputation) check or believe the lie.
`
    const validation = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT)
    const repaired = repairAdversaryOutput(output, validation, SPY_BASE_CONTENT)
    const revalidation = validateAdversaryOutput(repaired, 'spy', SPY_BASE_CONTENT)

    expect(repaired).toContain('Once per scene, when the adversary fails a Charisma (Persuasion or Deception) check by 3 or less')
    expect(repaired).toContain('After observing a creature for 1 minute')
    expect(repaired).toContain('Once per scene in a settlement, the adversary can name or signal a minor contact')
    expect(repaired).toContain('must succeed on a DC 13 Wisdom (Insight) check')
    expect(revalidation.violations.some(v => v.includes('non-standard skill "Reputation"'))).toBe(false)
    expect(revalidation.violations.some(v => v.includes('flat bonus'))).toBe(false)
    expect(revalidation.violations.some(v => v.includes('long-horizon proficiency'))).toBe(false)
  })

  it('adds deterministic Shadow Walker urban doctrine support without relying on Qwen-owned sections', () => {
    const prompt = 'Propose a new adversary: a Shadow Walker urban variant designed to blend into normal Karsac cities and towns. Use Spy as the preferred mechanical base. They are part of the Shadow Walkers faction, not Mathr, Yngondi or Vishara.'
    const constraints = extractProposalConstraints(prompt, 'spy')
    const output = `# Adversary: City Reader
## Design Intent
Shadow Walker observer.

## Mechanical Base
Base: monsters/srd-2014/spy

## Adaptation Summary
- Added: doctrine sections

## Doctrine
They preserve cover identity and retreat when exposed.

## Doctrine Under Pressure
- Round one if attacked: pull away from the crowd edge and protect the carried message.
- Avoid being pinned down by: remaining unremarkable until the escape route opens.
- Prioritises preserving: cover identity and carried intelligence.
- Retreats when: publicly identified.
- If escape is impossible: surrender under a false name.
- Will not do: fight to the death.

## Behavioural Stages
Observe, misdirect, escape.

## Tactical Notes
Open in motion and avoid direct confrontation.

## Stat Block
### Traits
**Local Knowledge.** The city reader has advantage on Intelligence checks related to local customs and routes.

### Bonus Actions
None

### Reactions
None

## Tactics
Stay mobile.

## Social / Investigation Use
Blend in, ask quiet questions.

## Player-Safe Description
Looks ordinary until the party notices how little they miss.

## DM-Only Notes
This adversary is a Shadow Walker operative.

## Corpus Frontmatter
related:
  factions: [shadow-walkers]
`
    const validation = validateAdversaryOutput(output, 'spy', SPY_BASE_CONTENT, prompt, constraints)
    const repaired = repairAdversaryOutput(output, validation, SPY_BASE_CONTENT, constraints)
    const revalidation = validateAdversaryOutput(repaired, 'spy', SPY_BASE_CONTENT, prompt, constraints)

    expect(repaired).toContain('## Doctrine-Expressive Mechanics')
    expect(repaired).toContain('**Mapped Exits.**')
    expect(repaired).toContain('**No Last Stand.**')
    expect(repaired).toContain('**Information First.**')
    expect(repaired).toContain('**Crowd Break.**')
    expect(repaired).toContain('**Prepared Cover.**')
    expect(revalidation.valid).toBe(true)
    expect(revalidation.violations.some(v => v.includes('Doctrine not mechanically supported under pressure'))).toBe(false)
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
