import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdirSync, readFileSync, rmSync } from 'fs'
import { resolve } from 'path'
import matter from 'gray-matter'
import { detectProposalExecutionPlan } from '../src/proposals/proposalRouting.js'
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
  places: [losweg, bay-of-whales-coast]
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
