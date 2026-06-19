/**
 * Layer 5 — Proposal promotion walking skeleton.
 *
 * Threads the promotion lifecycle end-to-end: a proposal becomes a canonical
 * (provisional) corpus file and the entity index is rebuilt.
 *
 * Isolation: the promoter rebuilds the entity index (buildIndex), which writes
 * to INDEX_DIR. paths.ts resolves INDEX_DIR from KARSAC_INDEX_DIR at *module
 * load time*, so we point it at a throwaway dir in beforeAll — before the first
 * dynamic import of the promoter freezes that constant. Promote *targets* are
 * isolated separately, via the projectRoot argument (a per-test temp dir), so
 * nothing lands in real corpus and the real .karsac-index is never touched.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'fs'
import { resolve, join } from 'path'
import { tmpdir } from 'os'
import matter from 'gray-matter'
import { runScenario, isOllamaAvailable } from './proposalRunner.js'

// Shared throwaway index dir — set before any import of the promoter (which
// transitively loads paths.ts and freezes INDEX_DIR).
let sharedTmp: string

beforeAll(() => {
  sharedTmp = mkdtempSync(join(tmpdir(), 'promotion-skeleton-'))
  process.env.KARSAC_INDEX_DIR = resolve(sharedTmp, '.karsac-index')
})

afterAll(() => {
  if (sharedTmp && existsSync(sharedTmp)) rmSync(sharedTmp, { recursive: true, force: true })
})

/** Dynamic import so paths.ts reads KARSAC_INDEX_DIR set in beforeAll. */
async function loadPromoter() {
  const mod = await import('../../src/proposals/proposalPromoter.js')
  return mod.promoteProposal
}

function makeFixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'promote-target-'))
  mkdirSync(resolve(root, 'corpus/proposals/npcs'), { recursive: true })
  return root
}

describe('Layer 5 — Promotion walking skeleton', () => {
  it('promotes a proposal into the corpus and rebuilds the index (isolated, no Ollama)', async () => {
    const projectRoot = makeFixtureRoot()
    const fixturePath = resolve(projectRoot, 'corpus/proposals/npcs/skeleton-walker.proposed.md')
    writeFileSync(fixturePath, `---
id: proposals/skeleton-walker
proposal_type: npc
title: Skeleton Walker
status: proposed
canonical: provisional
visibility: dm-only
promote_target: corpus/planning/npcs
---

# NPC: Skeleton Walker

A fixture proving the promotion thread connects.
`)

    const promoteProposal = await loadPromoter()
    // force: skip the validator gate — this test owns the promote mechanics,
    // not validation correctness (covered by the axis3 scenario tests).
    const result = await promoteProposal(fixturePath, projectRoot, false, true)

    expect(result.error).toBeUndefined()
    expect(result.success).toBe(true)

    // Lands under the contract's promote_target, inside the isolated projectRoot
    expect(result.targetPath).toBe(resolve(projectRoot, 'corpus/planning/npcs/skeleton-walker.md'))
    expect(existsSync(result.targetPath)).toBe(true)

    const promoted = readFileSync(result.targetPath, 'utf-8')
    expect(promoted).toMatch(/status:\s*promoted/)
    expect(promoted).toMatch(/promoted_from:/)

    // Source draft is marked promoted in place
    expect(readFileSync(fixturePath, 'utf-8')).toMatch(/status:\s*promoted/)

    // Index rebuilt into the isolated dir, not the real one
    expect(result.indexRebuilt).toBe(true)
    expect(existsSync(resolve(sharedTmp, '.karsac-index'))).toBe(true)
    expect(result.targetPath).not.toContain('/karsac-registry/.karsac-index')

    rmSync(projectRoot, { recursive: true, force: true })
  }, 60_000) // promotion rebuilds the full entity index (~600 corpus files)

  it('promotes a chapter outline and derives a chapter seed automatically', async () => {
    const projectRoot = makeFixtureRoot()
    mkdirSync(resolve(projectRoot, 'corpus/proposals/chapters'), { recursive: true })
    const fixturePath = resolve(projectRoot, 'corpus/proposals/chapters/the-weight-of-witness.proposed.md')
    const proposal = matter.stringify(
      `# Chapter Outline: The Weight of Witness

## Chapter Purpose
Move the party north.

## Starting State
The party is in Törweg.

## Player Knowledge
- Mathr is the name.

## Core Pressure
The route is controlled.

## Starting Emotional State
Unease.

## Central Pressure
Truth must reach Valweg.

## Repeated Motif
Hidden eyes.

## Midpoint Turn
The ferryman reveals the route is watched.

## End State
The party stands on the edge of Valweg.

## What This Chapter Changes
- Beorn becomes relevant.

## Scene Spine
### Scene 1 — Departure / Warning
- Purpose: Get them moving.
- Location: Törweg harbour.
- Pressure: Quiet scrutiny.
- Choices: Leave, delay, ask Brynja.
- Clues: Brynja’s note.
- Failure: Delay and scrutiny.
- Exit State: Northbound.

### Scene 2 — Road Pressure
- Purpose: Show route control.
- Location: Ferry.
- Pressure: Costly passage.
- Choices: Pay, negotiate, detour.
- Clues: The toll.
- Failure: Delay.
- Exit State: Route watched.

### Scene 3 — Valweg Threshold
- Purpose: Put them at the gate.
- Location: Valweg roadblock.
- Pressure: Official legitimacy.
- Choices: Enter, bluff, reroute.
- Clues: Mathr’s seal.
- Failure: Detained.
- Exit State: Valweg in reach.

## Suggested State Updates After Play
- None yet.
`,
      {
        id: 'proposals/the-weight-of-witness',
        proposal_type: 'chapter-outline',
        title: 'The Weight of Witness',
        status: 'proposed',
        canonical: 'provisional',
        visibility: 'dm-only',
        created_at: new Date().toISOString(),
        source_prompt: 'Propose a new chapter-outline for chapter 3',
        route_profile: 'state',
        validation: { status: 'pass', issues: [] },
        related: {
          chapters: [],
          sessions: [],
          factions: ['shadow-walkers'],
          places: ['torweg', 'valweg'],
          npcs: ['brynja-thorgrimsdotter', 'jarl-beorn'],
          items: ['folded-name-mathr'],
          scenes: ['scene1', 'scene2', 'scene3'],
          adversaries: ['shadow-walkers'],
          threads: ['operation-mathr'],
          events: ['brynjas-briefing'],
        },
        promote_target: 'corpus/planning/chapters',
        summary: 'Move the party north.',
        structured_outline: {
          id: 'chapter-3',
          title: 'The Weight of Witness',
          chapterPurpose: 'Move the party north.',
          startingState: 'The party is in Törweg.',
          playerKnowledge: ['Mathr is the name.'],
          corePressure: 'The route is controlled.',
          startingEmotionalState: 'Unease.',
          centralPressure: 'Truth must reach Valweg.',
          repeatedMotif: 'Hidden eyes.',
          midpointTurn: 'The ferryman reveals the route is watched.',
          endState: 'The party stands on the edge of Valweg.',
          whatThisChapterChanges: ['Beorn becomes relevant.'],
          sceneSpine: [
            {
              id: 'scene1',
              name: 'Departure / Warning',
              purpose: 'Get them moving.',
              location: 'Törweg harbour.',
              pressure: 'Quiet scrutiny.',
              choices: ['Leave', 'delay', 'ask Brynja'],
              clues: ['Brynja’s note'],
              failure: 'Delay and scrutiny.',
              exitState: 'Northbound.',
            },
            {
              id: 'scene2',
              name: 'Road Pressure',
              purpose: 'Show route control.',
              location: 'Ferry.',
              pressure: 'Costly passage.',
              choices: ['Pay', 'negotiate', 'detour'],
              clues: ['The toll'],
              failure: 'Delay.',
              exitState: 'Route watched.',
            },
            {
              id: 'scene3',
              name: 'Valweg Threshold',
              purpose: 'Put them at the gate.',
              location: 'Valweg roadblock.',
              pressure: 'Official legitimacy.',
              choices: ['Enter', 'bluff', 'reroute'],
              clues: ['Mathr’s seal'],
              failure: 'Detained.',
              exitState: 'Valweg in reach.',
            },
          ],
          suggestedStateUpdatesAfterPlay: ['None yet.'],
        },
      },
    )
    writeFileSync(fixturePath, proposal, 'utf-8')

    const promoteProposal = await loadPromoter()
    const result = await promoteProposal(fixturePath, projectRoot, false, true)

    expect(result.error).toBeUndefined()
    expect(result.success).toBe(true)

    const seedPath = resolve(projectRoot, 'corpus/state/chapters/chapter-3/seed.json')
    expect(existsSync(seedPath)).toBe(true)
    const seed = JSON.parse(readFileSync(seedPath, 'utf-8'))
    expect(Array.isArray(seed.scenes)).toBe(true)
    expect(seed.scenes).toHaveLength(4)
    expect(seed.beats).toHaveLength(3)
    expect(seed.scenes[0].blocks.some((block: { type?: string }) => block.type === 'actions')).toBe(true)
    expect(seed.scenes.some((scene: { kind?: string }) => scene.kind === 'reference')).toBe(true)
    expect(
      seed.scenes.some((scene: { blocks?: Array<{ type?: string }> }) =>
        Array.isArray(scene.blocks) && scene.blocks.some((block) => block.type === 'scene-links'),
      ),
    ).toBe(true)

    rmSync(projectRoot, { recursive: true, force: true })
  }, 60_000)

  it('generates a fresh proposal then promotes it (full thread)', async () => {
    if (!isOllamaAvailable()) {
      console.log('Ollama not available — skipping full propose→promote thread')
      return
    }

    // Generate into an isolated proposals dir so real corpus/proposals stays clean.
    const projectRoot = mkdtempSync(join(tmpdir(), 'promote-gen-'))
    process.env.KARSAC_PROPOSALS_DIR = resolve(projectRoot, 'corpus/proposals')

    try {
      const scenario = runScenario('Astrid Half-Stone, a new NPC trader from the eastern reaches', {
        type: 'npc',
        timeout: 240_000,
      })
      expect(existsSync(scenario.proposalPath)).toBe(true)

      const promoteProposal = await loadPromoter()
      // force: a freshly generated NPC may carry validation warnings/failures;
      // the skeleton asserts the thread connects, not that generation is clean.
      const result = await promoteProposal(scenario.proposalPath, projectRoot, false, true)

      console.log(
        `  generated ${scenario.proposalPath.split('/').pop()} (validation: ${scenario.validationStatus}) → promoted to ${result.targetPath.replace(projectRoot + '/', '')}`,
      )

      expect(result.success).toBe(true)
      expect(result.targetPath).toContain('corpus/planning/npcs')
      expect(existsSync(result.targetPath)).toBe(true)
      expect(readFileSync(result.targetPath, 'utf-8')).toMatch(/status:\s*promoted/)
      expect(result.indexRebuilt).toBe(true)
    } finally {
      delete process.env.KARSAC_PROPOSALS_DIR
      rmSync(projectRoot, { recursive: true, force: true })
    }
  }, 300_000)
})
