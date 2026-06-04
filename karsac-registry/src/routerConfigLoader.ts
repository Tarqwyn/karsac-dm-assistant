import { existsSync, readFileSync } from 'fs'
import matter from 'gray-matter'
import { REGISTRY_ROOT } from './paths.js'
import { guardArray } from './loaderUtils.js'

const ROUTER_CONFIG_PATH = `${REGISTRY_ROOT}/router-config.yaml`

interface TermCheck { pattern: string; label: string }
interface ExplicitOpeningPattern { pattern: string; proposal_type: string }

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
  adversary_proposal_pattern?: string
  adversary_term_checks?: TermCheck[]
  place_indicator_terms?: string[]
  explicit_proposal_opening_patterns?: ExplicitOpeningPattern[]
  adversary_prompt_signals?: string
  npc_prompt_signals?: string
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

export function getRulesTerms(): readonly string[] { return guardArray<string>(load().rules_terms, 'rules_terms') }
export function getDesignTerms(): readonly string[] { return guardArray<string>(load().design_terms, 'design_terms') }
export function getDeepLoreTerms(): readonly string[] { return guardArray<string>(load().deep_lore_terms, 'deep_lore_terms') }
export function getStrongProseTerms(): readonly string[] { return guardArray<string>(load().strong_prose_terms, 'strong_prose_terms') }
export function getWeakProseTerms(): readonly string[] { return guardArray<string>(load().weak_prose_terms, 'weak_prose_terms') }
export function getStateTerms(): readonly string[] { return guardArray<string>(load().state_terms, 'state_terms') }
export function getAdversaryDesignTerms(): readonly string[] { return guardArray<string>(load().adversary_design_terms, 'adversary_design_terms') }
export function getEncounterDesignTerms(): readonly string[] { return guardArray<string>(load().encounter_design_terms, 'encounter_design_terms') }
export function getCanonTerms(): readonly string[] { return guardArray<string>(load().canon_terms, 'canon_terms') }

export function getExplicitEncounterScenePattern(): RegExp {
  const p = load().explicit_encounter_scene_pattern
  return p ? new RegExp(p, 'i') : /\bdesign\s+an?\s+encounter\b/i
}

export function getAdversaryProposalPattern(): RegExp {
  const p = load().adversary_proposal_pattern
  return p ? new RegExp(p, 'i') : /\badversary\b/i
}

export function getAdversaryTermChecks(): Array<{ regex: RegExp; label: string }> {
  return guardArray<TermCheck>(load().adversary_term_checks, 'adversary_term_checks')
    .map((c) => ({ regex: new RegExp(c.pattern, 'i'), label: c.label }))
}

export function getPlaceIndicatorTerms(): readonly string[] { return guardArray<string>(load().place_indicator_terms, 'place_indicator_terms') }

export function getExplicitProposalOpeningPatterns(): Array<{ regex: RegExp; proposalType: string }> {
  return guardArray<ExplicitOpeningPattern>(load().explicit_proposal_opening_patterns, 'explicit_proposal_opening_patterns')
    .map((e) => ({ regex: new RegExp(e.pattern, 'i'), proposalType: e.proposal_type }))
}

export function getAdversaryPromptSignals(): RegExp {
  const p = load().adversary_prompt_signals
  return p ? new RegExp(p, 'i') : /\badversary\b/i
}

export function getNpcPromptSignals(): RegExp {
  const p = load().npc_prompt_signals
  return p ? new RegExp(p, 'i') : /propose\s+a\s+new\s+npc/i
}

export function clearRouterConfigCacheForTests(): void {
  cached = null
}
