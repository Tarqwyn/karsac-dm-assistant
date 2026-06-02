import { readFileSync } from 'fs'
import { basename } from 'path'
import matter from 'gray-matter'
import type { ProposalType } from './proposalTypes.js'

export interface ProposalValidationResult {
  valid: boolean
  status: 'pass' | 'warning' | 'fail'
  issues: string[]
}

const CHAPTER_REQUIRED_SECTIONS = [
  '## Chapter Purpose',
  '## Starting State',
  '## Player Knowledge',
  '## Core Pressure',
  '## Scene Spine',
  '## End Conditions',
  '## Suggested State Updates After Play',
]

const ENCOUNTER_REQUIRED_SECTIONS = [
  '## Encounter Type',
  '## Campaign Purpose',
  '## Cast',
  '## Pressure Ladder',
  '## Checks and Mechanics',
  '## Outcomes',
]

const ADVERSARY_REQUIRED_SECTIONS = [
  '## Stat Block',
  '## Mechanical Base',
  '## Adaptation Summary',
  '## Tactics',
]

const NPC_REQUIRED_SECTIONS = [
  '## Role',
  '## Physical Bearing',
  '## What They Want',
  '## What They Hide',
  '## can_know',
  '## must_not_know',
  '## Lines to Inhabit',
  '## Dramatic Utility',
  '## player_safe',
  '## dm_only',
]

export function validateProposalContent(
  frontmatter: Record<string, unknown>,
  body: string,
  proposalType: ProposalType,
): ProposalValidationResult {
  const issues: string[] = []
  let hasFail = false
  let hasWarn = false

  function fail(msg: string): void { issues.push(`FAIL: ${msg}`); hasFail = true }
  function warn(msg: string): void { issues.push(`WARN: ${msg}`); hasWarn = true }

  // Generic validation
  if (!frontmatter.proposal_type) fail('frontmatter.proposal_type is missing')
  if (!frontmatter.id || typeof frontmatter.id !== 'string') {
    fail('frontmatter.id is missing')
  } else if (!(frontmatter.id as string).startsWith('proposals/')) {
    fail('frontmatter.id must start with "proposals/"')
  }
  if (!frontmatter.title || (frontmatter.title as string).trim() === '') fail('frontmatter.title is empty')
  if (frontmatter.status !== 'proposed' && frontmatter.status !== 'promoted') {
    fail(`frontmatter.status must be 'proposed' or 'promoted', got: ${frontmatter.status}`)
  }
  if (frontmatter.canonical !== 'provisional') {
    fail(`frontmatter.canonical must be 'provisional', got: ${frontmatter.canonical}`)
  }
  if (!frontmatter.source_prompt || (frontmatter.source_prompt as string).trim() === '') {
    fail('frontmatter.source_prompt is empty')
  }
  if (frontmatter.promote_target === undefined || frontmatter.promote_target === null) {
    fail('frontmatter.promote_target is missing')
  } else if (typeof frontmatter.promote_target === 'string' && frontmatter.promote_target.trim() === '' && proposalType !== 'state-update') {
    warn('frontmatter.promote_target is empty (only valid for state-update)')
  }
  if (!frontmatter.summary || (frontmatter.summary as string).trim() === '') {
    fail('frontmatter.summary is empty')
  }
  if (!body || body.trim().length <= 50) {
    fail('body is empty or too short (must be > 50 chars)')
  }

  // Prompt/type mismatch guard
  // If source_prompt strongly indicates an adversary but proposal_type is not adversary, warn.
  const ADVERSARY_PROMPT_SIGNALS =
    /\bnew\s+adversary\b|\badversary\b|\bmartial\s+threat\b|\btraits?\s+and\s+actions?\b|\bstat\s+block\b|\bif\s+confronted\b|\bencountered\s+(?:alone|in\s+pairs?)\b|\bdm\s+can\s+choo?s\b/i
  const NPC_PROMPT_SIGNALS = /^\s*(?:please\s+)?propose\s+(?:a|an)\s+new\s+npc\b/i
  const sourcePrompt = String(frontmatter.source_prompt ?? '')
  if (ADVERSARY_PROMPT_SIGNALS.test(sourcePrompt) && proposalType !== 'adversary') {
    fail(
      `Prompt/type mismatch: source_prompt appears to request an adversary ` +
      `(found: "${sourcePrompt.match(ADVERSARY_PROMPT_SIGNALS)?.[0]}") ` +
      `but proposal_type is "${proposalType}". ` +
      `Use --type adversary or let the router detect it automatically.`,
    )
  }
  if (NPC_PROMPT_SIGNALS.test(sourcePrompt) && proposalType !== 'npc') {
    fail(
      `Prompt/type mismatch: source_prompt explicitly requests an NPC but proposal_type is "${proposalType}". ` +
      `Explicit opening proposal type must win over contextual keyword routing.`,
    )
  }

  // Type-specific validation
  if (proposalType === 'chapter-outline') {
    for (const section of CHAPTER_REQUIRED_SECTIONS) {
      if (!body.includes(section)) {
        fail(`chapter-outline body missing required section: ${section}`)
      }
    }
    if (body.includes('campaign-state.json')) {
      fail('chapter-outline body must not reference "campaign-state.json" directly')
    }
    if (body.includes('player-knowledge.json')) {
      fail('chapter-outline body must not reference "player-knowledge.json" directly')
    }
  }

  if (proposalType === 'encounter') {
    for (const section of ENCOUNTER_REQUIRED_SECTIONS) {
      if (!body.includes(section)) {
        fail(`encounter body missing required section: ${section}`)
      }
    }
  }

  if (proposalType === 'adversary') {
    for (const section of ADVERSARY_REQUIRED_SECTIONS) {
      if (!body.includes(section)) {
        fail(`adversary body missing required section: ${section}`)
      }
    }
    if (!body.includes('Armour Class') && !body.includes('Armor Class')) {
      fail('adversary body missing "Armour Class" or "Armor Class"')
    }
    if (!body.includes('Hit Points')) {
      fail('adversary body missing "Hit Points"')
    }
    if (!body.includes('Challenge')) {
      fail('adversary body missing "Challenge"')
    }
  }

  if (proposalType === 'place') {
    // route_profile must be place-design, not state
    if (frontmatter.route_profile === 'state') {
      warn('place proposal has route_profile: state — should be place-design')
    }

    // promote_target must point to planning/places
    const pt = String(frontmatter.promote_target ?? '')
    if (pt && !pt.includes('planning/places') && !pt.includes('proposals/places')) {
      warn(`place proposal promote_target "${pt}" is unexpected — should be corpus/planning/places`)
    }

    // Main heading must be "# Place: <name>"
    if (!body.match(/^#\s+Place:\s+\S/m)) {
      fail('place proposal body must begin with a "# Place: <name>" heading')
    }

    const PLACE_REQUIRED_SECTIONS = ['## Overview', '## Geography', '## Key Districts', '## Factions']
    for (const section of PLACE_REQUIRED_SECTIONS) {
      if (!body.includes(section)) {
        warn(`place body missing suggested section: ${section}`)
      }
    }

    // Must not be a chapter outline disguised as a place
    if (body.match(/^## Chapter Purpose/m)) {
      fail('place proposal contains chapter-outline sections — check proposal_type routing')
    }
  }

  if (proposalType === 'npc') {
    if (frontmatter.route_profile === 'state' || frontmatter.route_profile === 'place-design') {
      fail(`npc proposal has route_profile "${frontmatter.route_profile}" — expected npc-design`)
    }
    const pt = String(frontmatter.promote_target ?? '')
    if (pt && !pt.includes('planning/npcs') && !pt.includes('proposals/npcs')) {
      warn(`npc proposal promote_target "${pt}" is unexpected — should be corpus/planning/npcs`)
    }
    if (!body.match(/^#\s+NPC:\s+\S/m)) {
      fail('npc proposal body must begin with a "# NPC: <name>" heading')
    }
    for (const section of NPC_REQUIRED_SECTIONS) {
      if (!body.includes(section)) {
        fail(`npc body missing required section: ${section}`)
      }
    }
    if (body.match(/^#\s+Place:/m) || body.includes('## Geography and Layout')) {
      fail('npc proposal contains place-style sections — check proposal_type routing')
    }
  }

  if (proposalType === 'state-update') {
    warn('state-update proposals cannot be directly promoted — use a dedicated state-update command')
    if (body.includes('"patches"') === false && body.toLowerCase().includes('direct json edit')) {
      warn('state-update body should describe patches, not direct JSON edits')
    }
  }

  const status: 'pass' | 'warning' | 'fail' = hasFail ? 'fail' : hasWarn ? 'warning' : 'pass'
  return { valid: !hasFail, status, issues }
}

export function validateProposalFile(filePath: string): ProposalValidationResult {
  const issues: string[] = []
  let hasFail = false
  let hasWarn = false

  function fail(msg: string): void { issues.push(`FAIL: ${msg}`); hasFail = true }
  function warn(msg: string): void { issues.push(`WARN: ${msg}`); hasWarn = true }

  const filename = basename(filePath)
  if (!filename.endsWith('.proposed.md')) {
    warn(`filename does not end with .proposed.md: ${filename}`)
    hasWarn = true
  }

  let raw: string
  try {
    raw = readFileSync(filePath, { encoding: 'utf-8' })
  } catch (e) {
    fail(`cannot read file: ${e}`)
    return { valid: false, status: 'fail', issues }
  }

  let fm: Record<string, unknown>
  let body: string
  try {
    const parsed = matter(raw)
    fm = parsed.data as Record<string, unknown>
    body = parsed.content
  } catch (e) {
    fail(`cannot parse frontmatter: ${e}`)
    return { valid: false, status: 'fail', issues }
  }

  const proposalType = (fm.proposal_type as ProposalType) ?? 'encounter'
  const contentResult = validateProposalContent(fm, body, proposalType)
  issues.push(...contentResult.issues)
  if (!contentResult.valid) hasFail = true
  if (contentResult.status === 'warning' && !hasFail) hasWarn = true

  const status: 'pass' | 'warning' | 'fail' = hasFail ? 'fail' : hasWarn ? 'warning' : 'pass'
  return { valid: !hasFail, status, issues }
}
