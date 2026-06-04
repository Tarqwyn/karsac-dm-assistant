import { existsSync, readFileSync } from 'fs'
import matter from 'gray-matter'
import { RULES_DATA_DIR } from './paths.js'

const REGIONAL_PATH = `${RULES_DATA_DIR}/losweg-regional-names.yaml`

interface RegionalNameEntry { name: string; meaning: string }

interface RegionalNamesFile {
  regional_creature_names?: Record<string, RegionalNameEntry>
  phantom_monsters?: string[]
}

let cached: RegionalNamesFile | null = null

function load(): RegionalNamesFile {
  if (cached) return cached
  if (!existsSync(REGIONAL_PATH)) { cached = {}; return cached }
  const raw = readFileSync(REGIONAL_PATH, 'utf-8')
  cached = matter(`---\n${raw}\n---`).data as RegionalNamesFile
  return cached
}

export function getLosweqRegionalCreatureNames(): Record<string, { name: string; meaning: string }> {
  return load().regional_creature_names ?? {}
}

export function getPhantomMonsters(): string[] {
  return load().phantom_monsters ?? []
}

export function clearRegionalNamesCacheForTests(): void {
  cached = null
}
