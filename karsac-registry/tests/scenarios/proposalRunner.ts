/**
 * Scenario runner for Layer 3 generation tests.
 * Spawns the full proposal pipeline (karsac:propose) and returns the
 * written proposal file path plus validation/repair metadata.
 */

import { spawnSync } from 'child_process'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import matter from 'gray-matter'
import type { ProposalRepairLog } from '../../src/proposals/proposalTypes.js'

const PROJECT_ROOT = resolve(__dirname, '../../..')

export interface ScenarioResult {
  /** Absolute path to the written proposal file */
  proposalPath: string
  /** Body text (after frontmatter) */
  body: string
  /** Parsed frontmatter */
  frontmatter: Record<string, unknown>
  /** Validation status from frontmatter */
  validationStatus: 'pass' | 'warning' | 'fail'
  /** All validation issues */
  validationNotes: string[]
  /** Repair log from frontmatter */
  repairLog: ProposalRepairLog | null
  /** Human-readable summary (stdout) */
  summary: string
  /** Raw stderr for debugging */
  stderr: string
  /** Wall-clock duration */
  durationMs: number
}

/**
 * Resolve the Windows host IP from the WSL default gateway.
 * Returns null when not running in WSL or the route isn't found.
 */
function getWslWindowsHostIp(): string | null {
  try {
    const r = spawnSync('ip', ['route', 'show', 'default'], { encoding: 'utf-8', timeout: 1000 })
    const m = r.stdout?.match(/default via ([\d.]+)/)
    return m ? m[1] : null
  } catch {
    return null
  }
}

/**
 * Check whether Ollama is reachable.
 * Tries OLLAMA_HOST (or localhost) first; falls back to the WSL Windows host
 * gateway IP, matching the same retry logic in propose.ts.
 * Scenarios skip (not fail) when Ollama is unavailable.
 */
export function isOllamaAvailable(): boolean {
  const host = process.env.OLLAMA_HOST ?? 'http://localhost:11434'
  const tryUrl = (url: string) => {
    try {
      const r = spawnSync('curl', ['-sf', '--max-time', '2', url], {
        timeout: 3000,
        encoding: 'utf-8',
      })
      return r.status === 0
    } catch {
      return false
    }
  }

  if (tryUrl(`${host}/api/tags`)) return true

  // In WSL, Ollama runs on the Windows host — retry via gateway IP
  if (host.includes('localhost')) {
    const winIp = getWslWindowsHostIp()
    if (winIp && tryUrl(`http://${winIp}:11434/api/tags`)) return true
  }

  return false
}

/**
 * Parse the proposal file path from propose.ts stderr output.
 * Handles both:
 *   "Proposal written: relative/path/to/file.proposed.md"
 *   "Proposal written with validation failures: relative/path..."
 */
function parseProposalPath(stderr: string): string | null {
  const m = stderr.match(/Proposal written(?:\s+with\s+validation\s+failures)?:\s+(.+\.proposed\.md)/i)
  if (!m) return null
  // The path is printed relative to karsac-registry/ (where npm --prefix runs the script).
  return resolve(PROJECT_ROOT, 'karsac-registry', m[1].trim())
}

/**
 * Run the full proposal pipeline for the given prompt and return the result.
 * Optionally pass --type to force a proposal type.
 */
export function runScenario(
  prompt: string,
  options: { type?: string; timeout?: number } = {},
): ScenarioResult {
  const start = Date.now()
  const args = ['--silent', 'run', 'karsac:propose', '--', prompt]
  if (options.type) args.push('--type', options.type)

  const result = spawnSync('npm', args, {
    cwd: PROJECT_ROOT,
    encoding: 'utf-8',
    timeout: options.timeout ?? 180_000,
    env: { ...process.env },
  })

  const durationMs = Date.now() - start

  if (result.error) throw result.error

  const stderr = result.stderr ?? ''
  const summary = (result.stdout ?? '').trim()

  if (result.status !== 0 && !stderr.includes('Proposal written')) {
    throw new Error(
      `karsac:propose exited with code ${result.status}.\nstderr: ${stderr.slice(0, 1000)}`,
    )
  }

  const proposalPath = parseProposalPath(stderr)
  if (!proposalPath || !existsSync(proposalPath)) {
    throw new Error(
      `Proposal file not found. Parsed path: ${proposalPath ?? '(none)'}\nstderr: ${stderr.slice(0, 800)}`,
    )
  }

  const raw = readFileSync(proposalPath, 'utf-8')
  const parsed = matter(raw)
  const fm = parsed.data as Record<string, unknown>

  const validation = fm.validation as { status?: string; issues?: string[] } | undefined
  const validationStatus = (validation?.status ?? 'pass') as 'pass' | 'warning' | 'fail'
  const validationNotes = validation?.issues ?? []

  const repairLog = (fm.repair_log as ProposalRepairLog | undefined) ?? null

  return {
    proposalPath,
    body: parsed.content,
    frontmatter: fm,
    validationStatus,
    validationNotes,
    repairLog,
    summary,
    stderr,
    durationMs,
  }
}
