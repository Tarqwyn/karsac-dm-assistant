/**
 * Layer 2 — Campaign state retrieval tests.
 *
 * These tests make real LLM calls via the pipeline. They are tagged
 * for selective execution: `npm run test:retrieval`
 *
 * Tests skip automatically when Ollama is not reachable.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { resolve } from 'path'
import { runQuery, isOllamaAvailable } from './queryRunner.js'
import {
  loadCorpus,
  evaluate,
  assertAllPass,
  mustContain,
  mustNotContain,
  mustContainAny,
  mustReflectCorpusValue,
  needsHumanReview,
} from './evaluator.js'

const CORPUS_ROOT = resolve(__dirname, '../../../corpus')
const WORLD_THREADS = resolve(CORPUS_ROOT, 'state/world-threads.json')
const CAMPAIGN_STATE = resolve(CORPUS_ROOT, 'state/campaign-state.json')

// Known hot threads as of current world state (currentStatus: hot)
const HOT_THREAD_KEYWORDS = [
  'bone disc',
  'pryzi key',
  'pryzi vault',
  'vane.*token|token.*mathr|mathr.*token',
  'korvann.*rune|rune.*disc',
  'ragnfridd.*tradition',
]

// Known simmering threads — should be present but not foregrounded as urgent
const SIMMERING_THREAD_KEYWORDS = [
  'manifest.*locked|veyr.*manifest',
  'coded message|erwing',
  'brix.*ashfen|ashfen.*change',
  'duvash',
  'mathr.*arithmetic|arithmetic.*mathr',
]

// Words that indicate urgency — hot threads should be associated with these
const URGENCY_WORDS = [
  'urgent', 'hot', 'active', 'immediate', 'pressing', 'now', 'this session',
  'needs attention', 'ready to run', 'primary', 'foreground',
]

let ollamaAvailable = false

beforeAll(() => {
  ollamaAvailable = isOllamaAvailable()
})

// ── Scenario 1: Hot threads correctly identified ───────────────────────────────

describe('campaign state — hot threads correctly identified', () => {
  it('response identifies hot threads as active/urgent for this session', () => {
    if (!ollamaAvailable) {
      console.warn('Skipping: Ollama not available')
      return
    }

    const { text } = runQuery('What are the active threads I need to run this session?')
    const corpus = loadCorpus([WORLD_THREADS, CAMPAIGN_STATE])

    const verdicts = evaluate(text, corpus, [
      mustContainAny(
        HOT_THREAD_KEYWORDS.map((k) => new RegExp(k, 'i')),
        'At least one hot thread is mentioned in the response',
      ),
      mustContainAny(
        URGENCY_WORDS.map((w) => new RegExp(`\\b${w}\\b`, 'i')),
        'Response uses urgency language for active threads',
      ),
      mustContainAny(
        ['bone disc', 'pryzi', 'token'],
        'At least one of the three primary hot threads is named',
      ),
      needsHumanReview(
        'Hot threads are presented early, not buried after simmering threads',
      ),
    ])

    assertAllPass(verdicts.filter((v) => v.status === 'FAIL'))

    const needsReview = verdicts.filter((v) => v.status === 'NEEDS_REVIEW')
    if (needsReview.length > 0) {
      console.info('NEEDS_REVIEW criteria (require human check):')
      needsReview.forEach((v) => console.info(`  - ${v.criterion}`))
    }
  })
})

// ── Scenario 2: Simmering threads not foregrounded ────────────────────────────

describe('campaign state — simmering threads not foregrounded', () => {
  it('simmering threads are distinguished from hot threads, not presented as urgent', () => {
    if (!ollamaAvailable) {
      console.warn('Skipping: Ollama not available')
      return
    }

    const { text } = runQuery('What are the active threads I need to run this session?')
    const corpus = loadCorpus([WORLD_THREADS])

    // The Pryzi manifest is simmering — must not be called urgent/hot
    // (it should be mentioned as background context, not as a session priority)
    const verdicts = evaluate(text, corpus, [
      {
        id: 'simmering-not-urgent',
        description: 'Simmering threads are not labelled urgent or hot when hot threads are also present',
        evaluate: (response) => {
          // Check that "manifest" and "simmering" / background language appear together
          // OR that manifest is not given the same urgency language as hot threads
          const hasUrgentManifest = /manifest.{0,60}(urgent|hot|immediate|this session)/i.test(response)
            || /(urgent|hot|immediate|this session).{0,60}manifest/i.test(response)
          if (hasUrgentManifest) {
            return {
              status: 'FAIL',
              finding: 'Simmering thread (manifest) incorrectly labelled as urgent/hot',
            }
          }
          return { status: 'PASS' }
        },
      },
      {
        id: 'distinction-present',
        description: 'Response distinguishes between different urgency levels (hot vs simmering/background)',
        evaluate: (response) => {
          const hasDistinction = /simmer|background|not yet|future|later|when triggered/i.test(response)
            || /(?:hot|urgent|active).*(?:vs|versus|compared|unlike|while|but)/i.test(response)
          if (hasDistinction) return { status: 'PASS' }
          return {
            status: 'NEEDS_REVIEW',
            finding: 'Response may not clearly distinguish urgency levels — check manually',
          }
        },
      },
      needsHumanReview(
        'Simmering threads appear in a secondary or "background" section, not as session priorities',
      ),
    ])

    assertAllPass(verdicts.filter((v) => v.status === 'FAIL'))
  })
})

// ── Scenario 3: Chapter position reflected correctly ──────────────────────────

describe('campaign state — chapter position reflected correctly', () => {
  it('response states chapter 2 and session 2 without describing future events', () => {
    if (!ollamaAvailable) {
      console.warn('Skipping: Ollama not available')
      return
    }

    const { text } = runQuery('Where are we in the campaign? What chapter and session?')
    const corpus = loadCorpus([CAMPAIGN_STATE])

    const verdicts = evaluate(text, corpus, [
      mustReflectCorpusValue(
        CAMPAIGN_STATE,
        'currentChapter',
        'Response reflects currentChapter from campaign-state.json (chapter 2)',
      ),
      mustReflectCorpusValue(
        CAMPAIGN_STATE,
        'currentSession',
        'Response reflects currentSession from campaign-state.json (session 2)',
      ),
      mustContainAny(
        [/chapter\s*2/i, /chapter two/i],
        'Response mentions chapter 2',
      ),
      mustContainAny(
        [/session\s*2/i, /session two/i],
        'Response mentions session 2',
      ),
      {
        id: 'no-future-chapters',
        description: 'Response does not describe events from chapters 3+ as if they have happened',
        evaluate: (response) => {
          // Look for signs the model has described future chapter events as past/current
          const futureChapterClaim = /chapter\s*[3-9].*(?:happened|occurred|we.*did|party.*did|completed)/i.test(response)
          if (futureChapterClaim) {
            return {
              status: 'FAIL',
              finding: 'Response appears to describe future chapter events as if they occurred',
            }
          }
          return { status: 'PASS' }
        },
      },
      needsHumanReview(
        'Response does not describe session 3+ events or spoil future plot beats',
      ),
    ])

    assertAllPass(verdicts.filter((v) => v.status === 'FAIL'))
  })

  it('response does not invent a chapter position beyond what corpus states', () => {
    if (!ollamaAvailable) {
      console.warn('Skipping: Ollama not available')
      return
    }

    const { text } = runQuery('What chapter are we on and what has happened so far?')
    const corpus = loadCorpus([CAMPAIGN_STATE])

    const verdicts = evaluate(text, corpus, [
      mustNotContain(
        /chapter\s*[3-9]/i,
        'Response does not claim we are in chapter 3 or later',
      ),
      {
        id: 'no-invented-progress',
        description: 'Response does not invent session count beyond session 2',
        evaluate: (response) => {
          // Check for invented session numbers higher than current
          const inventedSession = /session\s*([3-9]|[1-9][0-9])/i.exec(response)
          if (inventedSession) {
            return {
              status: 'FAIL',
              finding: `Response claims session ${inventedSession[1]} when corpus says session 2`,
            }
          }
          return { status: 'PASS' }
        },
      },
    ])

    assertAllPass(verdicts.filter((v) => v.status === 'FAIL'))
  })
})
