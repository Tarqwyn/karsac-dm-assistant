/**
 * Layer 2 — Rules retrieval tests.
 * Run with: npm run test:retrieval
 */

import { describe, it, beforeAll } from 'vitest'
import { resolve } from 'path'
import { runQuery, isOllamaAvailable } from './queryRunner.js'
import { loadCorpus, evaluate, assertAllPass, mustContain, mustNotContain, mustContainAny, needsHumanReview } from './evaluator.js'

const CORPUS_ROOT = resolve(__dirname, '../../../corpus')
const ABILITY_CHECKS = resolve(CORPUS_ROOT, 'collections/karsac-rules-dnd-2014-core/ability-checks.md')
const CLOCK_MECHANIC = resolve(CORPUS_ROOT, 'collections/karsac-mechanics/clock-mechanic.md')

let ollamaAvailable = false
beforeAll(() => { ollamaAvailable = isOllamaAvailable() })

describe('rules retrieval — core 5e rule with no house modification', () => {
  it('returns d20 + modifier + DC mechanic, no invented house rules', () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    const { text } = runQuery('How do ability checks work?', 'rules')
    const corpus = loadCorpus([ABILITY_CHECKS])

    assertAllPass(evaluate(text, corpus, [
      mustContainAny([/d20/i, /twenty-sided/i], 'Response mentions d20'),
      mustContainAny([/ability modifier|modifier/i], 'Response mentions ability modifier'),
      mustContainAny([/DC|difficulty class/i], 'Response mentions DC or difficulty class'),
      needsHumanReview('Response matches SRD wording, no invented modifications'),
    ]).filter(v => v.status === 'FAIL'))
  })
})

describe('rules retrieval — Karsac-specific mechanic', () => {
  it('returns clock mechanic details including dm-only nature', () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    const { text } = runQuery('How does the pressure clock work in chapter 2?', 'rules')
    const corpus = loadCorpus([CLOCK_MECHANIC])

    assertAllPass(evaluate(text, corpus, [
      mustContainAny([/clock/i, /pressure/i], 'Response mentions the clock or pressure mechanic'),
      mustContainAny([/vane/i, /torweg|törweg/i, /awareness/i], 'Response contextualises the clock correctly'),
      mustNotContain(
        /standard 5e|player handbook|phb/i,
        'Response does not misattribute this to a standard 5e source',
      ),
      needsHumanReview('Response reflects that the clock is silent and never announced to players'),
    ]).filter(v => v.status === 'FAIL'))
  })
})

describe('rules retrieval — rule not defined in corpus', () => {
  it('does not invent a ruling for a rule with no corpus entry', () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    const { text } = runQuery(
      'What is the Karsac table ruling on underwater combat visibility penalties?',
      'rules',
    )
    const corpus = loadCorpus([])

    assertAllPass(evaluate(text, corpus, [
      mustContainAny(
        [/not defined|no ruling|not.*corpus|no.*entry|not.*covered|check.*phb|defer.*srd/i],
        'Response acknowledges no Karsac ruling exists for this rule',
      ),
      needsHumanReview('Response does not invent a specific Karsac house ruling'),
    ]).filter(v => v.status === 'FAIL'))
  })
})
