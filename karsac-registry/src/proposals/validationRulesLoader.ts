import { existsSync, readFileSync } from 'fs'
import matter from 'gray-matter'
import { REGISTRY_ROOT } from '../paths.js'
import { guardArray } from '../loaderUtils.js'

const VALIDATION_RULES_PATH = `${REGISTRY_ROOT}/validation-rules.yaml`

interface WarningRule {
  id: string
  pattern: string
  secondary_pattern?: string
  flags?: string
  severity: 'warn' | 'fail'
  message: string
}

interface PatternEntry {
  pattern: string
  label: string
}

interface ValidationRulesFile {
  warning_rules?: WarningRule[]
  action_economy_pattern?: string
  action_economy_message?: string
  state_change_terms?: string[]
  canonical_alignments?: string[]
  modern_tech_pattern?: string
  forbidden_monster_patterns?: PatternEntry[]
  homebrew_violation_patterns?: PatternEntry[]
  attack_pattern?: string
}

export interface CompiledWarningRule {
  id: string
  regex: RegExp
  secondaryRegex?: RegExp
  severity: 'warn' | 'fail'
  message: string
}

let cached: ValidationRulesFile | null = null

function load(): ValidationRulesFile {
  if (cached) return cached
  if (!existsSync(VALIDATION_RULES_PATH)) {
    cached = {}
    return cached
  }
  const raw = readFileSync(VALIDATION_RULES_PATH, 'utf-8')
  cached = matter(`---\n${raw}\n---`).data as ValidationRulesFile
  return cached
}

export function getWarningRules(): CompiledWarningRule[] {
  return guardArray<WarningRule>(load().warning_rules, 'warning_rules').map((rule) => ({
    id: rule.id,
    regex: new RegExp(rule.pattern, rule.flags ?? 'i'),
    secondaryRegex: rule.secondary_pattern ? new RegExp(rule.secondary_pattern, rule.flags ?? 'i') : undefined,
    severity: rule.severity,
    message: rule.message,
  }))
}

export function getActionEconomyPattern(): RegExp | null {
  const p = load().action_economy_pattern
  return p ? new RegExp(p, 'i') : null
}

export function getActionEconomyMessage(): string {
  return load().action_economy_message ?? ''
}

export function getStateChangePattern(): RegExp | null {
  const terms = guardArray<string>(load().state_change_terms, 'state_change_terms')
  if (terms.length === 0) return null
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  return new RegExp(`\\b(${escaped})\\b`, 'i')
}

export function getCanonicalAlignments(): Set<string> {
  return new Set(guardArray<string>(load().canonical_alignments, 'canonical_alignments'))
}

export function getModernTechPattern(): RegExp | null {
  const p = load().modern_tech_pattern
  return p ? new RegExp(p, 'i') : null
}

export function getForbiddenMonsterPatterns(): Array<[RegExp, string]> {
  return guardArray<PatternEntry>(load().forbidden_monster_patterns, 'forbidden_monster_patterns')
    .map((e) => [new RegExp(e.pattern, 'i'), e.label])
}

export function getHomebrewViolationPatterns(): Array<[RegExp, string]> {
  return guardArray<PatternEntry>(load().homebrew_violation_patterns, 'homebrew_violation_patterns')
    .map((e) => [new RegExp(e.pattern, 'i'), e.label])
}

export function getAttackPattern(): RegExp | null {
  const p = load().attack_pattern
  return p ? new RegExp(p, 'i') : null
}

export function clearValidationRulesCacheForTests(): void {
  cached = null
}
