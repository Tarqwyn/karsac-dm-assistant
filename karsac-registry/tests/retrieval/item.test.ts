/**
 * Layer 2 — Item retrieval tests.
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
const MATHR_TOKEN = resolve(CORPUS_ROOT, 'collections/karsac-items-artifacts/mathr-token.md')
const ASHVEIN = resolve(CORPUS_ROOT, 'collections/karsac-items-artifacts/ashvein.md')
const PLAYER_KNOWLEDGE = resolve(CORPUS_ROOT, 'state/player-knowledge.json')
const WORLD_THREADS = resolve(CORPUS_ROOT, 'state/world-threads.json')

let ollamaAvailable = false
beforeAll(() => { ollamaAvailable = isOllamaAvailable() })

describe('item — canonical item description: Mathr token', () => {
  it('source: mathr-token file loaded · completeness: physical+sigil+meaning · fidelity: not attributed to Vane', () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    const q = runQuery("What is the Mathr token and what does it mean?")
    const corpus = loadCorpus([MATHR_TOKEN])

    assertAllPass(evaluate(q.text, corpus, [
      // Source
      sourceWasLoaded('mathr-token', 'Mathr token corpus file was loaded'),
      // Completeness
      allKeyFactsPresent(
        [/bronze|palm.sized|collar|pierced/i, /sigil.*mathr|mathr.*sigil/i, /vane.*not|not.*vane|trail.*north|mathr.*not.*vane/i],
        'Response covers: physical description, sigil attribution, and the implication (trail leads to Mathr)',
      ),
      // Fidelity
      mustNotContain(/vane.*sigil|vane.*token.*his|vane.*house.*mark.*token/i,
        'Response does not misattribute the sigil to Vane'),
      needsHumanReview('Item description matches corpus exactly — no embellishment of token properties'),
    ], q.loadedEntityIds).filter(v => v.status === 'FAIL'))
  })
})

describe('item — current item state from player-knowledge / world-threads', () => {
  it('source: state files loaded · completeness: bone disc as hot active thread · fidelity: no untracked items claimed', () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    const q = runQuery("What significant objects does the party currently have or are tracking?")
    const corpus = loadCorpus([PLAYER_KNOWLEDGE, WORLD_THREADS])

    assertAllPass(evaluate(q.text, corpus, [
      // Source — state files should be in context
      sourceWasLoaded('world-threads', 'World threads state file was loaded'),
      // Completeness
      allKeyFactsPresent(
        [/bone disc|bone-disc/i, /pryzi.*key|pryzi.*vault/i],
        'Response mentions the two hot object-related threads: bone disc and Pryzi key',
      ),
      // Fidelity
      mustNotContain(/party.*has.*the.*mathr.*token/i,
        'Response does not claim the party has the Mathr token (they do not yet)'),
      needsHumanReview('Response reflects current known state, not speculative future possession'),
    ], q.loadedEntityIds).filter(v => v.status === 'FAIL'))
  })
})

describe('item — item with minimal / untracked state: Ashvein', () => {
  it('source: ashvein file loaded · completeness: origin+material · fidelity: no invented state', () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    const q = runQuery("What is Ashvein and where does it come from?")
    const corpus = loadCorpus([ASHVEIN])

    assertAllPass(evaluate(q.text, corpus, [
      // Source
      sourceWasLoaded('ashvein', 'Ashvein corpus file was loaded'),
      // Completeness
      allKeyFactsPresent(
        [/ashvein/i, /halvash/i, /volcanic|glass|black/i],
        'Response reflects the three corpus facts: name, Halvash origin, material description',
      ),
      // Fidelity
      mustNotContain(/ashvein.*currently.*held|ashvein.*located.*at/i,
        'Response does not invent a current holder or location for Ashvein'),
      needsHumanReview('No invented properties — only what corpus states about the material'),
    ], q.loadedEntityIds).filter(v => v.status === 'FAIL'))
  })
})
