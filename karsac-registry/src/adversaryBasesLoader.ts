import { existsSync, readFileSync } from 'fs'
import matter from 'gray-matter'
import { RULES_DATA_DIR } from './paths.js'
import { guardArray } from './loaderUtils.js'

const BASES_PATH = `${RULES_DATA_DIR}/adversary-bases.yaml`

interface BaseHeuristic { pattern: string; preferred_base: string }
interface EnvironmentContext { pattern: string; label: string }

interface AdversaryBasesFile {
  base_slug_map?: Record<string, string>
  allowed_proposal_bases?: string[]
  valid_srd_base_names?: string[]
  bases_without_darkvision?: string[]
  base_selection_heuristics?: BaseHeuristic[]
  default_base?: string
  environment_contexts?: EnvironmentContext[]
  npc_base_summaries?: Record<string, string>
}

let cached: AdversaryBasesFile | null = null

function load(): AdversaryBasesFile {
  if (cached) return cached
  if (!existsSync(BASES_PATH)) { cached = {}; return cached }
  const raw = readFileSync(BASES_PATH, 'utf-8')
  cached = matter(`---\n${raw}\n---`).data as AdversaryBasesFile
  return cached
}

export function getBaseSlugMap(): Record<string, string> {
  return load().base_slug_map ?? {}
}

export function getAllowedProposalBases(): string[] {
  return guardArray<string>(load().allowed_proposal_bases, 'allowed_proposal_bases')
}

export function getValidSrdBaseNames(): Set<string> {
  return new Set(guardArray<string>(load().valid_srd_base_names, 'valid_srd_base_names'))
}

export function getBasesWithoutDarkvision(): Set<string> {
  return new Set(guardArray<string>(load().bases_without_darkvision, 'bases_without_darkvision'))
}

export function getBaseSelectionHeuristics(): Array<{ regex: RegExp; preferredBase: string }> {
  return guardArray<BaseHeuristic>(load().base_selection_heuristics, 'base_selection_heuristics')
    .map((h) => ({ regex: new RegExp(h.pattern, 'i'), preferredBase: h.preferred_base }))
}

export function getDefaultBase(): string {
  return load().default_base ?? 'spy'
}

export function getEnvironmentContexts(): Array<{ regex: RegExp; label: string }> {
  return guardArray<EnvironmentContext>(load().environment_contexts, 'environment_contexts')
    .map((e) => ({ regex: new RegExp(e.pattern, 'i'), label: e.label }))
}

export function getNpcBaseSummariesMap(): Record<string, string> {
  return load().npc_base_summaries ?? {}
}

export function clearAdversaryBasesCacheForTests(): void {
  cached = null
}
