/**
 * Layer 2 — Item retrieval tests.
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
const MATHR_TOKEN = resolve(CORPUS_ROOT, 'collections/karsac-items-artifacts/mathr-token.md')
const ASHVEIN = resolve(CORPUS_ROOT, 'collections/karsac-items-artifacts/ashvein.md')
const PLAYER_KNOWLEDGE = resolve(CORPUS_ROOT, 'state/player-knowledge.json')

let ollamaAvailable = false
beforeAll(() => { ollamaAvailable = isOllamaAvailable() })

describe('item retrieval — canonical item description matches corpus', () => {
  it("Mathr's token: sigil is Mathr's not Vane's — the session mic-drop", () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    const { text } = runQuery("What is the Mathr token and what does it mean?")
    const corpus = loadCorpus([MATHR_TOKEN])

    assertAllPass(evaluate(text, corpus, [
      mustContainAny(
        [/token/i],
        'Response is about the token',
      ),
      mustContainAny(
        [/mathr.*sigil|sigil.*mathr|jarl.*mathr|mathr.*not.*vane/i],
        'Response reflects key fact: sigil is Mathr\'s not Vane\'s',
      ),
      mustContainAny(
        [/bronze|palm.sized|collar|housecarl/i],
        'Response includes physical description from corpus',
      ),
      mustNotContain(
        /vane.*sigil|vane.*token|vane.*house.*mark/i,
        'Response does not misattribute the sigil to Vane',
      ),
      needsHumanReview('Description matches corpus exactly — no embellishment of token properties'),
    ]).filter(v => v.status === 'FAIL'))
  })
})

describe('item retrieval — item state from player-knowledge', () => {
  it('active threads from player-knowledge include bone-disc as hot', () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    const { text } = runQuery("What items or objects does the party currently have that matter?")
    const corpus = loadCorpus([PLAYER_KNOWLEDGE, MATHR_TOKEN])

    assertAllPass(evaluate(text, corpus, [
      mustContainAny(
        [/bone disc|bone-disc/i],
        'Response mentions the bone disc (hot thread in player-knowledge)',
      ),
      needsHumanReview('Response does not describe items the party does not yet have'),
      needsHumanReview('Response reflects current known state, not speculative future state'),
    ]).filter(v => v.status === 'FAIL'))
  })
})

describe('item retrieval — item with minimal or untracked state', () => {
  it('Ashvein: description matches corpus without inventing additional properties', () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    const { text } = runQuery("What is Ashvein?")
    const corpus = loadCorpus([ASHVEIN])

    assertAllPass(evaluate(text, corpus, [
      mustContainAny(
        [/ashvein/i],
        'Response is about Ashvein',
      ),
      mustContainAny(
        [/halvash|volcanic|glass|black/i],
        'Response reflects the material origin from corpus',
      ),
      needsHumanReview('Response does not extend properties beyond what corpus states'),
      needsHumanReview('Response does not invent a current holder or location if state is untracked'),
    ]).filter(v => v.status === 'FAIL'))
  })
})
