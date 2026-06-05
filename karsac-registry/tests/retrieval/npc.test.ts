/**
 * Layer 2 — NPC retrieval tests.
 * Run with: npm run test:retrieval
 */

import { describe, it, beforeAll } from 'vitest'
import { resolve } from 'path'
import { runQuery, isOllamaAvailable } from './queryRunner.js'
import {
  loadCorpus, evaluate, assertAllPass,
  mustContain, mustNotContain, mustContainAny, needsHumanReview,
} from './evaluator.js'

const CORPUS_ROOT = resolve(__dirname, '../../../corpus')
const BRYNJA_FILE = resolve(CORPUS_ROOT, 'collections/karsac-major-npcs/brynja-thorgrimsdotter.md')
const BEORN_FILE = resolve(CORPUS_ROOT, 'collections/karsac-major-npcs/jarl-beorn.md')
const ARCHIVIST_FILE = resolve(CORPUS_ROOT, 'collections/karsac-minor-npcs/archivist-h-d.md')

let ollamaAvailable = false
beforeAll(() => { ollamaAvailable = isOllamaAvailable() })

describe('npc retrieval — DM layer for Brynja Thorgrimsdotter', () => {
  it('includes dm-only Dhurvaq connection and does not invent additional psychology', () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    const { text } = runQuery('What does the DM need to know about Brynja Thorgrimsdotter?')
    const corpus = loadCorpus([BRYNJA_FILE])

    assertAllPass(evaluate(text, corpus, [
      mustContainAny(
        [/brynja/i],
        'Response is about Brynja',
      ),
      mustContainAny(
        [/council|törweg|torweg/i],
        'Response reflects her role as council head',
      ),
      mustContainAny(
        [/dhurvaq|the holding|not reached|vishara.*not|fog.*not/i],
        'Response includes DM-layer: Vishara\'s fog has not reached her',
      ),
      mustContainAny(
        [/artefact|hearth|hidden/i],
        'Response mentions the hidden artefact',
      ),
      needsHumanReview('Response does not invent psychological motivation beyond what corpus states'),
      needsHumanReview('Response does not reveal the full Dhurvaq mechanism when not supported'),
    ]).filter(v => v.status === 'FAIL'))
  })
})

describe('npc retrieval — player-facing query does not leak dm-only content', () => {
  it('player-mode query for Brynja returns performable description, no Dhurvaq mechanics', () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    const { text } = runQuery(
      'What do the players see and know about Brynja Thorgrimsdotter?',
      'prose',
    )
    const corpus = loadCorpus([BRYNJA_FILE])

    assertAllPass(evaluate(text, corpus, [
      mustContainAny(
        [/council|seal-hide|sixty|broad|törweg|torweg/i],
        'Response contains player-observable details',
      ),
      mustNotContain(
        /dhurvaq.*operation|the holding.*distributes|protected by dhurvaq/i,
        'Response does not leak DM-only Dhurvaq protection mechanism',
      ),
      needsHumanReview('Description is performable — concrete physical and behavioural detail'),
    ]).filter(v => v.status === 'FAIL'))
  })
})

describe('npc retrieval — NPC with full corpus coverage reflects key facts', () => {
  it('Jarl Beorn: deceived not corrupted, Brynja named route forward', () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    const { text } = runQuery('Tell me about Jarl Beorn.')
    const corpus = loadCorpus([BEORN_FILE])

    assertAllPass(evaluate(text, corpus, [
      mustContain(/beorn/i, 'Response is about Beorn'),
      mustContainAny(
        [/deceived|not corrupted|deceived.*not.*corrupted|not.*shaped/i],
        'Response reflects the corpus distinction: deceived not corrupted',
      ),
      mustContainAny(
        [/valweg|council/i],
        'Response places Beorn correctly in Valweg',
      ),
      mustNotContain(
        /vishara.*reached.*beorn|beorn.*shaped|beorn.*corrupted/i,
        'Response does not incorrectly claim Beorn is shaped by Vishara',
      ),
      needsHumanReview('Response does not invent backstory beyond what corpus states'),
    ]).filter(v => v.status === 'FAIL'))
  })
})

describe('npc retrieval — NPC with minimal corpus coverage', () => {
  it('Archivist H-D: response reflects only the one sentence of corpus coverage', () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    const { text } = runQuery('Who is Archivist H-D?')
    const corpus = loadCorpus([ARCHIVIST_FILE])

    assertAllPass(evaluate(text, corpus, [
      mustContainAny(
        [/initials|h-d|archivist/i],
        'Response acknowledges the entity is identified only by initials',
      ),
      mustContainAny(
        [/vane|havnarvik|lineage|note/i],
        'Response reflects the one known fact: wrote the Vane lineage note',
      ),
      needsHumanReview('Response does not invent a full name, biography, or characterisation'),
      needsHumanReview('Response flags that coverage is minimal or identity is unknown'),
    ]).filter(v => v.status === 'FAIL'))
  })
})
