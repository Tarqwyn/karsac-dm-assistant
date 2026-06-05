/**
 * Layer 2 — PC retrieval tests.
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
const KORVANN_FILE = resolve(CORPUS_ROOT, 'collections/karsac-pcs/korvann.md')
const RAGNFRID_FILE = resolve(CORPUS_ROOT, 'collections/karsac-pcs/ragnfrid.md')

let ollamaAvailable = false
beforeAll(() => { ollamaAvailable = isOllamaAvailable() })

describe('pc retrieval — arc correctly described from canonical framing', () => {
  it("Korvann: ten-year rune hunt, bone disc is the original, no invented backstory", () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    const { text } = runQuery("What is Korvann's arc and what is he seeking?")
    const corpus = loadCorpus([KORVANN_FILE])

    assertAllPass(evaluate(text, corpus, [
      mustContainAny([/korvann/i], 'Response is about Korvann'),
      mustContainAny(
        [/rune|bone disc|ten year|settlement.*destroyed|air ashari/i],
        'Response reflects the canonical arc framing',
      ),
      mustContainAny(
        [/corrupted.*copies|original|bone disc.*original/i],
        'Response includes the key reveal: bone disc is the original of what he has been chasing',
      ),
      mustNotContain(
        /korvann.*knows.*vishara|korvann.*understands.*vishara/i,
        'Response does not state Korvann knows the Vishara connection yet',
      ),
      needsHumanReview('Arc framing matches corpus — no invented resolution or invented backstory'),
      needsHumanReview('Response does not confuse Korvann\'s arc with another PC\'s'),
    ]).filter(v => v.status === 'FAIL'))
  })
})

describe('pc retrieval — must_not_know respected', () => {
  it("Korvann does not yet know the Vishara operational connection", () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    const { text } = runQuery(
      "What does Korvann know about what destroyed his settlement and why?",
    )
    const corpus = loadCorpus([KORVANN_FILE])

    assertAllPass(evaluate(text, corpus, [
      mustContainAny(
        [/korvann/i],
        'Response is about Korvann',
      ),
      mustContainAny(
        [/does not know|doesn.*know|hasn.*learned|not yet|unclear to him|open question/i],
        'Response acknowledges epistemic limit — Korvann does not know the full picture',
      ),
      mustNotContain(
        /korvann.*knows.*vishara.*destroyed|vishara.*directly.*told.*korvann/i,
        'Response does not assert Korvann has confirmed knowledge of Vishara\'s role',
      ),
      needsHumanReview('Response respects what Korvann knows vs what the DM knows about his arc'),
    ]).filter(v => v.status === 'FAIL'))
  })

  it("Ragnfrid's arc does not bleed into Korvann's arc description", () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    const { text } = runQuery("What is Korvann's personal thread?")
    const corpus = loadCorpus([KORVANN_FILE, RAGNFRID_FILE])

    assertAllPass(evaluate(text, corpus, [
      mustContainAny([/korvann/i], 'Response is about Korvann'),
      mustNotContain(
        /ragnfri.*arc|ragnfri.*thread/i,
        'Response does not attribute Ragnfrid\'s arc to Korvann',
      ),
      needsHumanReview('PCs are not confused — each arc is attributed correctly'),
    ]).filter(v => v.status === 'FAIL'))
  })
})
