/**
 * Layer 2 — PC retrieval tests.
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
const KORVANN = resolve(CORPUS_ROOT, 'collections/karsac-pcs/korvann.md')
const RAGNFRID = resolve(CORPUS_ROOT, 'collections/karsac-pcs/ragnfrid.md')

let ollamaAvailable = false
beforeAll(() => { ollamaAvailable = isOllamaAvailable() })

describe('pc — arc correctly described: Korvann', () => {
  it('source: korvann file loaded · completeness: rune+caeli+bone-disc+original · fidelity: no Vishara knowledge', () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    const q = runQuery("What is Korvann's arc and what is he seeking?")
    const corpus = loadCorpus([KORVANN])

    assertAllPass(evaluate(q.text, corpus, [
      // Source
      sourceWasLoaded('korvann', 'Korvann corpus file was loaded'),
      // Completeness
      allKeyFactsPresent(
        [/rune/i, /ten year|decade/i, /bone disc|bone-disc/i, /original|corrupted.*copies/i],
        'Response covers: the rune hunt, ten-year duration, bone disc, it is the original',
      ),
      // Fidelity
      mustNotContain(/korvann.*knows.*vishara|korvann.*confirmed.*vishara/i,
        'Response does not assert Korvann has confirmed knowledge of Vishara'),
      needsHumanReview('Arc framing matches corpus — no invented resolution or backstory'),
    ], q.loadedEntityIds).filter(v => v.status === 'FAIL'))
  })
})

describe('pc — must_not_know respected: Korvann epistemic limit', () => {
  it('source: korvann file loaded · completeness: epistemic limit stated · fidelity: Vishara role not confirmed', () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    const q = runQuery("What does Korvann know about what destroyed his settlement and why?")
    const corpus = loadCorpus([KORVANN])

    assertAllPass(evaluate(q.text, corpus, [
      // Source
      sourceWasLoaded('korvann', 'Korvann corpus file was loaded'),
      // Completeness
      allKeyFactsPresent(
        [/does not know|doesn.*know|not yet|unclear|open/i],
        'Response acknowledges the epistemic limit — Korvann does not have the full picture',
      ),
      // Fidelity
      mustNotContain(/korvann.*knows.*vishara.*destroyed|vishara.*told.*korvann/i,
        'Response does not assert Korvann has confirmed knowledge of Vishara\'s role'),
      needsHumanReview('Response correctly distinguishes what Korvann knows vs what DM knows'),
    ], q.loadedEntityIds).filter(v => v.status === 'FAIL'))
  })
})

describe('pc — arcs not confused across PCs', () => {
  it('source: korvann file loaded · completeness: korvann-specific facts · fidelity: no ragnfrid arc bleed', () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    const q = runQuery("What is Korvann's personal thread in the campaign?")
    const corpus = loadCorpus([KORVANN, RAGNFRID])

    assertAllPass(evaluate(q.text, corpus, [
      // Source
      sourceWasLoaded('korvann', 'Korvann corpus file was loaded'),
      // Completeness
      mustContainAny([/korvann/i], 'Response is about Korvann'),
      allKeyFactsPresent(
        [/rune|bone disc/i],
        'Response reflects Korvann\'s specific thread, not a generic PC arc',
      ),
      // Fidelity
      mustNotContain(/ragnfri.*arc|ragnfri.*thread|oral.*history.*ragnfri/i,
        'Ragnfrid\'s oral-history arc is not attributed to Korvann'),
      needsHumanReview('PCs are not confused — each arc is attributed to the correct character'),
    ], q.loadedEntityIds).filter(v => v.status === 'FAIL'))
  })
})
