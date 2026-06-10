/**
 * Layer 4 snapshot runner.
 *
 * Runs the full proposal pipeline, evaluates the output against its corpus
 * files, and diffs the result against a stored baseline.
 *
 * Baseline semantics
 * ------------------
 * - The baseline stores validation status + CANON/INFERRED/INVENTED counts.
 * - Sentence text is NOT compared — generation is stochastic.
 * - FAIL triggers: validation-status mismatch, or inventedCount > baseline + tolerance.
 * - First run (no baseline file): writes the baseline and returns PASS with a note.
 *
 * Tolerance
 * ---------
 * Default tolerance is 2 (or 10% of baseline invented count, whichever is higher).
 * New entities (no corpus anchor) get a higher tolerance because invention is expected.
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'
import { resolve } from 'path'
import { runScenario, isOllamaAvailable } from '../scenarios/proposalRunner.js'
import { evaluateSnapshot, getInventedFindings } from './snapshotEvaluator.js'
import type { InventedFinding } from './snapshotEvaluator.js'
import { runQualityCheck } from './llmQualityEvaluator.js'
import type { QualityResult } from './llmQualityEvaluator.js'

const PROJECT_ROOT = resolve(__dirname, '../../..')
const BASELINES_DIR = resolve(__dirname, 'baselines')

export interface SnapshotConfig {
  /** Short kebab-case id: "01-jarl-beorn" */
  id: string
  /** Prompt passed to karsac:propose */
  prompt: string
  /** Optional --type override */
  type?: string
  /** Expected pipeline validation outcome */
  expectedValidation: 'pass' | 'warning' | 'needs-review' | 'fail'
  /** Corpus files cross-referenced (relative to project root). Empty for new entities. */
  corpusFiles: string[]
  /** Max extra invented claims allowed over baseline. Default: 2 or 10% baseline, whichever higher. */
  tolerance?: number
}

export interface BaselineData {
  id: string
  createdAt: string
  validationStatus: string
  canonCount: number
  inferredCount: number
  inventedCount: number
}

export type VsBaseline = 'no-baseline' | 'no-change' | 'improvement' | 'regression'

export interface SnapshotResult {
  id: string
  validationStatus: string
  canonCount: number
  inferredCount: number
  inventedCount: number
  inventedFindings: InventedFinding[]
  vsBaseline: VsBaseline
  result: 'PASS' | 'FAIL' | 'NEEDS-REVIEW'
  note?: string
  durationMs: number
  /** LLM quality gate result — only present when ANTHROPIC_API_KEY is set and corpus is non-empty */
  quality?: QualityResult
}

function baselinePath(id: string): string {
  return resolve(BASELINES_DIR, `${id}.baseline.json`)
}

function loadBaseline(id: string): BaselineData | null {
  const path = baselinePath(id)
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf-8')) as BaselineData
}

function writeBaseline(data: BaselineData): void {
  mkdirSync(BASELINES_DIR, { recursive: true })
  writeFileSync(baselinePath(data.id), JSON.stringify(data, null, 2) + '\n', 'utf-8')
}

function effectiveTolerance(config: SnapshotConfig, baselineInvented: number): number {
  if (config.tolerance !== undefined) return config.tolerance
  // New entities (no corpus anchor) allow more invention by default
  if (config.corpusFiles.length === 0) return Math.max(5, Math.ceil(baselineInvented * 0.2))
  return Math.max(2, Math.ceil(baselineInvented * 0.1))
}

export async function runSnapshot(config: SnapshotConfig): Promise<SnapshotResult> {
  const start = Date.now()

  const scenario = runScenario(config.prompt, { type: config.type, timeout: 240_000 })

  const absoluteCorpusFiles = config.corpusFiles.map(f => resolve(PROJECT_ROOT, f))

  const evaluation = evaluateSnapshot(scenario.body, absoluteCorpusFiles)
  const inventedFindings = getInventedFindings(evaluation)

  // LLM quality gate — contradiction detection, runs alongside heuristic regression
  const quality = await runQualityCheck(scenario.body, absoluteCorpusFiles)

  const baseline = loadBaseline(config.id)

  const validationStatus = scenario.validationStatus

  // Hard FAIL only when the pipeline produces 'fail' and we expected better,
  // or when we explicitly expected 'fail' and it didn't.
  // 'warning' is treated as equivalent to 'pass' — warnings are advisory, not failures.
  const normalize = (s: string) => s === 'warning' ? 'pass' : s
  const statusMismatch = normalize(validationStatus) !== normalize(config.expectedValidation)

  if (!baseline) {
    // First run — write baseline and pass
    const data: BaselineData = {
      id: config.id,
      createdAt: new Date().toISOString(),
      validationStatus,
      canonCount: evaluation.canonCount,
      inferredCount: evaluation.inferredCount,
      inventedCount: evaluation.inventedCount,
    }
    writeBaseline(data)

    return {
      id: config.id,
      validationStatus,
      canonCount: evaluation.canonCount,
      inferredCount: evaluation.inferredCount,
      inventedCount: evaluation.inventedCount,
      inventedFindings,
      vsBaseline: 'no-baseline',
      result: statusMismatch ? 'FAIL' : 'PASS',
      note: statusMismatch
        ? `Validation status mismatch: expected ${config.expectedValidation}, got ${validationStatus}`
        : `Baseline written (${evaluation.inventedCount} invented). Eyeball before committing.`,
      durationMs: Date.now() - start,
      quality,
    }
  }

  const tolerance = effectiveTolerance(config, baseline.inventedCount)
  const isRegression = evaluation.inventedCount > baseline.inventedCount + tolerance
  const vsBaseline: VsBaseline = isRegression
    ? 'regression'
    : evaluation.inventedCount < baseline.inventedCount
      ? 'improvement'
      : 'no-change'

  const result = statusMismatch || isRegression ? 'FAIL' : 'PASS'

  const notes: string[] = []
  if (statusMismatch) {
    notes.push(`Validation status mismatch: expected ${config.expectedValidation}, got ${validationStatus}`)
  }
  if (isRegression) {
    notes.push(
      `Invented count regression: baseline ${baseline.inventedCount}, this run ${evaluation.inventedCount} (tolerance +${tolerance})`,
    )
  }

  return {
    id: config.id,
    validationStatus,
    canonCount: evaluation.canonCount,
    inferredCount: evaluation.inferredCount,
    inventedCount: evaluation.inventedCount,
    inventedFindings,
    vsBaseline,
    result,
    note: notes.length ? notes.join('; ') : undefined,
    durationMs: Date.now() - start,
    quality,
  }
}

export { isOllamaAvailable }
