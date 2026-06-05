import { execSync, spawnSync } from 'child_process'
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
  text: string
  profile: string
  durationMs: number
}

/**
 * Run a retrieval query through the pipeline and return the response text.
 * Spawns `npm run karsac:ask` so this is a real LLM call.
 * Throws if the subprocess exits with a non-zero code.
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

  // ask.ts writes progress to stderr, response to stdout
  const text = (result.stdout ?? '').trim()
  if (!text && result.status !== 0) {
    throw new Error(
      `karsac:ask exited with code ${result.status}.\nstderr: ${result.stderr ?? '(none)'}`,
    )
  }

  return { text, profile, durationMs }
}
