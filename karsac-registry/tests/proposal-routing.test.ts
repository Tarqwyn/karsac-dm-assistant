import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { mkdirSync, readFileSync, rmSync } from 'fs'
import { resolve } from 'path'
import matter from 'gray-matter'
import { detectProposalExecutionPlan, profileForExplicitType } from '../src/proposals/proposalRouting.js'
import {
  detectCorpusAnchorForProposal,
} from '../src/proposals/proposalEntityRegistry.js'
import { buildConstrainedProposalPrompt } from '../src/proposals/proposalConstraints.js'
import { writeProposal } from '../src/proposals/proposalWriter.js'
import { summariseProposal } from '../src/proposals/proposalSummary.js'
import { validateProposalContent } from '../src/proposals/proposalValidator.js'
import type { ProposalFrontmatter } from '../src/proposals/proposalTypes.js'

const TEMP_DIR = resolve('/tmp/karsac-proposal-routing-tests')

beforeAll(() => {
  mkdirSync(TEMP_DIR, { recursive: true })
})

afterAll(() => {
  rmSync(TEMP_DIR, { recursive: true, force: true })
})

function makeNpcFrontmatter(overrides: Partial<ProposalFrontmatter> = {}): ProposalFrontmatter {
  return {
    id: 'proposals/npcs/losweg-road-warden',
    proposal_type: 'npc',
    title: 'Lösweg Road Warden',
    status: 'proposed',
    canonical: 'provisional',
    visibility: 'dm-only',
    created_at: new Date().toISOString(),
    source_prompt: 'Propose a new NPC: a Lösweg road warden stationed on the fjord road north of the Bay of Whales coast.',
    route_profile: 'npc-design',
    validation: { status: 'pass', issues: [] },
    related: { chapters: [], sessions: [], factions: [], places: [], npcs: [], items: [] },
    promote_target: 'corpus/planning/npcs',
    summary: 'A road warden who keeps order, watches travellers, and knows who should not be on the fjord road.',
    ...overrides,
  }
}

const VALID_NPC_BODY = `# NPC: Lösweg Road Warden

## Role
A local road warden who watches the fjord road north of the Bay of Whales coast, checks traffic, and decides who is worth delaying.

## Physical Bearing
Broad-shouldered, weather-cut, and always standing as if they expect trouble to come from the next bend in the road.

## What They Want
They want the road to stay predictable, the settlements to stay supplied, and suspicious travellers to show their hand before they reach Lösweg.

## What They Hide
They quietly let some smugglers pass because cutting one private bargain is easier than fighting three open enemies at once.

## can_know
- Which merchant caravans are late, missing, or travelling under strained cover.
- Which local captain is quietly under pressure from coastal raiders.

## must_not_know
- The deeper cosmological truth behind recent roadside omens.
- The hidden sponsor behind a sealed cargo movement tied to a higher conspiracy.

## Lines to Inhabit
- "Road's open if your story is. Start with the story."
- "A wet cloak proves nothing. Mud on the boots tells me more."
- "If you're in a hurry, give me a reason that can survive a second question."

## Dramatic Utility
Use the road warden to slow the party down, reveal travel pressure, offer a grounded local read on the coast, or become an obstacle whose respect can be won.

## player_safe
Players see a disciplined local officer with a practical eye, a memory for faces, and the patience to let silence do half the work.

## dm_only
The warden is compromise-prone rather than corrupt: they will bend procedure to keep the road stable, but they fear becoming responsible for a larger disaster they do not understand.

## Corpus Frontmatter
\`\`\`yaml
related:
  factions: []
  places: [losweg]
summary: "A local road warden who controls passage, notices lies, and can either obstruct or quietly help the party."
\`\`\`
`

describe('proposal routing precedence', () => {
  it('explicit NPC opener beats place-context nouns', () => {
    const plan = detectProposalExecutionPlan(
      'Propose a new NPC: a Lösweg road warden stationed on the fjord road north of the Bay of Whales coast.',
    )

    expect(plan.proposalType).toBe('npc')
    expect(plan.proposalProfile).toBe('npc-design')
    expect(plan.explicitType).toBe(true)
    expect(plan.routeReason).toContain('explicit opening proposal type: npc')
  })

  it('other explicit openers keep their own proposal type', () => {
    expect(detectProposalExecutionPlan('Propose a new adversary: a Shadow Walker urban variant in a city.').proposalType).toBe('adversary')
    expect(detectProposalExecutionPlan('Propose a new place: Fiska, a market town with suspicious officials.').proposalType).toBe('place')
    expect(detectProposalExecutionPlan('Propose a new encounter on the fjord road near Valweg.').proposalType).toBe('encounter')
  })

  it('canonical named NPC proposals route through corpus-anchor injection', () => {
    const anchor = detectCorpusAnchorForProposal('npc', 'Propose a new NPC: Jarl Beorn in the council chamber.')
    expect(anchor.corpusNamed).toBe(true)
    expect(anchor.entity?.id).toBe('npcs/jarl-beorn')
    const prompt = buildConstrainedProposalPrompt({
      proposalType: 'npc',
      prompt: 'Propose a new NPC: Jarl Beorn in the council chamber.',
      corpusAnchor: anchor,
    })
    expect(prompt).toContain('CORPUS-ANCHOR CONSTRAINT')
    expect(prompt).toContain('This npc is named in existing corpus.')
    expect(prompt).toContain('Brynja')
  })

  it('canonical stub-level place proposals route through stub constraint injection', () => {
    const anchor = detectCorpusAnchorForProposal('place', 'Propose a new place: Sea of Karsac.')
    expect(anchor.corpusNamed).toBe(true)
    expect(anchor.stubLevel).toBe(true)
    const prompt = buildConstrainedProposalPrompt({
      proposalType: 'place',
      prompt: 'Propose a new place: Sea of Karsac.',
      corpusAnchor: anchor,
    })
    expect(prompt).toContain('Do not invent geography, rivers, districts, landmarks')
  })
})

describe('npc proposal packet', () => {
  it('writes to the npc proposal folder and renders NPC sections in the final summary', async () => {
    const root = resolve(TEMP_DIR, 'npc-packet')
    mkdirSync(root, { recursive: true })
    const frontmatter = makeNpcFrontmatter()
    const writeResult = writeProposal(root, 'npc', 'Lösweg Road Warden', frontmatter, VALID_NPC_BODY)
    const parsed = matter(readFileSync(writeResult.path, 'utf-8'))

    expect(writeResult.path).toContain('/npcs/')
    expect(parsed.data.proposal_type).toBe('npc')
    expect(parsed.data.route_profile).toBe('npc-design')

    const validation = validateProposalContent(parsed.data as Record<string, unknown>, parsed.content, 'npc')
    expect(validation.valid).toBe(true)

    const summary = await summariseProposal({ proposalPath: writeResult.path })

    expect(summary.renderer).toBe('npc')
    expect(summary.humanMarkdown).toContain('# Proposal: Lösweg Road Warden')
    expect(summary.humanMarkdown).toContain('## Name')
    expect(summary.humanMarkdown).toContain('## Role')
    expect(summary.humanMarkdown).toContain('## Physical Bearing')
    expect(summary.humanMarkdown).toContain('## What They Want')
    expect(summary.humanMarkdown).toContain('## What They Hide')
    expect(summary.humanMarkdown).toContain('## can_know')
    expect(summary.humanMarkdown).toContain('## must_not_know')
    expect(summary.humanMarkdown).toContain('## Lines to Inhabit')
    expect(summary.humanMarkdown).toContain('## Dramatic Utility')
    expect(summary.humanMarkdown).toContain('## player_safe')
    expect(summary.humanMarkdown).toContain('## dm_only')
    expect(summary.humanMarkdown).not.toContain('## Geography and Layout')
    expect(summary.humanMarkdown).not.toContain('# Place:')
  })
})

// ── Pass 3 regression tests ───────────────────────────────────────────────────

import { mkdirSync as mkdirSyncP3, writeFileSync as writeFileSyncP3, existsSync as existsSyncP3 } from 'fs'
import { resolve as resolveP3 } from 'path'
import {
  loadProvisionalEntityRegister,
  clearProposalEntityRegistryCachesForTests,
} from '../src/proposals/proposalEntityRegistry.js'
import { PROPOSALS_ROOT } from '../src/paths.js'

describe('Pass 3: stub-level place receives explicit prohibition constraint', () => {
  it('stub-level place anchor generates explicit prohibition lines', () => {
    // Simulate a stub-level place anchor by creating a minimal constraint input
    // buildConstrainedProposalPrompt is already imported at the top of this file
    const prompt = buildConstrainedProposalPrompt({
      proposalType: 'place',
      prompt: 'Propose a new place: Valweg.',
      corpusAnchor: {
        corpusNamed: true,
        proposalType: 'place',
        subjectName: 'Valweg',
        entity: { id: 'places/valweg', type: 'place', title: 'Valweg', path: '', summary: 'Council city in Lösweg.', aliases: [], tags: [], related: {}, doNotConfuseWith: [], collection: '' },
        stubLevel: true,
        coverageLevel: 'stub',
        policy: null,
        exactSnippets: ['Valweg is the council city of Lösweg, deep in the fjords.'],
      },
    })
    expect(prompt).toContain('Do not invent geography, rivers, districts, landmarks')
    expect(prompt).toContain('A correct minimal proposal is preferable to a detailed invented one')
    expect(prompt).not.toContain('Stub level only unless corpus contains sufficient detail')
  })
})

// ── detectProposalExecutionPlan — all three branches ─────────────────────────

describe('detectProposalExecutionPlan — explicit --type parameter branch', () => {
  it('uses explicit type and sets explicitType: true', () => {
    const plan = detectProposalExecutionPlan('a Shadow Walker operative in the docks', 'adversary')
    expect(plan.proposalType).toBe('adversary')
    expect(plan.proposalProfile).toBe('adversary-design')
    expect(plan.explicitType).toBe(true)
    expect(plan.routeReason).toBe('explicit --type')
  })

  it('collects adversary matched terms when explicit type is adversary', () => {
    const plan = detectProposalExecutionPlan('stat block for a new adversary', 'adversary')
    expect(plan.adversaryMatchedTerms.length).toBeGreaterThan(0)
    expect(plan.placeMatchedTerms).toHaveLength(0)
  })

  it('collects place matched terms when explicit type is place', () => {
    const plan = detectProposalExecutionPlan('a new market town near the fjord', 'place')
    expect(plan.proposalType).toBe('place')
    expect(plan.placeMatchedTerms.length).toBeGreaterThan(0)
    expect(plan.adversaryMatchedTerms).toHaveLength(0)
  })

  it('sets no matched terms for non-place non-adversary explicit types', () => {
    const plan = detectProposalExecutionPlan('a new handout for the party', 'handout')
    expect(plan.proposalType).toBe('handout')
    expect(plan.placeMatchedTerms).toHaveLength(0)
    expect(plan.adversaryMatchedTerms).toHaveLength(0)
    expect(plan.explicitType).toBe(true)
  })
})

describe('detectProposalExecutionPlan — prompt-detected explicit type branch', () => {
  it('detects "Propose a new NPC" opening and sets explicitType: true', () => {
    const plan = detectProposalExecutionPlan('Propose a new NPC: a market vendor in Valweg.')
    expect(plan.proposalType).toBe('npc')
    expect(plan.explicitType).toBe(true)
    expect(plan.routeReason).toContain('explicit opening proposal type: npc')
  })

  it('detects "Propose a new scene" and routes correctly', () => {
    const plan = detectProposalExecutionPlan('Propose a new scene: the arrival at the docks.')
    expect(plan.proposalType).toBe('scene')
    expect(plan.explicitType).toBe(true)
  })

  it('detects "Propose a new chapter outline" and routes correctly', () => {
    const plan = detectProposalExecutionPlan('Propose a new chapter outline for chapter 3.')
    expect(plan.proposalType).toBe('chapter-outline')
    expect(plan.explicitType).toBe(true)
  })

  it('captures contextProfile from router even for explicit openers', () => {
    const plan = detectProposalExecutionPlan('Propose a new NPC: how do saving throws work?')
    expect(plan.proposalType).toBe('npc')
    // contextProfile comes from routeQuestion — may differ from proposalProfile
    expect(plan.contextProfile).toBeDefined()
  })
})

describe('detectProposalExecutionPlan — route-based detection branch', () => {
  it('returns explicitType: false for unstructured prompts', () => {
    const plan = detectProposalExecutionPlan('design an encounter at the docks')
    expect(plan.explicitType).toBe(false)
  })

  it('routes to place when place-indicator terms present and no explicit type', () => {
    const plan = detectProposalExecutionPlan('a new settlement, market town with a harbour and population of traders')
    expect(plan.proposalType).toBe('place')
    expect(plan.proposalProfile).toBe('place-design')
    expect(plan.placeMatchedTerms.length).toBeGreaterThan(0)
  })

  it('routes to chapter-outline for prompts containing "chapter outline"', () => {
    const plan = detectProposalExecutionPlan('a chapter outline covering the road to Valweg')
    expect(plan.proposalType).toBe('chapter-outline')
  })

  it('proposalProfile falls back to route profile for non-place non-adversary non-encounter types', () => {
    const plan = detectProposalExecutionPlan('a chapter outline for the campaign')
    expect(plan.proposalType).toBe('chapter-outline')
    // Profile is whatever the router returns — not one of the three specialist profiles
    expect(['place-design', 'adversary-design', 'encounter-design']).not.toContain(plan.proposalProfile)
  })

  it('routes to adversary with adversary-design profile when body has adversary signals', () => {
    const plan = detectProposalExecutionPlan('stat block and traits and actions for a new adversary')
    expect(plan.proposalType).toBe('adversary')
    expect(plan.proposalProfile).toBe('adversary-design')
    expect(plan.explicitType).toBe(false)
    expect(plan.adversaryMatchedTerms.length).toBeGreaterThan(0)
  })
})

describe('profileForExplicitType — profile mapping', () => {
  it('maps adversary to adversary-design', () => {
    expect(profileForExplicitType('adversary')).toBe('adversary-design')
  })
  it('maps encounter to encounter-design', () => {
    expect(profileForExplicitType('encounter')).toBe('encounter-design')
  })
  it('maps npc to npc-design', () => {
    expect(profileForExplicitType('npc')).toBe('npc-design')
  })
  it('maps place to place-design', () => {
    expect(profileForExplicitType('place')).toBe('place-design')
  })
  it('maps chapter-outline to state', () => {
    expect(profileForExplicitType('chapter-outline')).toBe('state')
  })
  it('maps unknown types to state', () => {
    expect(profileForExplicitType('handout')).toBe('state')
  })
})

describe('Pass 3: _rejected/ directory excluded from provisional entity register', () => {
  const REJECTED_DIR = resolveP3(PROPOSALS_ROOT, '_rejected', 'adversaries')

  afterEach(() => {
    clearProposalEntityRegistryCachesForTests()
    try {
      const { rmSync } = require('fs')
      rmSync(resolveP3(PROPOSALS_ROOT, '_rejected'), { recursive: true, force: true })
    } catch {}
  })

  it('entities in _rejected/ do not appear in the provisional entity register', () => {
    mkdirSyncP3(REJECTED_DIR, { recursive: true })
    writeFileSyncP3(
      resolveP3(REJECTED_DIR, 'silent-hand.proposed.md'),
      `---
id: proposals/adversaries/silent-hand
proposal_type: adversary
title: Silent Hand
status: proposed
canonical: provisional
visibility: dm-only
created_at: '2026-06-02T00:00:00.000Z'
source_prompt: 'Propose a new adversary: Silent Hand.'
route_profile: adversary-design
validation:
  status: fail
  issues: []
related:
  factions: []
promote_target: corpus/adversary-corpus/karsac-adversaries
summary: Silent Hand — rejected proposal
---

# Adversary: Silent Hand

## DM-Only Notes
This is a rejected proposal with invented content.
`,
    )

    const register = loadProvisionalEntityRegister()
    const silentHandEntry = register.find((e) => e.normalizedName === 'silent hand')
    expect(silentHandEntry).toBeUndefined()
  })
})
