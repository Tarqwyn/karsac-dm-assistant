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
