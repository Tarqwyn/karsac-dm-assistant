import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { validateAdversaryOutput } from '../src/adversary-design.js'
import {
  buildAdversaryDoctrineReviewMessages,
  extractAdversaryDocument,
  getMissingDoctrineSections,
  shouldRunAdversaryDoctrineReview,
} from '../src/proposals/adversaryDoctrineReview.js'

const BASE_CONTENT = '**Armor Class** 12\n**Hit Points** 27\n**Senses** passive Perception 16\n**Languages** any two\n'

const MINIMAL_FACTION_ADVERSARY = `# Adversary: Veilstrider
## Design Intent
A Shadow Walker urban infiltrator that watches first and only escalates when exposed.

## Mechanical Base
Base: monsters/srd-2014/spy - Spy

## Adaptation Summary
- Kept from base: Sneak Attack
- Changed from base: Reframed for urban infiltration
- Added: Crowd Dissolution
- Removed: none
- Mechanical risk: low

## Stat Block
**Armour Class** 12
**Hit Points** 27
**Senses** passive Perception 16
### Traits
**Sneak Attack (1/Turn).** The veilstrider deals an extra 7 (2d6) damage when it has advantage.
**Mapped Exits.** If the veilstrider has spent at least 10 minutes in a settlement location before combat begins, it has advantage on initiative. On the first round of combat, it can move up to half its speed without provoking opportunity attacks.
### Actions
**Shortsword.** Melee Weapon Attack: +4 to hit, Hit: 5 (1d6 + 2) piercing damage.
### Reactions
**Crowd Break.** When the veilstrider is hit or missed by an attack while at least two non-hostile creatures or significant cover are within 30 feet, it can use its reaction to move up to half its speed without provoking opportunity attacks.

## Tactics
Observe first, disengage if exposed, and avoid public bloodshed.

## DM-Only Notes
This adversary is a Shadow Walker operative used for urban observation.

## Corpus Frontmatter
\`\`\`yaml
related:
  factions: [shadow-walkers]
\`\`\`
`

describe('shouldRunAdversaryDoctrineReview', () => {
  const originalEnv = {
    KARSAC_ENABLE_DOCTRINE_REVIEW: process.env.KARSAC_ENABLE_DOCTRINE_REVIEW,
  }

  beforeEach(() => {
    process.env.KARSAC_ENABLE_DOCTRINE_REVIEW = 'false'
  })

  afterEach(() => {
    process.env.KARSAC_ENABLE_DOCTRINE_REVIEW = originalEnv.KARSAC_ENABLE_DOCTRINE_REVIEW
  })

  it('requires an adversary, a locked faction, and a configured doctrine model', () => {
    const result = shouldRunAdversaryDoctrineReview({
      explicitFlag: true,
      proposalType: 'adversary',
      lockedFaction: 'shadow-walkers',
      doctrineModel: 'mistral-small:latest',
    })

    expect(result).toBe(true)
  })

  it('skips when no doctrine model is configured', () => {
    const result = shouldRunAdversaryDoctrineReview({
      explicitFlag: true,
      proposalType: 'adversary',
      lockedFaction: 'shadow-walkers',
      doctrineModel: null,
    })

    expect(result).toBe(false)
  })

  it('can be enabled through environment defaults', () => {
    process.env.KARSAC_ENABLE_DOCTRINE_REVIEW = 'true'

    const result = shouldRunAdversaryDoctrineReview({
      explicitFlag: null,
      proposalType: 'adversary',
      lockedFaction: 'shadow-walkers',
      doctrineModel: 'gemma3:12b',
    })

    expect(result).toBe(true)
  })
})

describe('buildAdversaryDoctrineReviewMessages', () => {
  it('requests the doctrine sections and includes first-pass validation context', () => {
    const messages = buildAdversaryDoctrineReviewMessages({
      prompt: 'They are part of the Shadow Walkers faction, not Mathr.',
      proposalText: MINIMAL_FACTION_ADVERSARY,
      constraints: {
        lockedFaction: 'shadow-walkers',
        forbiddenFactions: ['mathr'],
        preferredBase: 'spy',
        allowedBases: ['spy'],
        environmentContext: 'urban / towns / cities',
        variantOptionsRequired: false,
        modularChoiceRule: null,
      },
      baseFile: null,
      relatedAdversaries: [],
      validationIssues: ['WARN: Faction adversary lacks doctrine/tactical behaviour sections.'],
      validationStatus: 'warning',
    })

    expect(messages).toHaveLength(2)
    expect(messages[0].content).toContain('## Doctrine')
    expect(messages[0].content).toContain('## Doctrine Under Pressure')
    expect(messages[0].content).toContain('## Behavioural Stages')
    expect(messages[0].content).toContain('## Tactical Notes')
    expect(messages[0].content).toContain('combat-optimised party')
    expect(messages[1].content).toContain('FIRST PASS VALIDATION: warning')
    expect(messages[1].content).toContain('Locked faction: shadow-walkers')
    expect(messages[1].content).toContain('Mapped Exits')
    expect(messages[1].content).toContain('Crowd Break')
    expect(messages[1].content).toContain('Information First')
    expect(messages[1].content).toContain('No Last Stand')
    expect(messages[1].content).toContain('must appear in the actual Stat Block')
    expect(messages[1].content).toContain('Do not write Charisma (Insight)')
  })
})

describe('validateAdversaryOutput doctrine warnings', () => {
  it('warns without failing when a faction adversary lacks doctrine sections', () => {
    const result = validateAdversaryOutput(
      MINIMAL_FACTION_ADVERSARY,
      'spy',
      BASE_CONTENT,
      'They are part of the Shadow Walkers faction, not Mathr.',
    )

    expect(result.valid).toBe(true)
    expect(result.violations).toContain('WARN: Faction adversary lacks doctrine/tactical behaviour sections.')
  })

  it('does not warn when the doctrine sections are present', () => {
    const withDoctrine = `${MINIMAL_FACTION_ADVERSARY}
## Doctrine
They solve the mission without becoming the problem.

## Doctrine Under Pressure
- Round one if attacked: break contact, force line-of-sight problems, and preserve any carried intelligence.
- Avoid being pinned down by: Controlled Withdrawal and crowd cover.
- Prioritises preserving: the network, the message, and its cover identity.
- Retreats when: identified, restrained by the field, or cut off from witnesses.
- If escape is impossible: destroy evidence, misdirect, and surrender only if it protects the network.
- Will not do: die for appearances or start a public massacre.

## Behavioural Stages
### Stage One — Mission incomplete.
- What they want: observe and map the room.
- What they do: remain ordinary and collect timings.
- What they avoid: open conflict.
- What mechanics they use: Blend, Sneak Attack only if cornered.

### Stage Two — Exposed or blocked.
- What they want: break contact and protect the network.
- What they do: dissolve into the crowd.
- What they avoid: prolonged duels.
- What mechanics they use: Crowd Dissolution.

### Stage Three — Cornered or compromised.
- What they want: escape with the mission intact.
- What they do: trade space for time and withdraw.
- What they avoid: glorious last stands.
- What mechanics they use: Controlled Withdrawal.

## Tactical Notes
- Opening behaviour: observe first.
- Target priority: the witness who can expose the network.
- Retreat logic: leave once identified.
- Escalation trigger: a blocked escape line.
- What they do if captured: stall and misdirect.
- What they will not do: public massacre.

## Doctrine-Expressive Mechanics
- Blend expresses urban concealment.
- Controlled Withdrawal expresses mission-first discipline.
`

    const result = validateAdversaryOutput(
      withDoctrine,
      'spy',
      BASE_CONTENT,
      'They are part of the Shadow Walkers faction, not Mathr.',
    )

    expect(result.violations.some((issue) => issue.includes('doctrine/tactical'))).toBe(false)
  })
})

describe('extractAdversaryDocument and doctrine section checks', () => {
  it('strips commentary before the adversary heading', () => {
    const result = extractAdversaryDocument(`Here is the revision.\n\n# Adversary: Veilstrider\n## Stat Block\n...`)
    expect(result.startsWith('# Adversary: Veilstrider')).toBe(true)
  })

  it('reports missing doctrine sections deterministically', () => {
    expect(getMissingDoctrineSections(MINIMAL_FACTION_ADVERSARY)).toEqual([
      'Doctrine',
      'Doctrine Under Pressure',
      'Behavioural Stages',
      'Tactical Notes',
      'Doctrine-Expressive Mechanics',
    ])
  })
})
