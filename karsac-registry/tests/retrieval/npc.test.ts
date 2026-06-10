/**
 * Layer 2 — NPC retrieval tests.
 * Three assertions per scenario: Source · Completeness · Fidelity
 * Run with: npm run test:retrieval
 */

import { describe, it, beforeAll } from 'vitest'
import { resolve } from 'path'
import { runQuery, isOllamaAvailable } from './queryRunner.js'
import {
  loadCorpus, evaluate, assertAllPass,
  mustContain, mustNotContain, mustContainAny,
  sourceWasLoaded, allKeyFactsPresent, needsHumanReview,
} from './evaluator.js'

const CORPUS_ROOT = resolve(__dirname, '../../../corpus')
const BRYNJA = resolve(CORPUS_ROOT, 'collections/karsac-major-npcs/brynja-thorgrimsdotter.md')
const BEORN = resolve(CORPUS_ROOT, 'collections/karsac-major-npcs/jarl-beorn.md')
const ARCHIVIST = resolve(CORPUS_ROOT, 'collections/karsac-minor-npcs/archivist-h-d.md')

let ollamaAvailable = false
beforeAll(() => { ollamaAvailable = isOllamaAvailable() })

describe('npc — DM layer for Brynja Thorgrimsdotter', () => {
  it('source: brynja file loaded · completeness: role+artefact+dhurvaq · fidelity: no invented psychology', () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    const q = runQuery('What does the DM need to know about Brynja Thorgrimsdotter?')
    const corpus = loadCorpus([BRYNJA])

    assertAllPass(evaluate(q.text, corpus, [
      // Source
      sourceWasLoaded('brynja', 'Brynja corpus file was loaded'),
      // Completeness
      allKeyFactsPresent(
        [/council|sixty.two|sixty-two/i, /artefact|hearth/i, /dhurvaq|the holding|not reached|vishara.*not/i, /record|watching/i],
        'Response covers: council role, hidden artefact, Dhurvaq protection, private record',
      ),
      // Fidelity
      mustNotContain(/brynja.*wants.*power|brynja.*corrupt|brynja.*vishara.*agent/i,
        'Response does not invent Brynja as corrupted or seeking power'),
      needsHumanReview('DM-layer facts present; no invented psychological motivation'),
    ], q.loadedEntityIds).filter(v => v.status === 'FAIL'))
  })
})

describe('npc — player-facing query does not leak dm-only content', () => {
  it('source: brynja file loaded · completeness: physical bearing · fidelity: no Dhurvaq mechanism', () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    const q = runQuery('What do the players see when they meet Brynja Thorgrimsdotter?', 'prose')
    const corpus = loadCorpus([BRYNJA])

    assertAllPass(evaluate(q.text, corpus, [
      // Source
      sourceWasLoaded('brynja', 'Brynja corpus file was loaded'),
      // Completeness — player-observable facts
      allKeyFactsPresent(
        [/council|seal.hide|sixty|broad|törweg|torweg/i],
        'Response contains at least one player-observable physical or role detail',
      ),
      // Fidelity
      mustNotContain(/dhurvaq.*operation|holding.*distributes|protected by dhurvaq/i,
        'DM-only Dhurvaq protection mechanism not leaked to player query'),
      needsHumanReview('Description is performable and under 150 words'),
    ], q.loadedEntityIds).filter(v => v.status === 'FAIL'))
  })
})

describe('npc — full coverage: Jarl Beorn', () => {
  it('source: beorn file loaded · completeness: role+relationship+key-distinction · fidelity: not corrupted', () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    const q = runQuery('Tell me about Jarl Beorn.')
    const corpus = loadCorpus([BEORN])

    assertAllPass(evaluate(q.text, corpus, [
      // Source
      sourceWasLoaded('jarl-beorn', 'Jarl Beorn corpus file was loaded'),
      // Completeness
      allKeyFactsPresent(
        [/beorn/i, /valweg|council/i, /dugweb/i, /deceived|not corrupted/i],
        'Response covers: Beorn, Valweg council, Dugweb relationship, deceived-not-corrupted',
      ),
      // Fidelity
      mustNotContain(/beorn.*shaped|beorn.*corrupted|vishara.*reached.*beorn/i,
        'Response does not assert Beorn is shaped or corrupted by Vishara'),
      needsHumanReview('No invented backstory beyond corpus — particularly no invented Mathr history'),
    ], q.loadedEntityIds).filter(v => v.status === 'FAIL'))
  })
})

describe('npc — minimal coverage: Archivist H-D', () => {
  it('source: archivist file loaded · completeness: one fact only · fidelity: no invented biography', () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    const q = runQuery('Who is Archivist H-D?')
    const corpus = loadCorpus([ARCHIVIST])

    assertAllPass(evaluate(q.text, corpus, [
      // Source
      sourceWasLoaded('archivist-h-d', 'Archivist H-D corpus file was loaded'),
      // Completeness — there is only one fact; it must appear
      allKeyFactsPresent(
        [/initials|h-d|h\.d\./i, /vane|havnarvik|lineage/i],
        'Response reflects both known facts: identified by initials and wrote Vane lineage note',
      ),
      // Fidelity
      mustNotContain(/archivist.*full.*name|archivist.*born|archivist.*torweg.*native/i,
        'Response does not invent a full name or biography'),
      needsHumanReview('Response flags that coverage is minimal — identity otherwise unknown'),
    ], q.loadedEntityIds).filter(v => v.status === 'FAIL'))
  })
})
