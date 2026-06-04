import { readdirSync, readFileSync, existsSync } from 'fs'
import { resolve, basename } from 'path'
import matter from 'gray-matter'
import {
  getSocialQueryPattern, getMonsterExceptionPattern,
  getDockArrivalKeywords, getArrivalEventPattern,
  getPatternBoosts, getPatternExclusionGuards,
} from './encounterScoringLoader.js'
import { getNpcBaseSummariesMap } from './adversaryBasesLoader.js'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ScoredAdversary {
  id: string
  name: string
  tags: string[]
  oppositionType: string[]
  encounterRoles: string[]
  campaignUse: string[]
  mechanicalBase: string[]
  canKnow: string[]
  mustNotKnow: string[]
  tactics: string[]
  escalation: { low?: string; medium?: string; high?: string }
  playerSafeReveal: string[]
  dmOnly: string[]
  summary: string
  content: string
  path: string
  score: number
  scoreReasons: string[]
}

export interface ScoredPattern {
  id: string
  name: string
  encounterType: string[]
  useWhen: string[]
  doNotUseWhen: string[]
  usefulNpcBases: string[]
  commonChecks: string[]
  summary: string
  content: string
  score: number
}

// ── NPC base summaries ────────────────────────────────────────────────────────

const NPC_BASES: Record<string, string> = getNpcBaseSummariesMap()

// ── Social vs monster query detection ────────────────────────────────────────

// Loaded from corpus/registry/encounter-scoring.yaml
const SOCIAL_QUERY_PATTERN = getSocialQueryPattern()
// "non-monster" must NEVER be treated as a monster exception keyword.
const MONSTER_EXCEPTION_PATTERN = getMonsterExceptionPattern()

/** True when query explicitly requests monsters/combat (as opposed to social encounters). */
function hasMonsterException(question: string): boolean {
  if (/\bnon-monster\b/i.test(question)) return false // "non-monster" overrides any other signal
  return MONSTER_EXCEPTION_PATTERN.test(question)
}

/** True when the query is clearly asking for a social/procedural (non-monster) encounter. */
function isSocialQuery(question: string): boolean {
  return SOCIAL_QUERY_PATTERN.test(question)
}

/** True when the adversary file is fundamentally a monster, not an NPC social actor. */
function isMonsterAdversary(fm: Record<string, unknown>): boolean {
  for (const ot of toArray(fm.opposition_type)) {
    if (ot.toLowerCase() === 'monster') return true
  }
  for (const tag of toArray(fm.tags)) {
    if (tag.toLowerCase() === 'monster') return true
  }
  if (String(fm.type ?? '') === 'monster') return true
  return false
}

// ── Keyword-to-pattern boost map ──────────────────────────────────────────────

// Loaded from corpus/registry/encounter-scoring.yaml
const PATTERN_BOOSTS: Array<[RegExp, string[]]> = getPatternBoosts()
const DOCK_ARRIVAL_KEYWORDS = getDockArrivalKeywords()
const ARRIVAL_EVENT_PATTERN = getArrivalEventPattern()
const PATTERN_EXCLUSION_GUARDS: Array<[string, RegExp]> = getPatternExclusionGuards()

// ── Helpers ───────────────────────────────────────────────────────────────────

function toArray(val: unknown): string[] {
  if (!val) return []
  if (Array.isArray(val)) return val.map(String)
  if (typeof val === 'string') return [val]
  return []
}

function toStringMap(val: unknown): Record<string, string> {
  if (!val || typeof val !== 'object' || Array.isArray(val)) return {}
  const result: Record<string, string> = {}
  for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
    if (typeof v === 'string') result[k] = v
  }
  return result
}

/** Extract a human-readable name from the id or filename. */
function idToName(id: string, filePath: string): string {
  const slug = basename(filePath, '.md')
  return slug
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// ── Scoring ───────────────────────────────────────────────────────────────────

function scoreAdversary(
  fm: Record<string, unknown>,
  content: string,
  summary: string,
  question: string,
): { score: number; reasons: string[] } {
  const lq = question.toLowerCase()
  let score = 0
  const reasons: string[] = []

  // Extract the adversary slug from the id
  const id = String(fm.id ?? '')
  const slugParts = id.split('/').pop()?.split('-') ?? []

  // Direct ID keyword match: e.g. "false customs" matches "false-customs-officers"
  if (slugParts.length >= 2) {
    // Try pairs of consecutive slug words
    for (let i = 0; i < slugParts.length - 1; i++) {
      const phrase = slugParts[i] + ' ' + slugParts[i + 1]
      if (lq.includes(phrase)) {
        score += 8
        reasons.push(`id-keyword: ${phrase}`)
        break
      }
    }
    // Also try full slug minus common suffixes
    const fullSlug = slugParts.join(' ')
    if (lq.includes(fullSlug) && !reasons.length) {
      score += 8
      reasons.push(`id-keyword: ${fullSlug}`)
    }
  }

  // campaign_use values
  for (const cu of toArray(fm.campaign_use)) {
    const cuNorm = cu.toLowerCase().replace(/-/g, ' ')
    if (lq.includes(cuNorm) || lq.includes(cu.toLowerCase())) {
      score += 5
      reasons.push(`campaign_use: ${cu}`)
    }
  }

  // opposition_type values
  for (const ot of toArray(fm.opposition_type)) {
    const otNorm = ot.toLowerCase().replace(/-/g, ' ')
    if (lq.includes(otNorm) || lq.includes(ot.toLowerCase())) {
      score += 4
      reasons.push(`opposition_type: ${ot}`)
    }
  }

  // tags values
  for (const tag of toArray(fm.tags)) {
    const tagNorm = tag.toLowerCase().replace(/-/g, ' ')
    if (lq.includes(tagNorm) || lq.includes(tag.toLowerCase())) {
      score += 3
      reasons.push(`tag: ${tag}`)
    }
  }

  // encounter_roles values
  for (const er of toArray(fm.encounter_roles)) {
    const erNorm = er.toLowerCase().replace(/-/g, ' ')
    if (lq.includes(erNorm) || lq.includes(er.toLowerCase())) {
      score += 2
      reasons.push(`encounter_role: ${er}`)
    }
  }

  // Summary keyword overlap (words >4 chars)
  const summaryWords = summary.toLowerCase().split(/\W+/).filter(w => w.length > 4)
  const questionWords = new Set(lq.split(/\W+/).filter(w => w.length > 4))
  for (const sw of summaryWords) {
    if (questionWords.has(sw)) {
      score += 1
      reasons.push(`summary-kw: ${sw}`)
    }
  }

  // ── Monster exclusion for social queries ──────────────────────────────────
  // Down-rank monster adversaries when the query is social/procedural.
  // "non-monster" in the query is an unconditional override.
  // Other social contexts also exclude monsters unless combat/creature is requested.
  if (isMonsterAdversary(fm)) {
    if (/\bnon-monster\b/i.test(question) || (isSocialQuery(question) && !hasMonsterException(question))) {
      score -= 20
      reasons.push('excluded: monster adversary in non-monster/social query')
    }
  }

  // ── Dock/arrival context boost for social adversaries ─────────────────────
  // Give a flat +4 boost to adversaries with any dock-related campaign_use.
  if (DOCK_ARRIVAL_KEYWORDS.test(question)) {
    const DOCK_CU = new Set(['dock-pressure', 'valweg-arrival', 'social-obstruction', 'information-extraction'])
    for (const cu of toArray(fm.campaign_use)) {
      if (DOCK_CU.has(cu)) {
        score += 4
        reasons.push(`dock-context boost: ${cu}`)
        break  // one boost per adversary from this rule
      }
    }
  }

  // ── False-official / customs specialist boost ─────────────────────────────
  // Adversaries tagged false-official or customs get a bonus when the query
  // describes a dock, arrival, or inspection scene — ensuring they rank above
  // generic Valweg-tagged adversaries (e.g. valweg-informants).
  if (DOCK_ARRIVAL_KEYWORDS.test(question)) {
    const fmTags = toArray(fm.tags)
    if (fmTags.includes('false-official') || fmTags.includes('customs')) {
      score += 5
      reasons.push('false-official/customs specialist boost')
      // Extra boost when both dock context AND Mathr/faction explicitly named
      if (/mathr|faction[- ]agent/i.test(question)) {
        score += 3
        reasons.push('false-official + mathr-faction boost')
      }
    }
  }

  // ── Arrival-event boost for false-official/customs adversaries ─────────────
  // When the query specifically describes arriving at a port, gate, or named
  // location, strongly prefer adversaries designed for arrival-scene obstruction.
  // This prevents generic Valweg-tagged adversaries from beating the arrival-
  // specific false-customs-officers adversary.
  const isArrivalEvent = ARRIVAL_EVENT_PATTERN.test(question) &&
    (DOCK_ARRIVAL_KEYWORDS.test(question) || /valweg|torweg|losweg/i.test(question))
  if (isArrivalEvent) {
    if (toArray(fm.campaign_use).includes('valweg-arrival')) {
      score += 8
      reasons.push('arrival-event boost: valweg-arrival campaign_use')
    }
    const fmTags = toArray(fm.tags)
    if (fmTags.includes('false-official') || fmTags.includes('customs')) {
      score += 4
      reasons.push('arrival-event boost: false-official/customs tag')
    }
  }

  return { score, reasons }
}

function scorePattern(
  fm: Record<string, unknown>,
  filePath: string,
  question: string,
): { score: number } {
  const lq = question.toLowerCase()
  let score = 0

  // Filename keyword match
  const slug = basename(filePath, '.md')
  const slugWords = slug.split('-')
  for (let i = 0; i < slugWords.length - 1; i++) {
    const phrase = slugWords[i] + ' ' + slugWords[i + 1]
    if (lq.includes(phrase)) { score += 5; break }
  }
  if (lq.includes(slug.replace(/-/g, ' '))) score += 5

  // encounter_type match
  for (const et of toArray(fm.encounter_type)) {
    const etNorm = et.toLowerCase().replace(/-/g, ' ')
    if (lq.includes(etNorm)) { score += 4; break }
  }

  // use_when keyword match
  for (const uw of toArray(fm.use_when)) {
    const uwLower = uw.toLowerCase()
    const uwWords = uwLower.split(/\W+/).filter(w => w.length > 4)
    for (const w of uwWords) {
      if (lq.includes(w)) { score += 3; break }
    }
  }

  // Keyword-to-pattern boosts: specific query context strongly favours certain patterns
  for (const [regex, boostedSlugs] of PATTERN_BOOSTS) {
    if (regex.test(question) && boostedSlugs.includes(slug)) {
      score += 6
      break
    }
  }

  // Pattern exclusion guards: some patterns require specific keywords to be selected.
  // Without the required keywords, the pattern is irrelevant — hard-exclude it.
  for (const [guardSlug, requiredKeywords] of PATTERN_EXCLUSION_GUARDS) {
    if (slug === guardSlug && !requiredKeywords.test(question)) {
      score = 0
      break
    }
  }

  return { score }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Scan adversaryCorpusRoot/*.md, parse frontmatter, score against question.
 */
export function loadScoredAdversaries(
  adversaryCorpusRoot: string,
  question: string,
  maxResults = 3,
): ScoredAdversary[] {
  if (!existsSync(adversaryCorpusRoot)) return []

  const files = readdirSync(adversaryCorpusRoot).filter(f => f.endsWith('.md'))
  const results: ScoredAdversary[] = []

  for (const file of files) {
    const filePath = resolve(adversaryCorpusRoot, file)
    const raw = readFileSync(filePath, { encoding: 'utf-8' })
    const parsed = matter(raw)
    const fm = parsed.data as Record<string, unknown>
    const content = parsed.content
    const summary = String(fm.summary ?? '')

    const { score, reasons } = scoreAdversary(fm, content, summary, question)
    if (score <= 0) continue

    const escalation = toStringMap(fm.escalation)

    results.push({
      id: String(fm.id ?? ''),
      name: idToName(String(fm.id ?? ''), filePath),
      tags: toArray(fm.tags),
      oppositionType: toArray(fm.opposition_type),
      encounterRoles: toArray(fm.encounter_roles),
      campaignUse: toArray(fm.campaign_use),
      mechanicalBase: toArray(fm.mechanical_base),
      canKnow: toArray(fm.can_know),
      mustNotKnow: toArray(fm.must_not_know),
      tactics: toArray(fm.tactics),
      escalation,
      playerSafeReveal: toArray(fm.player_safe_reveal),
      dmOnly: toArray(fm.dm_only),
      summary,
      content,
      path: filePath,
      score,
      scoreReasons: reasons,
    })
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
}

/**
 * Scan patternsRoot/*.md, parse frontmatter, score against question.
 */
export function loadScoredPatterns(
  patternsRoot: string,
  question: string,
  maxResults = 2,
): ScoredPattern[] {
  if (!existsSync(patternsRoot)) return []

  const files = readdirSync(patternsRoot).filter(f => f.endsWith('.md'))
  const results: ScoredPattern[] = []

  for (const file of files) {
    const filePath = resolve(patternsRoot, file)
    const raw = readFileSync(filePath, { encoding: 'utf-8' })
    const parsed = matter(raw)
    const fm = parsed.data as Record<string, unknown>

    const { score } = scorePattern(fm, filePath, question)
    if (score <= 0) continue

    const slug = basename(filePath, '.md')
    const name = slug
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')

    results.push({
      id: String(fm.id ?? slug),
      name,
      encounterType: toArray(fm.encounter_type),
      useWhen: toArray(fm.use_when),
      doNotUseWhen: toArray(fm.do_not_use_when),
      usefulNpcBases: toArray(fm.useful_npc_bases),
      commonChecks: toArray(fm.common_checks),
      summary: String(fm.summary ?? ''),
      content: parsed.content,
      score,
    })
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
}

// ── Validation ────────────────────────────────────────────────────────────────

export interface EncounterDesignValidation {
  adversaryViolations: string[]
  patternViolations: string[]
  valid: boolean
}

/**
 * Validate that the selected adversaries and patterns respect the query's
 * explicit constraints. Returns a list of violations (empty = valid).
 *
 * Rules checked:
 * - Non-monster query → no monster-typed adversary in selection
 * - Arrival context → false-customs-officers should beat generic Valweg informants
 * - No bribery-attempt unless query has bribe/payment/toll/tax keywords
 * - No formal-audience unless query has audience/court/council/hearing/summons
 */
export function validateEncounterDesignContext(
  adversaries: ScoredAdversary[],
  patterns: ScoredPattern[],
  question: string,
): EncounterDesignValidation {
  const adversaryViolations: string[] = []
  const patternViolations: string[] = []

  // Non-monster query must not have monster-typed adversaries
  if (isSocialQuery(question) && !hasMonsterException(question)) {
    for (const adv of adversaries) {
      if (adv.oppositionType.includes('monster') || adv.tags.includes('monster')) {
        adversaryViolations.push(
          `monster adversary "${adv.id}" selected for non-monster query`,
        )
      }
    }
  }

  // Arrival context: false-customs-officers should be top if present
  const isArrivalEvent = ARRIVAL_EVENT_PATTERN.test(question) &&
    (DOCK_ARRIVAL_KEYWORDS.test(question) || /valweg|torweg|losweg/i.test(question))
  if (isArrivalEvent && adversaries.length >= 2) {
    const topId = adversaries[0].id
    const hasFalseCustoms = adversaries.some(a => a.id.includes('false-customs'))
    const topIsGenericValweg = topId.includes('valweg-informant') && hasFalseCustoms
    if (topIsGenericValweg) {
      adversaryViolations.push(
        `valweg-informants ranked above false-customs-officers for arrival-context query`,
      )
    }
  }

  // Pattern guards
  for (const pat of patterns) {
    const slug = pat.id.split('/').pop() ?? pat.id
    for (const [guardSlug, requiredKeywords] of PATTERN_EXCLUSION_GUARDS) {
      if (slug === guardSlug && !requiredKeywords.test(question)) {
        patternViolations.push(
          `pattern "${guardSlug}" selected without required keywords`,
        )
      }
    }
  }

  return {
    adversaryViolations,
    patternViolations,
    valid: adversaryViolations.length === 0 && patternViolations.length === 0,
  }
}

/**
 * Return NPC base summaries for a list of mechanical_base refs.
 * Refs may be in the form "npc-bases/srd-2014/spy" or plain "spy".
 */
export function getNpcBaseSummaries(mechanicalBases: string[]): Record<string, string> {
  const result: Record<string, string> = {}
  for (const ref of mechanicalBases) {
    // Normalise "npc-bases/srd-2014/spy" → "spy"
    const key = ref.split('/').pop()?.toLowerCase() ?? ref.toLowerCase()
    if (NPC_BASES[key]) {
      result[ref] = NPC_BASES[key]
    }
  }
  return result
}
