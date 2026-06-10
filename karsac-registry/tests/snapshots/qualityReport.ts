/**
 * Standalone quality report — runs Claude Haiku contradiction detection on
 * the most recent proposal for each snapshot config, without re-running Ollama.
 *
 * Usage:
 *   npx tsx tests/snapshots/qualityReport.ts
 *
 * Requires ANTHROPIC_API_KEY in environment.
 */

import { readFileSync, statSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import matter from 'gray-matter'
import glob from 'fast-glob'
import { runQualityCheck } from './llmQualityEvaluator.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '../../..')
const PROPOSALS_ROOT = resolve(PROJECT_ROOT, 'corpus/proposals')

interface SnapshotConfig {
  id: string
  prompt: string
  corpusFiles: string[]
}

const SNAPSHOTS: SnapshotConfig[] = [
  { id: '01-jarl-beorn', prompt: 'Jarl Beorn', corpusFiles: ['corpus/collections/karsac-major-npcs/jarl-beorn.md'] },
  { id: '02-maret', prompt: 'Maret', corpusFiles: ['corpus/collections/karsac-minor-npcs/maret.md'] },
  { id: '03-king-dugweb', prompt: 'King Dugweb', corpusFiles: ['corpus/collections/karsac-major-npcs/king-dugweb.md'] },
  { id: '04-astrid-half-stone', prompt: 'Astrid Half-Stone, a new NPC trader from the eastern reaches', corpusFiles: [] },
  { id: '05-brynja-thorgrimsdotter', prompt: 'Brynja Thorgrimsdotter', corpusFiles: ['corpus/collections/karsac-major-npcs/brynja-thorgrimsdotter.md'] },
  { id: '06-valweg', prompt: 'Valweg', corpusFiles: ['corpus/collections/karsac-places/valweg.md'] },
  { id: '07-hrimfell', prompt: 'Hrimfell, a new remote fishing settlement on the northern coast', corpusFiles: [] },
  { id: '08-torweg', prompt: 'Torweg', corpusFiles: ['corpus/collections/karsac-places/torweg.md', 'corpus/collections/karsac-places/torweg__brynjas-hall.md', 'corpus/collections/karsac-places/torweg__saltbone-inn.md', 'corpus/collections/karsac-places/torweg__main-wharf.md'] },
  { id: '09-shadow-walker-urban', prompt: 'Shadow Walker urban operative for a street-level extraction', corpusFiles: ['corpus/adversary-corpus/karsac-adversaries/shadow-walkers.md'] },
  { id: '10-mathr-road-ambush', prompt: 'House Mathr deniable road ambush unit for chapter 3', corpusFiles: ['corpus/adversary-corpus/karsac-adversaries/mathr-road-agents.md', 'corpus/collections/karsac-factions/house-mathr.md'] },
  { id: '11-valweg-gate-housecarl', prompt: 'Valweg gate housecarl, Losweg tradition, non-corrupt obstacle', corpusFiles: ['corpus/adversary-corpus/karsac-adversaries/valweg-informants.md', 'corpus/collections/karsac-concepts/losweg-vassalage.md'] },
  { id: '12-fjord-road-encounter', prompt: 'A social obstruction encounter on the fjord road approach, chapter 3, no supernatural elements', corpusFiles: ['corpus/encounter-patterns/non-monster/roadblock.md'] },
  { id: '13-mathr-token', prompt: 'Mathr Token', corpusFiles: ['corpus/collections/karsac-items-artifacts/mathr-token.md', 'corpus/collections/karsac-entity-cards/items/mathr-token.md'] },
  { id: '14-skald-tradition', prompt: 'Skald Tradition', corpusFiles: ['corpus/collections/karsac-concepts/skald-tradition.md', 'corpus/collections/karsac-factions/skalds.md'] },
  { id: '15-house-mathr', prompt: 'House Mathr', corpusFiles: ['corpus/collections/karsac-factions/house-mathr.md', 'corpus/collections/karsac-factions/house-vane-mathr.md'] },
  { id: '16-new-place-with-factions', prompt: 'Keldvik, a new coastal settlement with a disputed harbour authority', corpusFiles: [] },
]

function findMostRecentProposal(prompt: string): string | null {
  const allFiles = glob.sync('**/*.proposed.md', { cwd: PROPOSALS_ROOT, absolute: true })
  const matches: Array<{ path: string; mtime: number }> = []

  for (const file of allFiles) {
    try {
      const raw = readFileSync(file, 'utf-8')
      const { data } = matter(raw)
      if (String(data.source_prompt ?? '').trim() === prompt.trim()) {
        const { mtimeMs } = statSync(file)
        matches.push({ path: file, mtime: mtimeMs })
      }
    } catch {
      // skip unreadable files
    }
  }

  if (matches.length === 0) return null
  matches.sort((a, b) => b.mtime - a.mtime)
  return matches[0].path
}

interface ReportEntry {
  id: string
  contradictionCount: number
  skipped?: string
  topContradiction?: string  // one-line summary of the most important issue
}

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set.')
    process.exit(1)
  }

  console.log(`Quality report — Claude Haiku contradiction detection\n${'─'.repeat(60)}`)

  const entries: ReportEntry[] = []

  for (const snap of SNAPSHOTS) {
    const proposalPath = findMostRecentProposal(snap.prompt)
    if (!proposalPath) {
      console.log(`\n[${snap.id}] — no proposal found on disk`)
      entries.push({ id: snap.id, contradictionCount: 0, skipped: 'no proposal on disk' })
      continue
    }

    const body = readFileSync(proposalPath, 'utf-8')
    const shortPath = proposalPath.replace(PROJECT_ROOT + '/', '')
    console.log(`\n[${snap.id}] ${shortPath}`)

    const absoluteCorpusFiles = snap.corpusFiles.map(f => resolve(PROJECT_ROOT, f))
    const quality = await runQualityCheck(body, absoluteCorpusFiles)

    if (quality.skipped) {
      console.log(`  skipped — ${quality.skipped}`)
      entries.push({ id: snap.id, contradictionCount: 0, skipped: quality.skipped })
    } else if (quality.contradictions.length === 0) {
      console.log(`  ✓ 0 contradictions`)
      entries.push({ id: snap.id, contradictionCount: 0 })
    } else {
      console.log(`  ✗ ${quality.contradictions.length} contradiction(s):`)
      for (const c of quality.contradictions) {
        console.log(`    ⚠ "${c.claim.slice(0, 100)}"`)
        console.log(`      corpus: "${c.corpusEvidence.slice(0, 100)}"`)
        console.log(`      ${c.explanation}`)
      }
      const top = quality.contradictions[0]
      entries.push({
        id: snap.id,
        contradictionCount: quality.contradictions.length,
        topContradiction: top.explanation,
      })
    }
  }

  // ── Summary ──────────────────────────────────────────────────────
  const checked = entries.filter(e => !e.skipped)
  const clean = checked.filter(e => e.contradictionCount === 0)
  const flagged = checked.filter(e => e.contradictionCount > 0).sort((a, b) => b.contradictionCount - a.contradictionCount)
  const skipped = entries.filter(e => e.skipped)
  const totalContradictions = flagged.reduce((n, e) => n + e.contradictionCount, 0)

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`SUMMARY — ${checked.length} proposals checked, ${flagged.length} with contradictions\n`)

  if (clean.length > 0) {
    console.log(`✓ Clean (0 contradictions):`)
    console.log(`  ${clean.map(e => e.id).join(', ')}`)
  }

  if (skipped.length > 0) {
    console.log(`\n○ Skipped:`)
    for (const e of skipped) {
      console.log(`  ${e.id} — ${e.skipped}`)
    }
  }

  if (flagged.length > 0) {
    console.log(`\n✗ Canon violations (${totalContradictions} total):`)
    for (const e of flagged) {
      console.log(`  ${e.id} (${e.contradictionCount}) — ${e.topContradiction}`)
    }
  }

  console.log(`\n${'═'.repeat(60)}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
