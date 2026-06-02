import { readFileSync, statSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

export interface GatewayBuildInfo {
  version: string
  buildTimestamp: string
  buildId: string
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const PACKAGE_JSON_PATH = resolve(__dirname, '..', 'package.json')
const BUILD_SIGNAL_PATHS = [
  PACKAGE_JSON_PATH,
  resolve(__dirname, 'gateway', 'server.ts'),
  resolve(__dirname, 'gateway', 'chatCompletion.ts'),
  resolve(__dirname, 'gateway', 'karsacRunner.ts'),
  resolve(__dirname, 'commands', 'propose.ts'),
  resolve(__dirname, 'adversary-design.ts'),
]

let cachedBuildInfo: GatewayBuildInfo | null = null

function readPackageVersion(): string {
  try {
    const raw = readFileSync(PACKAGE_JSON_PATH, 'utf-8')
    const parsed = JSON.parse(raw) as { version?: string }
    return parsed.version?.trim() || '0.0.0'
  } catch {
    return '0.0.0'
  }
}

function computeBuildTimestamp(): string {
  let latestMs = 0

  for (const path of BUILD_SIGNAL_PATHS) {
    try {
      const stats = statSync(path)
      latestMs = Math.max(latestMs, stats.mtimeMs)
    } catch {
      // Ignore missing files and keep the best available signal.
    }
  }

  return new Date(latestMs || Date.now()).toISOString()
}

export function getGatewayBuildInfo(): GatewayBuildInfo {
  cachedBuildInfo ??= (() => {
    const version = readPackageVersion()
    const buildTimestamp = computeBuildTimestamp()
    return {
      version,
      buildTimestamp,
      buildId: `karsac-registry@${version}#${buildTimestamp}`,
    }
  })()

  return cachedBuildInfo
}

export function clearGatewayBuildInfoCacheForTests(): void {
  cachedBuildInfo = null
}
