import { existsSync, readFileSync } from 'fs'
import matter from 'gray-matter'
import { REGISTRY_ROOT } from './paths.js'

const ROUTER_CONFIG_PATH = `${REGISTRY_ROOT}/router-config.yaml`

interface RouterConfigFile {
  rules_terms?: string[]
  design_terms?: string[]
  deep_lore_terms?: string[]
  strong_prose_terms?: string[]
  weak_prose_terms?: string[]
  state_terms?: string[]
  adversary_design_terms?: string[]
  encounter_design_terms?: string[]
  canon_terms?: string[]
  explicit_encounter_scene_pattern?: string
}

let cached: RouterConfigFile | null = null

function load(): RouterConfigFile {
  if (cached) return cached
  if (!existsSync(ROUTER_CONFIG_PATH)) {
    cached = {}
    return cached
  }
  const raw = readFileSync(ROUTER_CONFIG_PATH, 'utf-8')
  cached = matter(`---\n${raw}\n---`).data as RouterConfigFile
  return cached
}

export function getRulesTerms(): readonly string[] { return load().rules_terms ?? [] }
export function getDesignTerms(): readonly string[] { return load().design_terms ?? [] }
export function getDeepLoreTerms(): readonly string[] { return load().deep_lore_terms ?? [] }
export function getStrongProseTerms(): readonly string[] { return load().strong_prose_terms ?? [] }
export function getWeakProseTerms(): readonly string[] { return load().weak_prose_terms ?? [] }
export function getStateTerms(): readonly string[] { return load().state_terms ?? [] }
export function getAdversaryDesignTerms(): readonly string[] { return load().adversary_design_terms ?? [] }
export function getEncounterDesignTerms(): readonly string[] { return load().encounter_design_terms ?? [] }
export function getCanonTerms(): readonly string[] { return load().canon_terms ?? [] }

export function getExplicitEncounterScenePattern(): RegExp {
  const p = load().explicit_encounter_scene_pattern
  return p ? new RegExp(p, 'i') : /\bdesign\s+an?\s+encounter\b/i
}

export function clearRouterConfigCacheForTests(): void {
  cached = null
}
