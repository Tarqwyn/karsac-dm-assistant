/**
 * Layer 2 — Rules retrieval tests.
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
const ABILITY_CHECKS = resolve(CORPUS_ROOT, 'collections/karsac-rules-dnd-2014-core/ability-checks.md')
const CLOCK_MECHANIC = resolve(CORPUS_ROOT, 'collections/karsac-mechanics/clock-mechanic.md')

let ollamaAvailable = false
beforeAll(() => { ollamaAvailable = isOllamaAvailable() })

describe('rules — core 5e ability check (no house modification)', () => {
  it('source: ability-checks file loaded · completeness: d20+modifier+DC · fidelity: no invented house rules', () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    const q = runQuery('How do ability checks work?', 'rules')
    const corpus = loadCorpus([ABILITY_CHECKS])

    assertAllPass(evaluate(q.text, corpus, [
      // Source
      sourceWasLoaded('ability-checks', 'Ability checks file was loaded by the pipeline'),
      // Completeness
      allKeyFactsPresent(
        [/d20/i, /ability modifier/i, /DC|difficulty class/i, /proficiency/i],
        'Response covers all four core components: d20, modifier, DC, proficiency',
      ),
      // Fidelity
      mustNotContain(/karsac.*house ruling|table.*ruling.*ability check/i,
        'Response does not invent a Karsac house ruling for ability checks'),
      needsHumanReview('Response matches SRD wording without embellishment'),
    ], q.loadedEntityIds).filter(v => v.status === 'FAIL'))
  })
})

describe('rules — Karsac-specific clock mechanic', () => {
  it('source: clock-mechanic file loaded · completeness: Torweg+Vane+silent · fidelity: not misattributed', () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    const q = runQuery('How does the pressure clock work in chapter 2 Torweg?', 'rules')
    const corpus = loadCorpus([CLOCK_MECHANIC])

    assertAllPass(evaluate(q.text, corpus, [
      // Source
      sourceWasLoaded('clock-mechanic', 'Clock mechanic file was loaded'),
      // Completeness
      allKeyFactsPresent(
        [/clock|pressure/i, /vane/i, /torweg|törweg/i, /silent|never announced/i],
        'Response covers clock, Vane awareness, Torweg context, silent nature',
      ),
      // Fidelity
      mustNotContain(/standard 5e rule|phb|player.s handbook/i,
        'Response does not misattribute clock to a standard 5e source'),
      needsHumanReview('Response reflects dm-only nature: players are never told the clock exists'),
    ], q.loadedEntityIds).filter(v => v.status === 'FAIL'))
  })
})

describe('rules — rule not defined in corpus', () => {
  it('source: no Karsac file needed · completeness: n/a · fidelity: acknowledges absence', () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    const q = runQuery('What is the Karsac table ruling on underwater combat visibility?', 'rules')
    const corpus = loadCorpus([])

    assertAllPass(evaluate(q.text, corpus, [
      // Source — no specific file expected; the absence of a loaded file is itself the signal
      // Fidelity
      mustContainAny([/not defined|no ruling|not.*corpus|no.*entry|not.*covered|defer.*srd/i],
        'Response acknowledges no Karsac ruling exists'),
      mustNotContain(/at the karsac table.*underwater.*penalty/i,
        'Response does not invent a specific Karsac house ruling'),
      needsHumanReview('Response does not hallucinate a ruling and directs to SRD or DM discretion'),
    ], q.loadedEntityIds).filter(v => v.status === 'FAIL'))
  })
})
