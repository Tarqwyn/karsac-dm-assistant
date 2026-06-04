import { existsSync, readFileSync } from 'fs'
import matter from 'gray-matter'
import { REGISTRY_ROOT } from './paths.js'

const SCORING_PATH = `${REGISTRY_ROOT}/encounter-scoring.yaml`

interface PatternBoost { pattern: string; boosts: string[] }
interface ExclusionGuard { slug: string; required_pattern: string }

interface EncounterScoringFile {
  social_query_pattern?: string
  monster_exception_pattern?: string
  dock_arrival_keywords?: string
  arrival_event_pattern?: string
  pattern_boosts?: PatternBoost[]
  pattern_exclusion_guards?: ExclusionGuard[]
}

let cached: EncounterScoringFile | null = null

function load(): EncounterScoringFile {
  if (cached) return cached
  if (!existsSync(SCORING_PATH)) { cached = {}; return cached }
  const raw = readFileSync(SCORING_PATH, 'utf-8')
  cached = matter(`---\n${raw}\n---`).data as EncounterScoringFile
  return cached
}

export function getSocialQueryPattern(): RegExp {
  const p = load().social_query_pattern
  return p ? new RegExp(p, 'i') : /social\s+encounter/i
}

export function getMonsterExceptionPattern(): RegExp {
  const p = load().monster_exception_pattern
  return p ? new RegExp(p, 'i') : /\bcombat\b/i
}

export function getDockArrivalKeywords(): RegExp {
  const p = load().dock_arrival_keywords
  return p ? new RegExp(p, 'i') : /\bdock\b/i
}

export function getArrivalEventPattern(): RegExp {
  const p = load().arrival_event_pattern
  return p ? new RegExp(p, 'i') : /\barriv/i
}

export function getPatternBoosts(): Array<[RegExp, string[]]> {
  return (load().pattern_boosts ?? []).map((b) => [new RegExp(b.pattern, 'i'), b.boosts])
}

export function getPatternExclusionGuards(): Array<[string, RegExp]> {
  return (load().pattern_exclusion_guards ?? []).map((g) => [g.slug, new RegExp(g.required_pattern, 'i')])
}

export function clearEncounterScoringCacheForTests(): void {
  cached = null
}
