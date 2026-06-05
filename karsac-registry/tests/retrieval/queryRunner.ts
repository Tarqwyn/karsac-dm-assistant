import { spawnSync } from 'child_process'
import { resolve } from 'path'

const PROJECT_ROOT = resolve(__dirname, '../../../..')

/**
 * Check whether Ollama is reachable before attempting a live query.
 * Tests skip (not fail) when Ollama is unavailable.
 */
export function isOllamaAvailable(): boolean {
  try {
    const host = process.env.OLLAMA_HOST ?? 'http://localhost:11434'
    const result = spawnSync('curl', ['-sf', '--max-time', '2', `${host}/api/tags`], {
      timeout: 3000,
      encoding: 'utf-8',
    })
    return result.status === 0
  } catch {
    return false
  }
}

export interface QueryResult {
  /** Response text from stdout */
  text: string
  /** Pipeline profile used */
  profile: string
  /** Wall-clock duration of the LLM call */
  durationMs: number
  /**
   * Entity IDs loaded by the pipeline, parsed from stderr.
   * Format in stderr: "→ Loaded: {path}" or "  - {id}  ({path})"
   * Used for source assertions.
   */
  loadedEntityIds: string[]
  /** Raw stderr for debugging */
  stderr: string
}

/**
 * Parse entity IDs and paths from the pipeline's stderr output.
 * Handles both single-file ("→ Loaded: path") and multi-file
 * ("  - entity-id  (path)") formats.
 */
function parseLoadedSources(stderr: string): string[] {
  const ids: string[] = []

  // Single file: "→ Loaded: /absolute/path/to/file.md"
  for (const m of stderr.matchAll(/→ Loaded:\s+(.+)/g)) {
    const path = m[1].trim()
    // Extract entity-like id from path: collections/karsac-major-npcs/jarl-beorn.md → npcs/jarl-beorn
    ids.push(path)
  }

  // Multiple files: "  - entity/id  (/absolute/path)"
  for (const m of stderr.matchAll(/^\s+- ([\w/.-]+)\s+\(/gm)) {
    ids.push(m[1].trim())
  }

  // Also extract from rules context: "  - rules/core/ability-checks  (/path)"
  return [...new Set(ids)]
}

/**
 * Run a retrieval query through the pipeline and return the response text
 * plus source metadata parsed from stderr.
 * Spawns `npm run karsac:ask` — real LLM call.
 * Throws if the subprocess exits non-zero with no text output.
 */
export function runQuery(question: string, profile = 'canon'): QueryResult {
  const start = Date.now()

  const result = spawnSync(
    'npm',
    ['--silent', 'run', 'karsac:ask', '--', question, '--profile', profile],
    {
      cwd: PROJECT_ROOT,
      encoding: 'utf-8',
      timeout: 120_000,
      env: { ...process.env },
    },
  )

  const durationMs = Date.now() - start

  if (result.error) throw result.error

  const text = (result.stdout ?? '').trim()
  const stderr = result.stderr ?? ''

  if (!text && result.status !== 0) {
    throw new Error(
      `karsac:ask exited with code ${result.status}.\nstderr: ${stderr || '(none)'}`,
    )
  }

  return {
    text,
    profile,
    durationMs,
    loadedEntityIds: parseLoadedSources(stderr),
    stderr,
  }
}
