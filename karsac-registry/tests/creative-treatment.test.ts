import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  applyCreativeTreatment,
  compareRequiredSectionsBeforeAfter,
  mergeCreativeTreatmentSections,
} from '../src/creativeTreatment/applyCreativeTreatment.js'
import * as creativeModel from '../src/creativeTreatment/creativeModel.js'
import { getCreativeTreatmentContract } from '../src/creativeTreatment/treatmentContracts.js'
import { buildCreativeTreatmentMessages } from '../src/creativeTreatment/treatmentPrompts.js'
import { creativeTreatmentQualityCheck, validateCreativeTreatment, validateAnchorBoundedContent } from '../src/creativeTreatment/treatmentValidator.js'
import { getProposalEntityPolicy } from '../src/proposals/proposalEntityPolicies.js'
import { policyFilteredSections } from '../src/proposals/proposalValidator.js'
import {
  creativeTreatmentEnabled,
  getCreativeGenerationSettings,
  getCreativeRetryGenerationSettings,
  getCreativeModel,
  getDraftGenerationSettings,
  getDraftModel,
  getRulesGenerationSettings,
  getSummaryGenerationSettings,
} from '../src/modelSettings.js'

const ORIGINAL_ENV = {
  KARSAC_ENABLE_CREATIVE_TREATMENT: process.env.KARSAC_ENABLE_CREATIVE_TREATMENT,
  KARSAC_DRAFT_MODEL: process.env.KARSAC_DRAFT_MODEL,
  KARSAC_CREATIVE_MODEL: process.env.KARSAC_CREATIVE_MODEL,
  KARSAC_TREATMENT_MODEL: process.env.KARSAC_TREATMENT_MODEL,
  KARSAC_DOCTRINE_MODEL: process.env.KARSAC_DOCTRINE_MODEL,
  KARSAC_DRAFT_TEMPERATURE: process.env.KARSAC_DRAFT_TEMPERATURE,
  KARSAC_DRAFT_TOP_P: process.env.KARSAC_DRAFT_TOP_P,
  KARSAC_CREATIVE_TEMPERATURE: process.env.KARSAC_CREATIVE_TEMPERATURE,
  KARSAC_CREATIVE_TOP_P: process.env.KARSAC_CREATIVE_TOP_P,
  KARSAC_CREATIVE_RETRY_TEMPERATURE: process.env.KARSAC_CREATIVE_RETRY_TEMPERATURE,
  KARSAC_CREATIVE_RETRY_TOP_P: process.env.KARSAC_CREATIVE_RETRY_TOP_P,
  KARSAC_RULES_TEMPERATURE: process.env.KARSAC_RULES_TEMPERATURE,
  KARSAC_RULES_TOP_P: process.env.KARSAC_RULES_TOP_P,
  KARSAC_SUMMARY_TEMPERATURE: process.env.KARSAC_SUMMARY_TEMPERATURE,
  KARSAC_SUMMARY_TOP_P: process.env.KARSAC_SUMMARY_TOP_P,
  OLLAMA_MODEL: process.env.OLLAMA_MODEL,
}

afterEach(() => {
  vi.restoreAllMocks()
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

describe('modelSettings', () => {
  it('uses per-task temperature settings from env', () => {
    process.env.KARSAC_DRAFT_TEMPERATURE = '0.61'
    process.env.KARSAC_DRAFT_TOP_P = '0.91'
    process.env.KARSAC_CREATIVE_TEMPERATURE = '0.95'
    process.env.KARSAC_CREATIVE_TOP_P = '0.93'
    process.env.KARSAC_RULES_TEMPERATURE = '0.22'
    process.env.KARSAC_RULES_TOP_P = '0.81'
    process.env.KARSAC_SUMMARY_TEMPERATURE = '0.66'
    process.env.KARSAC_SUMMARY_TOP_P = '0.89'

    expect(getDraftGenerationSettings()).toEqual({ temperature: 0.61, topP: 0.91 })
    expect(getCreativeGenerationSettings()).toEqual({ temperature: 0.95, topP: 0.93 })
    expect(getRulesGenerationSettings()).toEqual({ temperature: 0.22, topP: 0.81 })
    expect(getSummaryGenerationSettings()).toEqual({ temperature: 0.66, topP: 0.89 })
  })

  it('falls back from creative model to draft model', () => {
    process.env.KARSAC_DRAFT_MODEL = 'gemma3:12b'
    process.env.KARSAC_CREATIVE_MODEL = ''
    process.env.KARSAC_TREATMENT_MODEL = ''
    process.env.KARSAC_DOCTRINE_MODEL = ''
    process.env.OLLAMA_MODEL = 'llama3'

    expect(getDraftModel()).toBe('gemma3:12b')
    expect(getCreativeModel()).toBe('gemma3:12b')
  })

  it('reads creative treatment enablement from env', () => {
    process.env.KARSAC_ENABLE_CREATIVE_TREATMENT = 'true'
    expect(creativeTreatmentEnabled()).toBe(true)
  })

  it('uses the lowered default creative settings and retry settings', () => {
    delete process.env.KARSAC_CREATIVE_TEMPERATURE
    delete process.env.KARSAC_CREATIVE_TOP_P
    delete process.env.KARSAC_CREATIVE_RETRY_TEMPERATURE
    delete process.env.KARSAC_CREATIVE_RETRY_TOP_P

    expect(getCreativeGenerationSettings()).toEqual({ temperature: 0.85, topP: 0.9 })
    expect(getCreativeRetryGenerationSettings()).toEqual({ temperature: 0.75, topP: 0.85 })
  })
})

describe('creative treatment contracts', () => {
  it('defines doctrine sections for adversaries', () => {
    const contract = getCreativeTreatmentContract('adversary')
    expect(contract?.requiredSections).toContain('## Doctrine')
    expect(contract?.requiredSections).toContain('## Behavioural Stages')
    expect(contract?.requiredSections).toContain('## Tactical Notes')
    expect(contract?.editableSections).not.toContain('## Doctrine-Expressive Mechanics')
  })

  it('defines cultural identity sections for places', () => {
    const contract = getCreativeTreatmentContract('place')
    expect(contract?.requiredSections).toContain('## Cultural Identity')
    expect(contract?.requiredSections).toContain('## What This Place Hides')
  })

  it('builds a prompt that preserves locked constraints', () => {
    const messages = buildCreativeTreatmentMessages({
      proposalType: 'encounter',
      draftMarkdown: '# Encounter: Test\n\n## Encounter Type\nSocial',
      sourcePrompt: 'Propose a non-combat dock encounter in Valweg using Mathr agents.',
      lockedConstraints: {
        proposalType: 'encounter',
        title: 'Test',
        lockedFaction: 'mathr',
        forbiddenFactions: ['vishara'],
        canonicalStatus: 'provisional',
        promoteTarget: 'corpus/planning/scenes',
        routeProfile: 'encounter-design',
      },
    })

    expect(messages[1].content).toContain('locked faction: mathr')
    expect(messages[1].content).toContain('forbidden factions: vishara')
    expect(messages[1].content).toContain('Story Beat')
    expect(messages[0].content).toContain('Return ONLY the editable sections')
  })

  it('includes Shadow Walker urban doctrine-survivability mechanics guidance for adversaries', () => {
    const messages = buildCreativeTreatmentMessages({
      proposalType: 'adversary',
      draftMarkdown: `# Adversary: Weaver

## Doctrine
They retreat when exposed.

## Doctrine Under Pressure
- Break contact fast.
`,
      sourcePrompt: 'Propose a Shadow Walker urban variant for Karsac cities and harbours.',
      lockedConstraints: {
        proposalType: 'adversary',
        title: 'Weaver',
        lockedFaction: 'shadow-walkers',
        forbiddenFactions: ['mathr'],
        canonicalStatus: 'provisional',
        promoteTarget: 'corpus/adversary-corpus/karsac-adversaries',
        routeProfile: 'adversary-design',
        preferredMechanicalBase: 'spy',
      },
    })

    expect(messages[1].content).toContain('Mapped Exits')
    expect(messages[1].content).toContain('Crowd Break')
    expect(messages[1].content).toContain('Information First')
    expect(messages[1].content).toContain('No Last Stand')
    expect(messages[1].content).toContain('TypeScript deterministic repair will materialise')
    expect(messages[1].content).toContain('Do not write Charisma (Insight)')
    expect(messages[1].content).toContain('Do not add or rewrite Stat Block mechanics')
    expect(messages[1].content).not.toContain('- ## Doctrine-Expressive Mechanics')
  })
})

describe('creative treatment validation', () => {
  it('fails when treated adversary output is missing doctrine sections', () => {
    const result = validateCreativeTreatment('adversary', '# Adversary: Veilstrider\n\n## Stat Block\n...')
    expect(result.valid).toBe(false)
    expect(result.issues.some((issue) => issue.includes('## Doctrine'))).toBe(true)
  })

  it('passes when place treatment sections are present', () => {
    const markdown = `# Place: Fiska

## Cultural Identity
Tide-facing pragmatism.

## Daily Life
Harbour work sets the rhythm.

## Power Structures
Merchants and tidewardens compete.

## Local Contradiction
The town sells openness and practices suspicion.

## What Outsiders Misunderstand
Visitors think the silence means obedience.

## What This Place Hides
Debt records and quiet leverage.

## Player-Safe Arrival Description
Salt, wet rope, and gull-noise greet the party.`
    expect(validateCreativeTreatment('place', markdown).valid).toBe(true)
  })

  it('fails the quality gate on corrupted mixed-language prose', () => {
    const markdown = `# Adversary: Weaver

## Doctrine
They observe and withdraw cleanly.

## Doctrine Under Pressure
merchants-toggler or passers kvinn while createComponent VLAN slips through.

## Behavioural Stages
Stage one: bystanders clear a route.

## Tactical Notes
Жар 市場 easeBitFields.

## Doctrine-Expressive Mechanics
- Mapped Exits expresses pre-planned movement.

## Player-Safe Description
The crowd parts in a way that feels createComponent wrong.

## DM-Only Notes
Quiet extraction pressure.`
    const result = creativeTreatmentQualityCheck('adversary', markdown)

    expect(result.valid).toBe(false)
    expect(result.issues.some((issue) => issue.includes('corrupted code-like fragment'))).toBe(true)
    expect(result.issues.some((issue) => issue.includes('unexpected non-Latin script'))).toBe(true)
  })
})

// ── Pass 6 regression tests ───────────────────────────────────────────────────

describe('Pass 6: policy-aware creative treatment validation', () => {
  it('effective_required subtracts forbidden_expansion_fields for stub entity (Maret)', () => {
    const policy = getProposalEntityPolicy('npcs/maret')
    expect(policy).not.toBeNull()
    // NPC contract requires Public Face, Private Want, Fear — all forbidden for Maret
    const markdown = `# NPC: Maret

## Role
A minor figure in Lösweg.

## player_safe
Little is known.

## dm_only
Unresolved.

## Ambiguities
- No further characterisation available.
`
    const result = validateCreativeTreatment('npc', markdown, policy)
    // Public Face, Private Want, Fear are forbidden by policy — must NOT fail for their absence
    expect(result.valid).toBe(true)
    expect(result.missingSections).toHaveLength(0)
  })

  it('effective_required subtracts forbidden sections for anchored entity (Beorn)', () => {
    const policy = getProposalEntityPolicy('npcs/jarl-beorn')
    expect(policy).not.toBeNull()
    const markdown = `# NPC: Jarl Beorn

## Role
Council leader.

## can_know
- Dugweb's visit.

## must_not_know
- Mathr's deception.

## Lines to Inhabit
- "Say it plainly."

## Dramatic Utility
Political pressure.

## player_safe
A tired ruler.

## dm_only
Misled for decades.
`
    const result = validateCreativeTreatment('npc', markdown, policy)
    expect(result.valid).toBe(true)
    expect(result.missingSections).toHaveLength(0)
  })

  it('per-section corpus anchor text injected into prompt for canonical_reference_only entity', () => {
    const policy = getProposalEntityPolicy('npcs/jarl-beorn')
    expect(policy?.canonicalReferenceOnly).toBe(true)

    const messages = buildCreativeTreatmentMessages({
      proposalType: 'npc',
      draftMarkdown: `# NPC: Jarl Beorn\n\n## Public Face\nDraft.\n\n## Private Want\nDraft.\n\n## Fear\nDraft.`,
      sourcePrompt: 'Propose NPC Jarl Beorn.',
      lockedConstraints: { proposalType: 'npc', title: 'Jarl Beorn' },
      entityPolicy: policy,
      corpusContext: `## Role\nCouncil leader at Valweg.\n\n## Public Face\nHe appears decisive.`,
    })

    const userContent = messages.find((m) => m.role === 'user')?.content ?? ''
    expect(userContent).toContain('canonical reference-only entity')
    expect(userContent).toContain('corpus anchor text')
  })

  it('validateAnchorBoundedContent flags proper-noun phrases absent from corpus anchor', () => {
    const corpusAnchor = `## Cultural Identity\nA coastal town. Salt trade dominates. The harbour watch controls access.`
    const generatedMarkdown = `## Cultural Identity\nThe Stone Gate watches over Mariner's Rest. Grey Wolves patrol Shadowfen.`

    const result = validateAnchorBoundedContent('place', generatedMarkdown, corpusAnchor)
    // WARNs are produced but valid stays true (no FAIL-level issues for non-org proper nouns)
    expect(result.issues.length).toBeGreaterThan(0)
    // Invented named things should be flagged
    const flagged = result.issues.map((i) => i)
    expect(flagged.some((i) => i.includes('Stone Gate') || i.includes('Mariner') || i.includes('Grey Wolves'))).toBe(true)
  })

  it('validateAnchorBoundedContent FAIL on unsupported organisation name', () => {
    const corpusAnchor = `Valweg is a city of dark timber and fire-lit mead halls. The inner council governs.`
    const generatedMarkdown = `## DM Notes\nMariner's Guild has its own ambitions and acts independently of the council.`

    const result = validateAnchorBoundedContent('place', generatedMarkdown, corpusAnchor)
    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.startsWith('FAIL:') && i.includes("Mariner"))).toBe(true)
  })

  it('validateAnchorBoundedContent allows Provisional-marked org name as WARN not FAIL', () => {
    const corpusAnchor = `Valweg is a city of dark timber and fire-lit mead halls.`
    const generatedMarkdown = `## DM Notes\nProvisional: Mariner's Guild may be active here — define only if needed.`

    const result = validateAnchorBoundedContent('place', generatedMarkdown, corpusAnchor)
    // Provisional-marked org name should not produce a FAIL
    expect(result.issues.every((i) => !i.startsWith('FAIL:'))).toBe(true)
  })

  it('validateAnchorBoundedContent passes when all named phrases are in corpus anchor', () => {
    const corpusAnchor = `## Cultural Identity\nThe Harbour Watch controls the Salt Gate. The Council meets at Valweg Hall.`
    const generatedMarkdown = `## Cultural Identity\nThe Harbour Watch guards the Salt Gate approach. The Council at Valweg Hall holds authority.`

    const result = validateAnchorBoundedContent('place', generatedMarkdown, corpusAnchor)
    expect(result.valid).toBe(true)
    expect(result.issues).toHaveLength(0)
  })

  it('policyFilteredSections suppresses Factions warning when Factions and Power Structures is forbidden', () => {
    // If policy forbids "Factions and Power Structures" (which gets pruned),
    // the structural validator must not warn that "Factions" is missing.
    const mockPolicy = {
      entityId: 'places/valweg',
      coverageLevel: 'bounded' as const,
      proposalScope: 'bounded' as const,
      canonicalReferenceOnly: true,
      unresolvedFieldsPreferred: false,
      allowedSections: [],
      forbiddenSections: ['Factions and Power Structures', 'Key Districts', 'Notable Landmarks'],
      promptConstraints: [],
      ambiguityFlags: [],
      requireAmbiguitySection: false,
      forbiddenPatterns: [],
    }
    const required = ['## Overview', '## Geography', '## Key Districts', '## Factions']
    const filtered = policyFilteredSections(required, mockPolicy)
    // "## Factions" should be suppressed because "Factions and Power Structures" is forbidden
    expect(filtered).not.toContain('## Factions')
    // "## Key Districts" should be suppressed (directly forbidden)
    expect(filtered).not.toContain('## Key Districts')
    // "## Overview" and "## Geography" should remain
    expect(filtered).toContain('## Overview')
    expect(filtered).toContain('## Geography')
  })

  it('Beorn still passes creative treatment validation with entity policy', () => {
    const policy = getProposalEntityPolicy('npcs/jarl-beorn')
    const markdown = `# NPC: Jarl Beorn\n\n## Role\nCouncil leader.\n\n## can_know\n- Dugweb's visit.\n\n## must_not_know\n- Mathr's deception.\n\n## Lines to Inhabit\n- "Show me the evidence."\n\n## Dramatic Utility\nPolitical pressure.\n\n## player_safe\nA trusted figure.\n\n## dm_only\nMisled for sixty years.`
    const result = validateCreativeTreatment('npc', markdown, policy)
    expect(result.valid).toBe(true)
    expect(result.missingSections).toHaveLength(0)
  })

  it('Maret still passes creative treatment validation with entity policy', () => {
    const policy = getProposalEntityPolicy('npcs/maret')
    const markdown = `# NPC: Maret\n\n## Role\nArchivist in Valweg.\n\n## player_safe\nDirects players to the archive.\n\n## dm_only\nNo further characterisation.`
    const result = validateCreativeTreatment('npc', markdown, policy)
    expect(result.valid).toBe(true)
    expect(result.missingSections).toHaveLength(0)
  })

  it('Dugweb still passes creative treatment validation with entity policy', () => {
    const policy = getProposalEntityPolicy('npcs/king-dugweb')
    const markdown = `# NPC: King Dugweb\n\n## Role\nHereditary head of Zörsdkog.\n\n## Dramatic Utility\nAncient authority.\n\n## player_safe\nElderly, carries Kurogane.\n\n## dm_only\nMathr manages every visit.\n\n## Ambiguities\n- Kurogane unexplained.`
    const result = validateCreativeTreatment('npc', markdown, policy)
    expect(result.valid).toBe(true)
    expect(result.missingSections).toHaveLength(0)
  })
})

// ── Pass 7 regression tests ───────────────────────────────────────────────────

describe('Pass 7: sentence strip, Provisional suppression, title-prefixed allowlist', () => {
  it('validateAnchorBoundedContent skips self-labelled Provisional sections entirely', () => {
    const corpusAnchor = `Valweg is a city of dark timber and fire-lit mead halls.`
    const markdown = `## Provisional Additions\nMariner's Guild has its own ambitions. The Lower Ward is a hub.`
    const result = validateAnchorBoundedContent('place', markdown, corpusAnchor)
    expect(result.issues).toHaveLength(0)
    expect(result.valid).toBe(true)
  })

  it('validateAnchorBoundedContent skips sections whose content opens with Provisional:', () => {
    const corpusAnchor = `Valweg is a city of dark timber.`
    const markdown = `## Optional Chapter Hooks\nProvisional: Fishmongers' Guild may be present here.`
    const result = validateAnchorBoundedContent('place', markdown, corpusAnchor)
    expect(result.issues).toHaveLength(0)
  })

  it('validateAnchorBoundedContent still flags non-Provisional invented org names', () => {
    const corpusAnchor = `Valweg is a city of dark timber.`
    const markdown = `## DM Notes\nThe Merchants' Guild controls the harbour.`
    const result = validateAnchorBoundedContent('place', markdown, corpusAnchor)
    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.startsWith('FAIL:'))).toBe(true)
  })
})

describe('applyCreativeTreatment', () => {
  it('merges editable sections without replacing protected adversary sections', () => {
    const draft = `# Adversary: Veilstrider

## Design Intent
Shadow Walker observer.

## Mechanical Base
Base: monsters/srd-2014/spy - Spy

## Adaptation Summary
- Kept from base: Sneak Attack

## Stat Block
**Armour Class** 12
**Challenge** 1

## Tactics
Observe first.

## Player-Safe Description
Old version.

## DM-Only Notes
Old note.

## Corpus Frontmatter
related:
  factions: [shadow-walkers]
`
    const patch = `## Doctrine
They solve the mission without becoming the problem.

## Tactical Notes
- Opening behaviour: observe first.

## Player-Safe Description
New player-safe text.
`

    const merged = mergeCreativeTreatmentSections(draft, patch, [
      '## Doctrine',
      '## Tactical Notes',
      '## Player-Safe Description',
      '## DM-Only Notes',
    ])

    expect(merged).toContain('## Stat Block')
    expect(merged).toContain('**Armour Class** 12')
    expect(merged).toContain('## Mechanical Base')
    expect(merged).toContain('## Doctrine')
    expect(merged).toContain('New player-safe text.')
  })

  it('detects if a required adversary section disappears after treatment', () => {
    const before = `# Adversary: Veilstrider

## Design Intent
Intent.

## Mechanical Base
Base.

## Adaptation Summary
Summary.

## Stat Block
Block.

## Variant Options
Choose 2.

## Tactics
Tactics.

## Social / Investigation Use
Use.

## Player-Safe Description
Player.

## DM-Only Notes
DM.

## Corpus Frontmatter
FM.
`
    const after = before.replace('## Stat Block', '## Missing Block')
    const issues = compareRequiredSectionsBeforeAfter('adversary', before, after)

    expect(issues).toContain('Creative treatment removed required section: ## Stat Block')
  })

  it('returns the draft unchanged when creative treatment is disabled', async () => {
    process.env.KARSAC_ENABLE_CREATIVE_TREATMENT = 'false'
    const draft = '# Chapter Outline: Test\n\n## Chapter Purpose\nPressure.'

    const result = await applyCreativeTreatment({
      proposalType: 'chapter-outline',
      draftMarkdown: draft,
      sourcePrompt: 'Draft a chapter outline.',
      lockedConstraints: {
        proposalType: 'chapter-outline',
        title: 'Test',
        canonicalStatus: 'provisional',
      },
    })

    expect(result.treatmentApplied).toBe(false)
    expect(result.treatedMarkdown).toBe(draft)
  })

  it('retries once on quality-gate failure and falls back to the draft if corruption persists', async () => {
    process.env.KARSAC_ENABLE_CREATIVE_TREATMENT = 'true'
    vi.spyOn(creativeModel, 'callCreativeTreatmentModel')
      .mockResolvedValueOnce({
        text: `## Doctrine
createComponent VLAN bystanders-toggler.

## Doctrine Under Pressure
bằng değerlendirme easeBitFields.

## Behavioural Stages
Stage one.

## Tactical Notes
reference Translation kvinn.

## Doctrine-Expressive Mechanics
- Mapped Exits expresses pre-planned movement.

## Player-Safe Description
merchants-toggler.

## DM-Only Notes
Quiet pressure.`,
        model: 'qwen3:14b',
      })
      .mockResolvedValueOnce({
        text: `## Doctrine
createComponent VLAN bystanders-toggler.

## Doctrine Under Pressure
bằng değerlendirme easeBitFields.

## Behavioural Stages
Stage one.

## Tactical Notes
reference Translation kvinn.

## Doctrine-Expressive Mechanics
- Mapped Exits expresses pre-planned movement.

## Player-Safe Description
merchants-toggler.

## DM-Only Notes
Quiet pressure.`,
        model: 'qwen3:14b',
      })

    const draft = `# Adversary: Weaver

## Design Intent
Observer.

## Mechanical Base
Base: monsters/srd-2014/spy

## Adaptation Summary
- Added doctrine.

## Doctrine
Old doctrine.

## Doctrine Under Pressure
Old pressure.

## Behavioural Stages
Old stages.

## Tactical Notes
Old notes.

## Doctrine-Expressive Mechanics
- Mapped Exits expresses pre-planned movement.

## Stat Block
**Armour Class** 12
**Hit Points** 27

## Tactics
Stay mobile.

## Social / Investigation Use
Observe.

## Player-Safe Description
Old player-safe text.

## DM-Only Notes
Old note.

## Corpus Frontmatter
related:
  factions: [shadow-walkers]
`

    const result = await applyCreativeTreatment({
      proposalType: 'adversary',
      draftMarkdown: draft,
      sourcePrompt: 'Propose a Shadow Walker urban variant.',
      lockedConstraints: {
        proposalType: 'adversary',
        title: 'Weaver',
        lockedFaction: 'shadow-walkers',
        forbiddenFactions: ['mathr'],
        preferredMechanicalBase: 'spy',
        canonicalStatus: 'provisional',
      },
    })

    expect(creativeModel.callCreativeTreatmentModel).toHaveBeenCalledTimes(2)
    expect(result.treatmentApplied).toBe(false)
    expect(result.treatedMarkdown).toBe(draft)
    expect(result.notes).toContain('Creative treatment failed quality gate and fallback used.')
  })
})
