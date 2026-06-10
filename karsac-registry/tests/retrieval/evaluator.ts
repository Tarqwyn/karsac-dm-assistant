import { readFileSync, existsSync } from 'fs'

// ── Types ─────────────────────────────────────────────────────────────────────

export type VerdictStatus = 'PASS' | 'FAIL' | 'NEEDS_REVIEW'

export interface RetrievalVerdict {
  criterion: string
  status: VerdictStatus
  finding?: string
  corpus_line?: string
}

export interface CorpusContent {
  /** Raw file text keyed by absolute path */
  files: Record<string, string>
  /** Parsed JSON keyed by absolute path (only for .json files) */
  json: Record<string, unknown>
  /**
   * Entity IDs loaded by the pipeline, from queryRunner.loadedEntityIds.
   * Only populated when the EvalCriterion receives it via a second argument.
   */
  loadedEntityIds?: string[]
}

export type CriterionFn = (
  response: string,
  corpus: CorpusContent,
) => Omit<RetrievalVerdict, 'criterion'>

export interface EvalCriterion {
  id: string
  description: string
  evaluate: CriterionFn
}

// ── Corpus loader ─────────────────────────────────────────────────────────────

export function loadCorpus(paths: string[]): CorpusContent {
  const files: Record<string, string> = {}
  const json: Record<string, unknown> = {}
  for (const p of paths) {
    if (!existsSync(p)) continue
    const text = readFileSync(p, 'utf-8')
    files[p] = text
    if (p.endsWith('.json')) {
      try { json[p] = JSON.parse(text) } catch { /* leave absent */ }
    }
  }
  return { files, json }
}

// ── Evaluator ─────────────────────────────────────────────────────────────────

export function evaluate(
  response: string,
  corpus: CorpusContent,
  criteria: EvalCriterion[],
  loadedEntityIds?: string[],
): RetrievalVerdict[] {
  const enriched: CorpusContent = loadedEntityIds
    ? { ...corpus, loadedEntityIds }
    : corpus
  return criteria.map((c) => {
    const result = c.evaluate(response, enriched)
    return { criterion: c.description, ...result }
  })
}

export function assertAllPass(verdicts: RetrievalVerdict[]): void {
  const failures = verdicts.filter((v) => v.status === 'FAIL')
  if (failures.length === 0) return
  const msg = failures
    .map((v) => `  FAIL — ${v.criterion}\n    finding: ${v.finding ?? '(none)'}`)
    .join('\n')
  throw new Error(`${failures.length} criterion/criteria failed:\n${msg}`)
}

// ── Criterion builders ────────────────────────────────────────────────────────

/** Response must contain this string or pattern (case-insensitive by default). */
export function mustContain(
  pattern: string | RegExp,
  description: string,
): EvalCriterion {
  return {
    id: `contains:${pattern}`,
    description,
    evaluate: (response) => {
      const re = typeof pattern === 'string'
        ? new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
        : pattern
      if (re.test(response)) return { status: 'PASS' }
      return {
        status: 'FAIL',
        finding: `Response does not contain: ${pattern}`,
      }
    },
  }
}

/** Response must NOT contain this string or pattern. */
export function mustNotContain(
  pattern: string | RegExp,
  description: string,
): EvalCriterion {
  return {
    id: `not-contains:${pattern}`,
    description,
    evaluate: (response) => {
      const re = typeof pattern === 'string'
        ? new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
        : pattern
      if (!re.test(response)) return { status: 'PASS' }
      const match = response.match(re)?.[0]
      return {
        status: 'FAIL',
        finding: `Response contains forbidden content: "${match}"`,
      }
    },
  }
}

/**
 * Response appears before a given phrase in the text — i.e. a claim
 * appears before the model starts speculating or qualifying.
 * Used to check that urgent items appear early, not buried.
 */
export function appearsBeforePhrase(
  expectedPhrase: string | RegExp,
  cutoffPhrase: string | RegExp,
  description: string,
): EvalCriterion {
  return {
    id: `appears-before`,
    description,
    evaluate: (response) => {
      const expectedRe = typeof expectedPhrase === 'string'
        ? new RegExp(expectedPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
        : expectedPhrase
      const cutoffRe = typeof cutoffPhrase === 'string'
        ? new RegExp(cutoffPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
        : cutoffPhrase

      const expectedIdx = response.search(expectedRe)
      const cutoffIdx = response.search(cutoffRe)
      if (expectedIdx === -1) {
        return { status: 'FAIL', finding: `Expected phrase not found in response` }
      }
      if (cutoffIdx === -1 || expectedIdx < cutoffIdx) {
        return { status: 'PASS' }
      }
      return {
        status: 'FAIL',
        finding: `Expected phrase appears after cutoff phrase`,
      }
    },
  }
}

/**
 * At least one of these patterns must appear in the response.
 * Use when the model may use synonyms (hot / urgent / active / immediate).
 */
export function mustContainAny(
  patterns: Array<string | RegExp>,
  description: string,
): EvalCriterion {
  return {
    id: `contains-any`,
    description,
    evaluate: (response) => {
      for (const p of patterns) {
        const re = typeof p === 'string'
          ? new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
          : p
        if (re.test(response)) return { status: 'PASS' }
      }
      return {
        status: 'FAIL',
        finding: `None of the expected patterns found: ${patterns.join(', ')}`,
      }
    },
  }
}

/**
 * A value from a JSON corpus file must appear in the response.
 * Provide a dot-path into the JSON and the expected text fragment.
 */
export function mustReflectCorpusValue(
  filePath: string,
  jsonPath: string,
  description: string,
): EvalCriterion {
  return {
    id: `corpus-value:${jsonPath}`,
    description,
    evaluate: (response, corpus) => {
      const data = corpus.json[filePath]
      if (!data) {
        return {
          status: 'NEEDS_REVIEW',
          finding: `Corpus file not loaded: ${filePath}`,
        }
      }
      const value = jsonPath.split('.').reduce<unknown>((obj, key) => {
        if (obj === null || typeof obj !== 'object') return undefined
        return (obj as Record<string, unknown>)[key]
      }, data)

      if (value === undefined || value === null) {
        return {
          status: 'NEEDS_REVIEW',
          finding: `JSON path ${jsonPath} not found in corpus`,
        }
      }

      const expected = String(value)
      const re = new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      if (re.test(response)) {
        return { status: 'PASS', corpus_line: `${jsonPath}: ${expected}` }
      }
      return {
        status: 'FAIL',
        finding: `Response does not reflect corpus value: "${expected}"`,
        corpus_line: `${jsonPath}: ${expected}`,
      }
    },
  }
}

/**
 * Assert that a specific entity ID or path fragment was loaded by the pipeline.
 * Checks corpus.loadedEntityIds (populated from stderr parsing in queryRunner).
 * Fails if the expected source was not loaded; NEEDS_REVIEW if no source data available.
 */
export function sourceWasLoaded(entityIdFragment: string, description: string): EvalCriterion {
  return {
    id: `source:${entityIdFragment}`,
    description,
    evaluate: (_response, corpus) => {
      const ids = corpus.loadedEntityIds
      if (!ids || ids.length === 0) {
        return {
          status: 'NEEDS_REVIEW',
          finding: 'No source data available — pipeline stderr not captured or no files loaded',
        }
      }
      const matched = ids.some((id) =>
        id.toLowerCase().includes(entityIdFragment.toLowerCase()),
      )
      if (matched) {
        return { status: 'PASS', corpus_line: `loaded: ${entityIdFragment}` }
      }
      return {
        status: 'FAIL',
        finding: `Expected source "${entityIdFragment}" not in loaded files: [${ids.join(', ')}]`,
      }
    },
  }
}

/**
 * Assert that ALL of these key facts / phrases appear in the response.
 * Used for completeness checks: ensures the model reflected all critical corpus facts,
 * not just one or two.
 */
export function allKeyFactsPresent(
  facts: Array<string | RegExp>,
  description: string,
): EvalCriterion {
  return {
    id: 'all-key-facts',
    description,
    evaluate: (response) => {
      const missing: string[] = []
      for (const fact of facts) {
        const re = typeof fact === 'string'
          ? new RegExp(fact.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
          : fact
        if (!re.test(response)) missing.push(String(fact))
      }
      if (missing.length === 0) return { status: 'PASS' }
      return {
        status: 'FAIL',
        finding: `Missing key facts in response: ${missing.join(' | ')}`,
      }
    },
  }
}

/** Flags a criterion as needing human review — not auto-assessable. */
export function needsHumanReview(description: string): EvalCriterion {
  return {
    id: 'human-review',
    description,
    evaluate: () => ({
      status: 'NEEDS_REVIEW',
      finding: 'Requires human assessment — not automatable',
    }),
  }
}
