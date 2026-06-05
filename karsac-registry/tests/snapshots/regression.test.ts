/**
 * Layer 4 — Regression snapshot tests.
 *
 * 16 canonical runs covering every distinct pipeline code path:
 * all proposal types, all coverage levels, both corpus-named and new entity
 * paths, all major entity categories, all major validation rules.
 *
 * Run with: npm run test:snapshots
 *
 * First run writes baselines — eyeball invented counts before committing.
 * Subsequent runs diff against baselines and fail on regression
 * (inventedCount > baseline + tolerance).
 *
 * Tagged @snapshot. Excluded from default npm test (requires live Ollama).
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { runSnapshot, isOllamaAvailable } from './snapshotRunner.js'
import type { SnapshotConfig } from './snapshotRunner.js'

const SNAPSHOTS: SnapshotConfig[] = [
  {
    id: '01-jarl-beorn',
    prompt: 'Jarl Beorn',
    expectedValidation: 'pass',
    corpusFiles: ['corpus/collections/karsac-major-npcs/jarl-beorn.md'],
  },
  {
    id: '02-maret',
    prompt: 'Maret',
    expectedValidation: 'pass',
    corpusFiles: ['corpus/collections/karsac-minor-npcs/maret.md'],
  },
  {
    id: '03-king-dugweb',
    prompt: 'King Dugweb',
    expectedValidation: 'pass',
    corpusFiles: ['corpus/collections/karsac-major-npcs/king-dugweb.md'],
  },
  {
    id: '04-astrid-half-stone',
    prompt: 'Astrid Half-Stone, a new NPC trader from the eastern reaches',
    expectedValidation: 'pass',
    corpusFiles: [],
  },
  {
    id: '05-brynja-thorgrimsdotter',
    prompt: 'Brynja Thorgrimsdotter',
    expectedValidation: 'pass',
    corpusFiles: ['corpus/collections/karsac-major-npcs/brynja-thorgrimsdotter.md'],
  },
  {
    id: '06-valweg',
    prompt: 'Valweg',
    type: 'place',
    expectedValidation: 'pass',
    corpusFiles: ['corpus/collections/karsac-places/valweg.md'],
  },
  {
    id: '07-hrimfell',
    prompt: 'Hrimfell, a new remote fishing settlement on the northern coast',
    type: 'place',
    expectedValidation: 'pass',
    corpusFiles: [],
  },
  {
    id: '08-torweg',
    prompt: 'Torweg',
    type: 'place',
    expectedValidation: 'pass',
    corpusFiles: [
      'corpus/collections/karsac-places/torweg.md',
      'corpus/collections/karsac-places/torweg__brynjas-hall.md',
      'corpus/collections/karsac-places/torweg__saltbone-inn.md',
      'corpus/collections/karsac-places/torweg__main-wharf.md',
    ],
  },
  {
    id: '09-shadow-walker-urban',
    prompt: 'Shadow Walker urban operative for a street-level extraction',
    type: 'adversary',
    expectedValidation: 'pass',
    corpusFiles: ['corpus/adversary-corpus/karsac-adversaries/shadow-walkers.md'],
  },
  {
    id: '10-mathr-road-ambush',
    prompt: 'House Mathr deniable road ambush unit for chapter 3',
    type: 'adversary',
    expectedValidation: 'pass',
    corpusFiles: [
      'corpus/adversary-corpus/karsac-adversaries/mathr-road-agents.md',
      'corpus/collections/karsac-factions/house-mathr.md',
    ],
  },
  {
    id: '11-valweg-gate-housecarl',
    prompt: 'Valweg gate housecarl, Losweg tradition, non-corrupt obstacle',
    type: 'adversary',
    expectedValidation: 'pass',
    corpusFiles: [
      'corpus/adversary-corpus/karsac-adversaries/valweg-informants.md',
      'corpus/collections/karsac-concepts/losweg-vassalage.md',
    ],
  },
  {
    id: '12-fjord-road-encounter',
    prompt: 'A social obstruction encounter on the fjord road approach, chapter 3, no supernatural elements',
    type: 'encounter',
    expectedValidation: 'pass',
    corpusFiles: [
      'corpus/encounter-patterns/non-monster/roadblock.md',
    ],
  },
  {
    id: '13-mathr-token',
    prompt: 'Mathr Token',
    type: 'item',
    expectedValidation: 'pass',
    corpusFiles: [
      'corpus/collections/karsac-items-artifacts/mathr-token.md',
      'corpus/collections/karsac-entity-cards/items/mathr-token.md',
    ],
  },
  {
    id: '14-skald-tradition',
    prompt: 'Skald Tradition',
    type: 'concept',
    expectedValidation: 'pass',
    corpusFiles: [
      'corpus/collections/karsac-concepts/skald-tradition.md',
      'corpus/collections/karsac-factions/skalds.md',
    ],
  },
  {
    id: '15-house-mathr',
    prompt: 'House Mathr',
    type: 'faction',
    expectedValidation: 'pass',
    corpusFiles: [
      'corpus/collections/karsac-factions/house-mathr.md',
      'corpus/collections/karsac-factions/house-vane-mathr.md',
    ],
  },
  {
    id: '16-new-place-with-factions',
    prompt: 'Keldvik, a new coastal settlement with a disputed harbour authority',
    type: 'place',
    expectedValidation: 'pass',
    corpusFiles: [],
    // New entity with invented factions — expect higher invention, allow more tolerance
    tolerance: 8,
  },
]

describe('Layer 4 — Regression snapshots', () => {
  beforeAll(() => {
    if (!isOllamaAvailable()) {
      console.log('Ollama not available — skipping all snapshot tests')
    }
  })

  for (const config of SNAPSHOTS) {
    it(
      `[${config.id}] ${config.prompt.slice(0, 60)}`,
      { timeout: 300_000, retry: 2 },
      async () => {
        if (!isOllamaAvailable()) {
          console.log(`  SKIP — Ollama unavailable`)
          return
        }

        const result = runSnapshot(config)

        // Log summary regardless of pass/fail for visibility
        console.log(
          `  [${config.id}] ${result.result} | ` +
          `validation=${result.validationStatus} | ` +
          `CANON=${result.canonCount} INFERRED=${result.inferredCount} INVENTED=${result.inventedCount} | ` +
          `vs-baseline=${result.vsBaseline} | ` +
          `${Math.round(result.durationMs / 1000)}s` +
          (result.note ? ` | ${result.note}` : ''),
        )

        if (result.inventedFindings.length > 0 && result.vsBaseline !== 'no-baseline') {
          console.log(`  Invented findings:`)
          for (const f of result.inventedFindings.slice(0, 5)) {
            console.log(`    • ${f.sentence.slice(0, 120)}`)
          }
        }

        expect(
          result.result,
          result.note ?? `Snapshot ${config.id} failed`,
        ).toBe('PASS')
      },
    )
  }
})
