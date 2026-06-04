import { existsSync, readFileSync } from 'fs'
import matter from 'gray-matter'
import { RULES_DATA_DIR } from './paths.js'
import { guardArray } from './loaderUtils.js'

const RULES_PATH = `${RULES_DATA_DIR}/dnd5e-rules.yaml`

interface RulesDataFile {
  cr_xp?: Record<string, number>
  char_xp_thresholds?: Record<number, [number, number, number, number]>
  xp_multipliers?: Array<[number, number]>
  standard_5e_skills?: string[]
  stat_block_implicit_fields?: string[]
}

let cached: RulesDataFile | null = null

function load(): RulesDataFile {
  if (cached) return cached
  if (!existsSync(RULES_PATH)) { cached = {}; return cached }
  const raw = readFileSync(RULES_PATH, 'utf-8')
  cached = matter(`---\n${raw}\n---`).data as RulesDataFile
  return cached
}

export function getCrXpTable(): Record<string, number> {
  return load().cr_xp ?? {}
}

export function getCharXpThresholds(): Record<number, [number, number, number, number]> {
  return load().char_xp_thresholds ?? {}
}

export function getXpMultipliers(): Array<[number, number]> {
  return guardArray<[number, number]>(load().xp_multipliers, 'xp_multipliers')
}

export function getStandard5eSkills(): Set<string> {
  return new Set(guardArray<string>(load().standard_5e_skills, 'standard_5e_skills'))
}

export function getStatBlockImplicitFields(): Set<string> {
  return new Set(guardArray<string>(load().stat_block_implicit_fields, 'stat_block_implicit_fields'))
}

export function clearRulesDataCacheForTests(): void {
  cached = null
}
