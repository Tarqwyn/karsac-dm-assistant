import { afterEach, describe, expect, it } from 'vitest'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { buildConstrainedProposalPrompt } from '../src/proposals/proposalConstraints.js'
import { validateProposalContent } from '../src/proposals/proposalValidator.js'
import { PROPOSALS_ROOT } from '../src/paths.js'
import {
  getSentenceBoundaryPronouns, getCommonNounSkips, getTitleTokens,
  getCosmologicalForceNames, getGenericSingleWordSkips,
  getOrgTypeSuffixes, getOrgStopWords, getTitleTokenAlternation,
  clearStyleGuardsCacheForTests,
} from '../src/proposals/styleGuardsLoader.js'
import {
  clearProposalEntityRegistryCachesForTests,
  detectCorpusAnchorForProposal,
  loadProvisionalEntityRegister,
} from '../src/proposals/proposalEntityRegistry.js'
import { clearProposalGovernanceCachesForTests } from '../src/proposals/proposalGovernance.js'

const TEMP_PROVISIONAL_DIR = resolve('/tmp/karsac-provisional-entity-tests')

afterEach(() => {
  rmSync(TEMP_PROVISIONAL_DIR, { recursive: true, force: true })
  rmSync(resolve(PROPOSALS_ROOT, 'places', 'hrimfell-temp.proposed.md'), { force: true })
  clearProposalEntityRegistryCachesForTests()
  clearProposalGovernanceCachesForTests()
})

describe('buildConstrainedProposalPrompt', () => {
  it('injects chapter state and encounter constraints before the original request', () => {
    const prompt = buildConstrainedProposalPrompt({
      proposalType: 'encounter',
      prompt: 'Propose a new encounter on the fjord road.',
      stateData: {
        campaignState: { currentSession: 2, currentChapter: 3 },
        worldThreads: {
          threads: [
            { name: 'Road pressure', summary: 'Traffic is being watched.', currentStatus: 'hot' },
            { name: 'Harbour tension', summary: 'Merchants are uneasy.', currentStatus: 'simmering' },
          ],
        },
        playerKnowledge: { knownFacts: ['The coast road is no longer safe after dusk.'] },
        sessionFacts: { dmOnlyFacts: ['Do not reveal the hidden sponsor behind the patrol shift.'] },
      },
    })

    expect(prompt).toContain('CHAPTER STATE TRACKER')
    expect(prompt).toContain('Hot threads:')
    expect(prompt).toContain('PRE-GENERATION ENCOUNTER CONSTRAINTS')
    expect(prompt).toContain('Maximum two new NPCs unless the prompt explicitly asks for more.')
    expect(prompt.trim().endsWith('Propose a new encounter on the fjord road.')).toBe(true)
  })

  it('injects faction-profile-aware adversary constraints before the original request', () => {
    const prompt = buildConstrainedProposalPrompt({
      proposalType: 'adversary',
      prompt: 'Propose a new adversary: a Shadow Walker urban variant.',
      lockedFaction: 'shadow-walkers',
      forbiddenFactions: ['mathr', 'yngondi', 'vishara'],
      preferredMechanicalBase: 'spy',
      stateData: {
        campaignState: { currentSession: 2, currentChapter: 3 },
        worldThreads: {
          threads: [
            { name: 'Shadow Walkers pressure', summary: 'A local cell is observing harbour traffic.', currentStatus: 'hot' },
          ],
        },
      },
    })

    expect(prompt).toContain('PRE-GENERATION ADVERSARY CONSTRAINTS')
    expect(prompt).toContain('Locked faction: shadow-walkers.')
    expect(prompt).toContain('Shadow Walker doctrine must include restraint-as-discipline')
    expect(prompt).toContain('Forbidden faction affiliations: mathr, yngondi, vishara.')
    expect(prompt).toContain('Faction-relevant threads:')
  })

  it('injects a corpus-anchor block for named canonical NPCs', () => {
    const prompt = buildConstrainedProposalPrompt({
      proposalType: 'npc',
      prompt: 'Propose a new NPC: Jarl Beorn, but focus on how he meets the party at Valweg.',
      corpusAnchor: {
        corpusNamed: true,
        proposalType: 'npc',
        subjectName: 'Jarl Beorn',
        entity: {
          id: 'npcs/jarl-beorn',
          type: 'npc',
          title: 'Jarl Beorn',
          path: '',
          collection: 'karsac-major-npcs',
          tags: [],
          aliases: [],
          related: {},
          doNotConfuseWith: [],
          summary: 'Leads the Valweg council; deep relationship with King Dugweb; deceived by Mathr for sixty years, not corrupted; Brynja\'s named route forward',
        },
        stubLevel: false,
        coverageLevel: 'anchored',
        policy: null,
        exactSnippets: ['Leads the Valweg council; deep relationship with King Dugweb; deceived by Mathr for sixty years, not corrupted; Brynja\'s named route forward'],
      },
    })

    expect(prompt).toContain('CORPUS-ANCHOR CONSTRAINT')
    expect(prompt).toContain('This npc is named in existing corpus.')
    expect(prompt).toContain('Leads the Valweg council; deep relationship with King Dugweb')
  })

  it('injects a stub-level constraint for named canonical place stubs', () => {
    const prompt = buildConstrainedProposalPrompt({
      proposalType: 'place',
      prompt: 'Propose a new place: Sea of Karsac.',
      corpusAnchor: {
        corpusNamed: true,
        proposalType: 'place',
        subjectName: 'Sea of Karsac',
        entity: {
          id: 'places/sea-of-karsac',
          type: 'place',
          title: 'Sea of Karsac',
          path: '',
          collection: 'karsac-places',
          tags: [],
          aliases: [],
          related: {},
          doNotConfuseWith: [],
          summary: 'A broad northern sea route with only sparse canonical treatment.',
        },
        stubLevel: true,
        coverageLevel: 'stub',
        policy: null,
        exactSnippets: ['A broad northern sea route with only sparse canonical treatment.'],
      },
    })

    expect(prompt).toContain('Do not invent geography, rivers, districts, landmarks')
    expect(prompt).toContain('A correct minimal proposal is preferable to a detailed invented one')
  })

  it('injects policy-driven scope rules for stub-level canonical NPCs', () => {
    const anchor = detectCorpusAnchorForProposal('npc', 'Propose a new NPC: Maret.')
    const prompt = buildConstrainedProposalPrompt({
      proposalType: 'npc',
      prompt: 'Propose a new NPC: Maret.',
      corpusAnchor: anchor,
    })

    expect(anchor.policy?.entityId).toBe('npcs/maret')
    expect(prompt).toContain('Unsupported character fields should remain unresolved')
    expect(prompt).toContain('Do not fill unsupported sections for this entity')
    expect(prompt).toContain('No further characterisation is available in the current corpus.')
  })
})

describe('proposal governance validation', () => {
  it('fails place proposals that introduce a named non-canonical NPC without a separate NPC path', () => {
    const frontmatter = {
      proposal_type: 'place',
      id: 'proposals/test-place',
      title: 'Fiska',
      status: 'proposed',
      canonical: 'provisional',
      visibility: 'dm-only',
      source_prompt: 'Propose a new place: Fiska.',
      promote_target: 'corpus/planning/places',
      summary: 'Fiska',
      route_profile: 'place-design',
      related: { factions: [], places: [], npcs: [], chapters: [], sessions: [], items: [] },
    }
    const body = `# Place: Fiska

## Overview
Fiska is a fjord market town.

## Geography and Layout
The road curves down into the harbour.

## Key Districts
- Upper quays

## Factions
- The dock elders

## Key NPCs
- **Captain Harrow:** Watches the harbour and quietly redirects patrols for private advantage.
`

    const result = validateProposalContent(frontmatter, body, 'place')
    expect(result.valid).toBe(false)
    expect(result.issues.some((issue) => issue.includes('Named NPC boundary'))).toBe(true)
  })

  it('fails proposals that imply a new canonical item state change', () => {
    const frontmatter = {
      proposal_type: 'encounter',
      id: 'proposals/test-encounter',
      title: 'Bone Disc Exchange',
      status: 'proposed',
      canonical: 'provisional',
      visibility: 'dm-only',
      source_prompt: 'Propose a new encounter involving the Bone Disc.',
      promote_target: 'corpus/planning/scenes',
      summary: 'Bone Disc Exchange',
      route_profile: 'encounter-design',
      related: { factions: [], places: [], npcs: [], chapters: [], sessions: [], items: [] },
    }
    const body = `# Encounter: Bone Disc Exchange

## Encounter Type
Social pressure

## Campaign Purpose
Escalate local suspicion.

## Cast
Dock clerk, courier.

## Pressure Ladder
Questioning, crowding, chase.

## Checks and Mechanics
Insight DC 13, Stealth DC 14.

## Outcomes
The Bone Disc is revealed to be a lost version with a newly broken fragment hidden in a copied case.
`

    const result = validateProposalContent(frontmatter, body, 'encounter')
    expect(result.valid).toBe(false)
    expect(result.issues.some((issue) => issue.includes('Canonical item state change'))).toBe(true)
  })

  it('fails on canonical place misspellings in related metadata', () => {
    const frontmatter = {
      proposal_type: 'npc',
      id: 'proposals/test-road-warden',
      title: 'Road Warden',
      status: 'proposed',
      canonical: 'provisional',
      visibility: 'dm-only',
      source_prompt: 'Propose a new NPC for Lösweg.',
      promote_target: 'corpus/planning/npcs',
      summary: 'Road Warden',
      route_profile: 'npc-design',
      related: { factions: [], places: ['lowseg'], npcs: [], chapters: [], sessions: [], items: [] },
    }
    const body = `# NPC: Road Warden

## Role
Road checkpoint officer.

## Physical Bearing
Broad and practical.

## What They Want
Order.

## What They Hide
An old compromise.

## can_know
- One fact.

## must_not_know
- One hidden fact.

## Lines to Inhabit
- "Slow down."

## Dramatic Utility
Delay and pressure.

## player_safe
Players see a patient official.

## dm_only
The warden is exhausted by conflicting loyalties.
`

    const result = validateProposalContent(frontmatter, body, 'npc')
    expect(result.valid).toBe(false)
    expect(result.issues.some((issue) => issue.includes('Place registry mismatch'))).toBe(true)
  })

  it('fails on non-standard mechanics without a spurious player_safe visibility warning for npc proposals', () => {
    const frontmatter = {
      proposal_type: 'npc',
      id: 'proposals/test-npc',
      title: 'Test Speaker',
      status: 'proposed',
      canonical: 'provisional',
      visibility: 'dm-only',
      source_prompt: 'Propose a new NPC.',
      promote_target: 'corpus/planning/npcs',
      summary: 'Test Speaker',
      route_profile: 'npc-design',
      related: { factions: [], places: [], npcs: [], chapters: [], sessions: [], items: [] },
    }
    const body = `# NPC: Test Speaker

## Role
A talker.

## Physical Bearing
Sharp-eyed.

## What They Want
To secure leverage.

## What They Hide
They use Charisma (Reputation) to dominate local gossip.

## can_know
- One thing.

## must_not_know
- One hidden thing.

## Lines to Inhabit
- "You look lost."

## Dramatic Utility
Social pressure.

## player_safe
Players can tell they are calm.

## dm_only
They are more frightened than they seem.
`

    const result = validateProposalContent(frontmatter, body, 'npc')
    expect(result.valid).toBe(false)
    expect(result.issues.some((issue) => issue.includes('visibility/content mismatch'))).toBe(false)
    expect(result.issues.some((issue) => issue.includes('Non-5e mechanic detection'))).toBe(true)
  })

  it('warns when a canonical named entity proposal lacks corpus-anchor metadata', () => {
    const frontmatter = {
      proposal_type: 'npc',
      id: 'proposals/test-beorn',
      title: 'Jarl Beorn',
      status: 'proposed',
      canonical: 'provisional',
      visibility: 'dm-only',
      source_prompt: 'Propose a new NPC: Jarl Beorn at Valweg.',
      promote_target: 'corpus/planning/npcs',
      summary: 'Jarl Beorn',
      route_profile: 'npc-design',
      related: { factions: [], places: [], npcs: [], chapters: [], sessions: [], items: [] },
    }
    const body = `# NPC: Jarl Beorn

## Role
Leader of the Valweg council.

## Physical Bearing
Heavy-cloaked and watchful.

## What They Want
To keep the council stable.

## What They Hide
They fear how long Mathr has deceived them.

## can_know
- One fact.

## must_not_know
- One hidden fact.

## Lines to Inhabit
- "Say it plainly."

## Dramatic Utility
Political pressure.

## player_safe
Players see a tired ruler.

## dm_only
He has been misled for decades.
`

    const result = validateProposalContent(frontmatter, body, 'npc')
    expect(result.issues.some((issue) => issue.includes('Corpus-named entity without corpus-anchor instruction'))).toBe(true)
  })

  it('fails when an NPC proposal invents a second named individual in dm_only', () => {
    const frontmatter = {
      proposal_type: 'npc',
      id: 'proposals/test-beorn-2',
      title: 'Jarl Beorn',
      status: 'proposed',
      canonical: 'provisional',
      visibility: 'dm-only',
      source_prompt: 'Propose a new NPC: Jarl Beorn.',
      corpus_named: true,
      promote_target: 'corpus/planning/npcs',
      summary: 'Jarl Beorn',
      route_profile: 'npc-design',
      related: { factions: [], places: [], npcs: [], chapters: [], sessions: [], items: [] },
    }
    const body = `# NPC: Jarl Beorn

## Role
Leader of the Valweg council.

## Physical Bearing
Heavy-cloaked and watchful.

## What They Want
To hold the line.

## What They Hide
He distrusts open oaths.

## can_know
- One fact.

## must_not_know
- One hidden fact.

## Lines to Inhabit
- "Roads fail when men talk around the point."

## Dramatic Utility
Political pressure.

## player_safe
Players see a stern jarl.

## dm_only
Astrid serves as his private enforcer and wants the party gone before dusk.
`

    const result = validateProposalContent(frontmatter, body, 'npc')
    expect(result.valid).toBe(false)
    expect(result.issues.some((issue) => issue.includes('Named NPC boundary'))).toBe(true)
  })

  it('fails with a character conflict when a canonical NPC is repurposed with a different role', () => {
    const frontmatter = {
      proposal_type: 'place',
      id: 'proposals/test-brix',
      title: 'Harbour Fort',
      status: 'proposed',
      canonical: 'provisional',
      visibility: 'dm-only',
      source_prompt: 'Propose a new place with a garrison.',
      promote_target: 'corpus/planning/places',
      summary: 'Harbour Fort',
      route_profile: 'place-design',
      related: { factions: [], places: [], npcs: [], chapters: [], sessions: [], items: [] },
    }
    const body = `# Place: Harbour Fort

## Overview
An armed checkpoint.

## Geography and Layout
Stone walls over the road.

## Key Districts
- Gate ward

## Factions
- The fort watch

## Key NPCs
- **Brix:** Garrison captain who commands the fort watch and decides who enters the city.
`

    const result = validateProposalContent(frontmatter, body, 'place')
    expect(result.valid).toBe(false)
    expect(result.issues.some((issue) => issue.includes('Character conflict'))).toBe(true)
  })

  it('warns when a proposal references a provisional-only entity', () => {
    clearProposalEntityRegistryCachesForTests()
    mkdirSync(resolve(PROPOSALS_ROOT, 'places'), { recursive: true })
    writeFileSync(
      resolve(PROPOSALS_ROOT, 'places', 'hrimfell-temp.proposed.md'),
      `---
id: proposals/hrimfell
proposal_type: place
title: Hrimfell
status: proposed
canonical: provisional
visibility: dm-only
created_at: '2026-06-02T00:00:00.000Z'
source_prompt: test
route_profile: place-design
validation:
  status: pass
  issues: []
related:
  chapters: []
  sessions: []
  factions: []
  places: []
  npcs: []
  items: []
promote_target: corpus/planning/places
summary: Hrimfell
---
# Place: Hrimfell

	## Factions and Power Structures
	- **Silent Hand:** A hidden local faction used only in this provisional proposal.
	`,
    )
    clearProposalEntityRegistryCachesForTests()
    const provisional = loadProvisionalEntityRegister()
    expect(provisional.some((entry) => entry.name === 'Hrimfell')).toBe(true)
  })

  it('warns in validation when a proposal treats a provisional-only entity as canonical', () => {
    clearProposalEntityRegistryCachesForTests()
    mkdirSync(resolve(PROPOSALS_ROOT, 'places'), { recursive: true })
    writeFileSync(
      resolve(PROPOSALS_ROOT, 'places', 'hrimfell-temp.proposed.md'),
      `---
id: proposals/hrimfell-temp
proposal_type: place
title: Hrimfell
status: proposed
canonical: provisional
visibility: dm-only
created_at: '2026-06-02T00:00:00.000Z'
source_prompt: test
route_profile: place-design
validation:
  status: pass
  issues: []
related:
  chapters: []
  sessions: []
  factions: []
  places: []
  npcs: []
  items: []
promote_target: corpus/planning/places
summary: Hrimfell
---
# Place: Hrimfell

## Factions and Power Structures
- **Silent Hand:** A hidden local faction used only in this provisional proposal.
`,
    )
    clearProposalEntityRegistryCachesForTests()
    clearProposalGovernanceCachesForTests()

    const frontmatter = {
      proposal_type: 'encounter',
      id: 'proposals/test-silent-hand',
      title: 'Harbour Intercept',
      status: 'proposed',
      canonical: 'provisional',
      visibility: 'dm-only',
      source_prompt: 'Propose a new encounter.',
      promote_target: 'corpus/planning/scenes',
      summary: 'Harbour Intercept',
      route_profile: 'encounter-design',
      related: { factions: [], places: [], npcs: [], chapters: [], sessions: [], items: [] },
    }
    const body = `# Encounter: Harbour Intercept

## Encounter Type
Social pressure

## Campaign Purpose
Escalate harbour paranoia.

## Cast
Clerk, courier.

## Pressure Ladder
Questioning, crowding, departure.

## Checks and Mechanics
Insight DC 13.

## Outcomes
Hrimfell appears to be behind the exchange.
`

    const result = validateProposalContent(frontmatter, body, 'encounter')
    expect(result.issues.some((issue) => issue.includes('Provisional entity reference'))).toBe(true)
  })

  it('warns when a stub-level place proposal expands into full district structure', () => {
    const frontmatter = {
      proposal_type: 'place',
      id: 'proposals/test-stub-place',
      title: 'Sea of Karsac',
      status: 'proposed',
      canonical: 'provisional',
      visibility: 'dm-only',
      corpus_named: true,
      corpus_stub_level: true,
      source_prompt: 'Propose a new place: Sea of Karsac.',
      promote_target: 'corpus/planning/places',
      summary: 'Sea of Karsac',
      route_profile: 'place-design',
      related: { factions: [], places: [], npcs: [], chapters: [], sessions: [], items: [] },
    }
    const body = `# Place: Sea of Karsac

## Overview
An enormous region.

## Geography and Layout
Storm-black waters.

## Key Districts
- East quay
- North quay

## Notable Landmarks
- Whale gate

## Factions
- The Lantern Masters
`

    const result = validateProposalContent(frontmatter, body, 'place')
    expect(result.issues.some((issue) => issue.includes('Stub-level place overreach'))).toBe(true)
  })

  it('fails when a stub-level canonical NPC exceeds its policy scope', () => {
    const frontmatter = {
      proposal_type: 'npc',
      id: 'proposals/test-maret',
      title: 'Maret',
      status: 'proposed',
      canonical: 'provisional',
      visibility: 'dm-only',
      source_prompt: 'Propose a new NPC: Maret.',
      promote_target: 'corpus/planning/npcs',
      summary: 'Maret',
      route_profile: 'npc-design',
      corpus_named: true,
      corpus_anchor_entity: 'npcs/maret',
      corpus_stub_level: true,
      corpus_coverage_level: 'stub',
      corpus_policy_id: 'npcs/maret',
      related: { factions: [], places: [], npcs: [], chapters: [], sessions: [], items: [] },
    }
    const body = `# NPC: Maret

## Role
Archivist in Valweg.

## Physical Bearing
Tall, stooped, and ink-stained.

## What They Want
To retire quietly.

## What They Hide
Fear of the archive.

## can_know
- The archive location.

## must_not_know
- The hidden truth.

## Lines to Inhabit
- "Follow me."

## Dramatic Utility
Guide to the archive.

## player_safe
An archivist.

## dm_only
Cautious and weary.
`

    const result = validateProposalContent(frontmatter, body, 'npc')
    expect(result.valid).toBe(false)
    expect(result.issues.some((issue) => issue.includes('scope violation'))).toBe(true)
  })

  it('fails when canonical ambiguity rules are extended beyond corpus', () => {
    const frontmatter = {
      proposal_type: 'npc',
      id: 'proposals/test-dugweb',
      title: 'King Dugweb',
      status: 'proposed',
      canonical: 'provisional',
      visibility: 'dm-only',
      source_prompt: 'Propose a new NPC: King Dugweb.',
      promote_target: 'corpus/planning/npcs',
      summary: 'King Dugweb',
      route_profile: 'npc-design',
      corpus_named: true,
      corpus_anchor_entity: 'npcs/king-dugweb',
      corpus_policy_id: 'npcs/king-dugweb',
      related: { factions: [], places: [], npcs: [], chapters: [], sessions: [], items: [] },
    }
    const body = `# NPC: King Dugweb

## Role
Ancient king.

## can_know
- He visits annually.

## must_not_know
- Hidden truth.

## Dramatic Utility
Political hinge.

## player_safe
Ancient king with Kurogane.

## dm_only
He understands the nature of Kurogane and the events that led to the Shade of Qadim al-Sharr's defeat.
`

    const result = validateProposalContent(frontmatter, body, 'npc')
    expect(result.valid).toBe(false)
    expect(result.issues.some((issue) => issue.includes('Kurogane details are unresolved'))).toBe(true)
    expect(result.issues.some((issue) => issue.includes('Shade of Qadim al-Sharr details are unresolved'))).toBe(true)
  })

  it('warns on action-economy cost for a free check and unknown language entries', () => {
    const frontmatter = {
      proposal_type: 'adversary',
      id: 'proposals/test-torin',
      title: 'Torin',
      status: 'proposed',
      canonical: 'provisional',
      visibility: 'dm-only',
      source_prompt: 'Propose a new adversary.',
      promote_target: 'corpus/adversary-corpus/karsac-adversaries',
      summary: 'Torin',
      route_profile: 'adversary-design',
      related: { factions: [], places: [], npcs: [], chapters: [], sessions: [], items: [] },
    }
    const body = `# Adversary: Torin

## Mechanical Base
Base: guard

## Adaptation Summary
- Kept from base: spear

## Stat Block
**Languages** Common, Undercommon

### Bonus Actions
**Observe.** Torin uses a bonus action to make a Wisdom (Insight) check.

## Tactics
Watch first.
`

    const result = validateProposalContent(frontmatter, body, 'adversary')
    expect(result.issues.some((issue) => issue.includes('Action economy warning'))).toBe(true)
    expect(result.issues.some((issue) => issue.includes('Language not in whitelist'))).toBe(true)
  })
})

// ── Pass 3 regression tests ───────────────────────────────────────────────────

describe('Pass 3: pronoun false positive fix', () => {
  it('capitalised pronoun "He" at sentence boundary does not trigger named NPC boundary rule', () => {
    const frontmatter = {
      proposal_type: 'npc',
      title: 'The Warden',
      source_prompt: 'Propose a new NPC: a warden.',
      visibility: 'dm-only',
      related: { factions: [], places: [] },
    }
    const body = `
## Role
He is a road warden stationed on the fjord road. He guards the pass.
His duties include checking papers. She was the previous holder of this post.
They report to the garrison captain. Their records are meticulous.

## What They Hide
Nothing yet.
`
    const result = validateProposalContent(frontmatter as any, body, 'npc')
    // None of He/His/She/Their should appear as NPC boundary fails
    const pronounFails = result.issues.filter((i) => /Named NPC boundary.*"(?:He|His|She|Her|They|Their|It|We|Our)"/i.test(i))
    expect(pronounFails).toHaveLength(0)
  })
})

describe('Pass 3: character conflict resolves to own canonical entity', () => {
  it('character conflict message cites entity id, not a passage mentioning the name', () => {
    const frontmatter = {
      proposal_type: 'place',
      title: 'The Saltbone Inn',
      source_prompt: 'Propose a new place: the Saltbone Inn.',
      visibility: 'dm-only',
      related: { factions: [], places: [] },
    }
    // Jarl Mathr appears here as an authority figure — should resolve to npcs/jarl-mathr
    const body = `
## Overview
A well-known inn where travellers stop. Jarl Mathr controls access to the harbour.

## Key NPCs
- **Jarl Mathr:** commands the garrison and controls harbour access.

## DM Notes
Nothing hidden.
`
    const result = validateProposalContent(frontmatter as any, body, 'place')
    const mathrFails = result.issues.filter((i) => i.includes('Jarl Mathr'))
    if (mathrFails.length > 0) {
      // If flagged, should cite the entity ID, not a passage
      expect(mathrFails[0]).toContain('npcs/jarl-mathr')
    }
    // Should not mention "Truthspeaker" or any unrelated file that mentions Mathr
    expect(mathrFails.every((i) => !i.includes('Truthspeaker'))).toBe(true)
  })
})

// ── Pass 6 regression tests ───────────────────────────────────────────────────

describe('Pass 6: related-entity allowlist from canonical file', () => {
  it('builds allowlist from all related entity IDs and does not conflict on Beorn canonical NPCs', () => {
    const frontmatter = {
      proposal_type: 'npc',
      id: 'proposals/test-beorn-relations',
      title: 'Jarl Beorn',
      status: 'proposed',
      canonical: 'provisional',
      visibility: 'dm-only',
      source_prompt: 'Propose a new NPC: Jarl Beorn.',
      corpus_named: true,
      corpus_anchor_entity: 'npcs/jarl-beorn',
      corpus_policy_id: 'npcs/jarl-beorn',
      promote_target: 'corpus/planning/npcs',
      summary: 'Jarl Beorn, council leader.',
      route_profile: 'npc-design',
      related: { factions: [], places: [], npcs: [], chapters: [], sessions: [], items: [] },
    }
    // Mentions Jarl Mathr and King Dugweb — both in Beorn's canonical related.npcs
    const body = `# NPC: Jarl Beorn

## Role
Council leader. Acts alongside Jarl Mathr, who has shaped the council for sixty years.

## can_know
- King Dugweb visits annually.

## must_not_know
- Mathr's long deception.

## Lines to Inhabit
- "Say it plainly."

## Dramatic Utility
Political pressure.

## player_safe
A tired ruler.

## dm_only
He has been misled for decades by Jarl Mathr.
`
    const result = validateProposalContent(frontmatter, body, 'npc')
    // Mathr and Dugweb are canonical related entities — must NOT trigger character conflict
    const mathrConflict = result.issues.filter((i) => i.includes('Character conflict') && i.includes('Mathr'))
    const dugwebConflict = result.issues.filter((i) => i.includes('Character conflict') && i.includes('Dugweb'))
    expect(mathrConflict).toHaveLength(0)
    expect(dugwebConflict).toHaveLength(0)
  })

  it('references to allowlisted entities in anchored proposal do not trigger named NPC boundary', () => {
    const frontmatter = {
      proposal_type: 'npc',
      id: 'proposals/test-beorn-anchored',
      title: 'Jarl Beorn',
      status: 'proposed',
      canonical: 'provisional',
      visibility: 'dm-only',
      source_prompt: 'Propose a new NPC: Jarl Beorn.',
      corpus_named: true,
      corpus_anchor_entity: 'npcs/jarl-beorn',
      corpus_policy_id: 'npcs/jarl-beorn',
      promote_target: 'corpus/planning/npcs',
      summary: 'Jarl Beorn',
      route_profile: 'npc-design',
      related: { factions: [], places: [], npcs: [], chapters: [], sessions: [], items: [] },
    }
    const body = `# NPC: Jarl Beorn

## Role
Council leader.

## can_know
- King Dugweb visits annually and Jarl Mathr manages every visit.

## must_not_know
- Hidden.

## Lines to Inhabit
- "Say it plainly."

## Dramatic Utility
Political pressure.

## player_safe
Visible.

## dm_only
He acts when shown evidence that Jarl Mathr has deceived him.
`
    const result = validateProposalContent(frontmatter, body, 'npc')
    const boundaryIssues = result.issues.filter((i) => i.includes('Named NPC boundary') && (i.includes('Mathr') || i.includes('Dugweb')))
    expect(boundaryIssues).toHaveLength(0)
  })
})

describe('Pass 6: common noun exclusion prevents false positives', () => {
  it('Fog does not trigger named-entity boundary check', () => {
    const frontmatter = {
      proposal_type: 'place',
      title: 'Fjord Road',
      source_prompt: 'Propose a new place: the fjord road.',
      visibility: 'dm-only',
      related: { factions: [], places: [] },
    }
    const body = `# Place: Fjord Road

## Overview
The Fog guards the pass. Stone walls rise on either side. The River cuts through below.
Shadow falls early here.

## DM Notes
Watch for the Fog.
`
    const result = validateProposalContent(frontmatter as any, body, 'place')
    const fogIssues = result.issues.filter((i) => /Named NPC boundary.*"(?:Fog|Stone|River|Shadow)"/i.test(i))
    expect(fogIssues).toHaveLength(0)
  })
})

describe('Pass 3: language whitelist enforcement', () => {
  it('Lösweg Sign passes as whitelisted language', () => {
    const frontmatter = {
      proposal_type: 'npc',
      title: 'A Lösweg archivist',
      source_prompt: 'Propose an NPC with Lösweg Sign.',
      visibility: 'dm-only',
      related: { factions: [], places: [] },
    }
    const body = `
## Role
An archivist.

## Stat Block
**Languages** Common, Lösweg Sign
`
    const result = validateProposalContent(frontmatter as any, body, 'npc')
    const languageFails = result.issues.filter((i) => /Language not in whitelist.*Lösweg Sign/i.test(i))
    expect(languageFails).toHaveLength(0)
  })

  it('non-whitelisted language warns', () => {
    const frontmatter = {
      proposal_type: 'npc',
      title: 'Mysterious stranger',
      source_prompt: 'Propose an NPC.',
      visibility: 'dm-only',
      related: { factions: [], places: [] },
    }
    const body = `
## Stat Block
**Languages** Common, Undercommon, Thieves Cant
`
    const result = validateProposalContent(frontmatter as any, body, 'npc')
    const languageWarns = result.issues.filter((i) => /Language not in whitelist/i.test(i))
    // Undercommon and Thieves Cant are not in the canonical whitelist
    expect(languageWarns.length).toBeGreaterThan(0)
  })
})

// ── Pass 7 regression tests ───────────────────────────────────────────────────

describe('Pass 7: title-prefixed allowlist matches', () => {
  it('Jarl Mathr in Beorn proposal does not trigger character conflict via title-stripped allowlist', () => {
    const frontmatter = {
      proposal_type: 'npc',
      id: 'proposals/test-beorn-jarl-mathr',
      title: 'Jarl Beorn',
      status: 'proposed',
      canonical: 'provisional',
      visibility: 'dm-only',
      source_prompt: 'Propose a new NPC: Jarl Beorn.',
      corpus_named: true,
      corpus_anchor_entity: 'npcs/jarl-beorn',
      corpus_policy_id: 'npcs/jarl-beorn',
      promote_target: 'corpus/planning/npcs',
      summary: 'Jarl Beorn.',
      route_profile: 'npc-design',
      related: { factions: [], places: [], npcs: [], chapters: [], sessions: [], items: [] },
    }
    // "Jarl Mathr" (title-prefixed) should match via stripped "Mathr" → allowlisted jarl-mathr
    const body = `# NPC: Jarl Beorn

## can_know
- Jarl Mathr has served on the council for sixty years.

## must_not_know
- Jarl Mathr has deceived him for sixty years.

## Lines to Inhabit
- "Show me the evidence."

## Dramatic Utility
Political pressure.

## player_safe
Trusted figure.

## dm_only
Misled by Jarl Mathr.
`
    const result = validateProposalContent(frontmatter, body, 'npc')
    const mathrConflict = result.issues.filter((i) => /character conflict/i.test(i) && /Mathr/i.test(i))
    expect(mathrConflict).toHaveLength(0)
  })
})

// ── Section 2: style-guards.yaml loader tests ─────────────────────────────────

describe('styleGuardsLoader — YAML is the source of truth', () => {
  afterEach(() => { clearStyleGuardsCacheForTests() })

  it('loads sentence boundary pronouns from YAML', () => {
    const pronouns = getSentenceBoundaryPronouns()
    expect(pronouns.has('He')).toBe(true)
    expect(pronouns.has('They')).toBe(true)
    expect(pronouns.has('Himself')).toBe(true)
    expect(pronouns.has('Which')).toBe(true)
    expect(pronouns.size).toBeGreaterThanOrEqual(30)
  })

  it('loads common noun skips from YAML', () => {
    const nouns = getCommonNounSkips()
    expect(nouns.has('Fog')).toBe(true)
    expect(nouns.has('Stone')).toBe(true)
    expect(nouns.has('River')).toBe(true)
    expect(nouns.has('Shadow')).toBe(true)
  })

  it('loads title tokens from YAML', () => {
    const tokens = getTitleTokens()
    expect(tokens.has('King')).toBe(true)
    expect(tokens.has('Jarl')).toBe(true)
    expect(tokens.has('Truthspeaker')).toBe(true)
  })

  it('loads cosmological force names from YAML', () => {
    const forces = getCosmologicalForceNames()
    expect(forces.has('Vishara')).toBe(true)
    expect(forces.has('Maharuq')).toBe(true)
    expect(forces.has('Yantravaq')).toBe(true)
  })

  it('loads generic single word skips from YAML', () => {
    const skips = getGenericSingleWordSkips()
    expect(skips.has('Gate')).toBe(true)
    expect(skips.has('Harbour')).toBe(true)
    expect(skips.has('Council')).toBe(true)
  })

  it('loads org type suffixes from YAML', () => {
    const suffixes = getOrgTypeSuffixes()
    expect(suffixes.has('Guild')).toBe(true)
    expect(suffixes.has('Council')).toBe(true)
    expect(suffixes.has('Fellowship')).toBe(true)
    expect(suffixes.has('House')).toBe(false)
  })

  it('loads org stop words from YAML', () => {
    const stops = getOrgStopWords()
    expect(stops.has('the')).toBe(true)
    expect(stops.has('of')).toBe(true)
    expect(stops.has('their')).toBe(true)
  })

  it('builds title token alternation string from YAML', () => {
    const alt = getTitleTokenAlternation()
    expect(alt).toContain('King')
    expect(alt).toContain('Jarl')
    expect(alt).toContain('Truthspeaker')
    // Should be usable in a regex
    const re = new RegExp(`^(${alt})$`, 'i')
    expect(re.test('King')).toBe(true)
    expect(re.test('Jarl')).toBe(true)
    expect(re.test('Smith')).toBe(false)
  })
})
