import { existsSync, readFileSync } from 'fs'
import matter from 'gray-matter'
import { REGISTRY_ROOT } from '../paths.js'
import { guardArray } from '../loaderUtils.js'

const STYLE_GUARDS_PATH = `${REGISTRY_ROOT}/style-guards.yaml`

interface StyleGuardsFile {
  sentence_boundary_pronouns?: string[]
  common_noun_skips?: string[]
  title_tokens?: string[]
  cosmological_force_names?: string[]
  generic_single_word_skips?: string[]
  org_type_suffixes?: string[]
  org_stop_words?: string[]
}

let cached: StyleGuardsFile | null = null

function load(): StyleGuardsFile {
  if (cached) return cached
  if (!existsSync(STYLE_GUARDS_PATH)) {
    cached = {}
    return cached
  }
  const raw = readFileSync(STYLE_GUARDS_PATH, 'utf-8')
  cached = matter(`---\n${raw}\n---`).data as StyleGuardsFile
  return cached
}

export function getSentenceBoundaryPronouns(): Set<string> {
  return new Set(guardArray<string>(load().sentence_boundary_pronouns, 'sentence_boundary_pronouns'))
}

export function getCommonNounSkips(): Set<string> {
  return new Set(guardArray<string>(load().common_noun_skips, 'common_noun_skips'))
}

export function getTitleTokens(): Set<string> {
  return new Set(guardArray<string>(load().title_tokens, 'title_tokens'))
}

export function getCosmologicalForceNames(): Set<string> {
  return new Set(guardArray<string>(load().cosmological_force_names, 'cosmological_force_names'))
}

export function getGenericSingleWordSkips(): Set<string> {
  return new Set(guardArray<string>(load().generic_single_word_skips, 'generic_single_word_skips'))
}

export function getOrgTypeSuffixes(): Set<string> {
  return new Set(guardArray<string>(load().org_type_suffixes, 'org_type_suffixes'))
}

export function getOrgStopWords(): Set<string> {
  return new Set(guardArray<string>(load().org_stop_words, 'org_stop_words'))
}

/**
 * Builds the title-token alternation string for use in regex patterns.
 * e.g. "King|Jarl|Lord|Lady|..."
 */
export function getTitleTokenAlternation(): string {
  return [...getTitleTokens()].map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
}

export function clearStyleGuardsCacheForTests(): void {
  cached = null
}
