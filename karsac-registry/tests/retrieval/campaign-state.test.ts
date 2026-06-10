/**
 * Layer 2 — Campaign state retrieval tests.
 * Three assertions per scenario: Source · Completeness · Fidelity
 * Run with: npm run test:retrieval
 */

import { describe, it, beforeAll } from 'vitest'
import { resolve } from 'path'
import { runQuery, isOllamaAvailable } from './queryRunner.js'
import {
  loadCorpus, evaluate, assertAllPass,
  mustContain, mustNotContain, mustContainAny,
  mustReflectCorpusValue, sourceWasLoaded, allKeyFactsPresent, needsHumanReview,
} from './evaluator.js'

const CORPUS_ROOT = resolve(__dirname, '../../../corpus')
const WORLD_THREADS = resolve(CORPUS_ROOT, 'state/world-threads.json')
const CAMPAIGN_STATE = resolve(CORPUS_ROOT, 'state/campaign-state.json')

const HOT_THREAD_KEYWORDS = [
  'bone disc', 'pryzi key', 'pryzi vault',
  'vane.*token|token.*mathr|mathr.*token',
  'korvann.*rune|rune.*disc',
  'ragnfridd.*tradition',
]

let ollamaAvailable = false
beforeAll(() => { ollamaAvailable = isOllamaAvailable() })

describe('campaign state — hot threads correctly identified', () => {
  it('source: world-threads loaded · completeness: hot threads named with urgency · fidelity: not all threads equal', () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    const q = runQuery('What are the active threads I need to run this session?')
    const corpus = loadCorpus([WORLD_THREADS, CAMPAIGN_STATE])

    assertAllPass(evaluate(q.text, corpus, [
      // Source
      sourceWasLoaded('world-threads', 'World threads state file was loaded'),
      // Completeness
      mustContainAny(
        HOT_THREAD_KEYWORDS.map(k => new RegExp(k, 'i')),
        'At least one hot thread is mentioned',
      ),
      allKeyFactsPresent(
        [/bone disc|bone-disc/i, /pryzi|vault.*key|key.*vault/i],
        'Two primary hot threads present: bone disc and Pryzi key',
      ),
      mustContainAny(
        [/urgent|hot|active|immediate|pressing|this session|primary/i],
        'Response uses urgency language for active threads',
      ),
      // Fidelity
      {
        id: 'simmering-not-urgent',
        description: 'Simmering threads (manifest) not labelled urgent alongside hot threads',
        evaluate: (response) => {
          const hasUrgentManifest =
            /manifest.{0,60}(urgent|hot|immediate|this session)/i.test(response) ||
            /(urgent|hot|immediate|this session).{0,60}manifest/i.test(response)
          return hasUrgentManifest
            ? { status: 'FAIL', finding: 'Simmering thread (manifest) incorrectly labelled urgent' }
            : { status: 'PASS' }
        },
      },
      needsHumanReview('Hot threads appear before simmering threads in the response'),
    ], q.loadedEntityIds).filter(v => v.status === 'FAIL'))
  })
})

describe('campaign state — simmering threads not foregrounded', () => {
  it('source: world-threads loaded · completeness: distinction present · fidelity: manifest not urgent', () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    const q = runQuery('What are the active threads I need to run this session?')
    const corpus = loadCorpus([WORLD_THREADS])

    assertAllPass(evaluate(q.text, corpus, [
      // Source
      sourceWasLoaded('world-threads', 'World threads state file was loaded'),
      // Completeness
      {
        id: 'distinction-present',
        description: 'Response distinguishes urgency levels',
        evaluate: (response) => {
          const hasDistinction = /simmer|background|not yet|future|later|when triggered/i.test(response) ||
            /(?:hot|urgent|active).*(?:vs|versus|compared|unlike|while|but)/i.test(response)
          return hasDistinction ? { status: 'PASS' } : {
            status: 'NEEDS_REVIEW',
            finding: 'Urgency distinction may not be explicit — check manually',
          }
        },
      },
      // Fidelity
      {
        id: 'simmering-not-urgent',
        description: 'Simmering threads not presented as session priorities',
        evaluate: (response) => {
          const hasUrgentManifest =
            /manifest.{0,60}(urgent|hot|immediate|this session)/i.test(response) ||
            /(urgent|hot|immediate|this session).{0,60}manifest/i.test(response)
          return hasUrgentManifest
            ? { status: 'FAIL', finding: 'Manifest labelled urgent incorrectly' }
            : { status: 'PASS' }
        },
      },
      needsHumanReview('Simmering threads in background/secondary section, not leading'),
    ], q.loadedEntityIds).filter(v => v.status === 'FAIL'))
  })
})

describe('campaign state — chapter position reflected correctly', () => {
  it('source: campaign-state loaded · completeness: chapter 2 + session 2 · fidelity: no invented progress', () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    const q = runQuery('Where are we in the campaign? What chapter and session?')
    const corpus = loadCorpus([CAMPAIGN_STATE])

    assertAllPass(evaluate(q.text, corpus, [
      // Source
      sourceWasLoaded('campaign-state', 'Campaign state file was loaded'),
      // Completeness
      allKeyFactsPresent(
        [/chapter\s*2|chapter two/i, /session\s*2|session two/i],
        'Response states both chapter 2 and session 2',
      ),
      mustReflectCorpusValue(CAMPAIGN_STATE, 'currentChapter',
        'currentChapter value (2) appears in response'),
      // Fidelity
      mustNotContain(/chapter\s*[3-9]/i,
        'Response does not claim we are in chapter 3 or later'),
      {
        id: 'no-invented-sessions',
        description: 'Response does not invent session count beyond session 2',
        evaluate: (response) => {
          const m = /session\s*([3-9]|[1-9][0-9])/i.exec(response)
          return m
            ? { status: 'FAIL', finding: `Claims session ${m[1]} but corpus says session 2` }
            : { status: 'PASS' }
        },
      },
      needsHumanReview('Response does not describe future chapter events as if occurred'),
    ], q.loadedEntityIds).filter(v => v.status === 'FAIL'))
  })
})
