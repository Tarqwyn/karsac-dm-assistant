/**
 * adversary-design.ts
 *
 * Supports the adversary-design profile: base detection, file loading,
 * and context assembly for creating or adapting D&D 5e 2014 adversaries.
 */

import { resolve } from 'path'
import { readFileSync, existsSync } from 'fs'
import matter from 'gray-matter'
import { loadScoredAdversaries } from './encounter-design.js'
import type { ScoredAdversary } from './encounter-design.js'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BaseFile {
  id: string
  slug: string
  name: string
  content: string   // full markdown including stat block
  path: string
}

export interface AdversaryDesignContext {
  requestedBase: string | null          // raw user-facing base name ("spy", "veteran")
  baseFile: BaseFile | null             // full stat block markdown
  relatedAdversaries: ScoredAdversary[] // Karsac adversary corpus context
  stateData: {
    campaignState: Record<string, unknown> | null
    worldThreads:  Record<string, unknown> | null
    npcsState:     Record<string, unknown> | null
  }
  loadedFiles: string[]
}

// ── Base slug map ─────────────────────────────────────────────────────────────
// Maps user-facing names (lowercase) to the monster collection filename slug.

const BASE_SLUG_MAP: Record<string, string> = {
  'spy':             'spy',
  'noble':           'noble',
  'guard':           'guard',
  'veteran':         'veteran',
  'bandit captain':  'bandit-captain',
  'bandit-captain':  'bandit-captain',
  'bandit':          'bandit',
  'thug':            'thug',
  'scout':           'scout',
  'mage':            'mage',
  'priest':          'priest',
  'acolyte':         'acolyte',
  'assassin':        'assassin',
  'archmage':        'archmage',
  'commoner':        'commoner',
  'knight':          'knight',
  'berserker':       'berserker',
  'gladiator':       'gladiator',
}

// Ordered from longest to shortest to avoid early partial matches
const BASE_NAMES_ORDERED = Object.keys(BASE_SLUG_MAP).sort((a, b) => b.length - a.length)

// ── Base detection ────────────────────────────────────────────────────────────

/**
 * Detect a mechanical base name from the user's question.
 *
 * Looks for patterns like:
 *   "based on the Spy NPC"
 *   "using the Veteran base"
 *   "use spy as a base"
 *   "Spy as the base"
 *   Just a direct name mention as fallback.
 *
 * Returns the raw matched name (e.g. "spy") or null.
 */
export function detectRequestedBase(question: string): string | null {
  const lq = question.toLowerCase()

  // Explicit context patterns first (most discriminating)
  const contextPatterns = [
    /(?:based\s+on\s+(?:the|a)\s+)([\w\s-]+?)(?:\s+(?:npc|base|stat\s+block|as)|\s*$|[,.])/i,
    /(?:using\s+(?:the|a)\s+)([\w\s-]+?)(?:\s+(?:as|base|npc)|\s*$|[,.])/i,
    /(?:use\s+(?:the|a)?\s*)([\w\s-]+?)(?:\s+as\s+(?:a\s+)?base|\s+base)/i,
    /(?:the\s+)([\w\s-]+?)(?:\s+(?:base|npc|stat\s+block|as\s+a\s+base))/i,
    /([\w\s-]+?)\s+as\s+(?:the|a)\s+(?:mechanical\s+)?base/i,
  ]

  for (const re of contextPatterns) {
    const m = question.match(re)
    if (m) {
      const candidate = m[1].trim().toLowerCase()
      for (const name of BASE_NAMES_ORDERED) {
        if (candidate.includes(name)) return name
      }
    }
  }

  // Fallback: any direct mention of a known base in the question
  for (const name of BASE_NAMES_ORDERED) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (new RegExp(`\\b${escaped}s?\\b`, 'i').test(question)) return name
  }

  return null
}

// ── Base file loading ─────────────────────────────────────────────────────────

/**
 * Load the full stat block markdown for a given base name.
 * Falls back gracefully if the file does not exist.
 */
export function loadBaseFile(
  baseName: string,
  collectionsRoot: string,
): BaseFile | null {
  const slug = BASE_SLUG_MAP[baseName.toLowerCase()] ?? baseName.toLowerCase().replace(/\s+/g, '-')
  const filePath = resolve(collectionsRoot, 'karsac-monsters-srd-2014', `${slug}.md`)

  if (!existsSync(filePath)) return null

  const raw = readFileSync(filePath, { encoding: 'utf-8' })
  const { data: fm } = matter(raw)

  return {
    id: String(fm.id ?? `monsters/srd-2014/${slug}`),
    slug,
    name: String(fm.name ?? slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())),
    content: raw,  // include full frontmatter + body
    path: filePath,
  }
}

// ── Adversary corpus relevance scoring ───────────────────────────────────────

/**
 * Load Karsac adversaries relevant to the query.
 * These are used for thematic context, not as the base stat block.
 */
export function loadContextAdversaries(
  adversaryCorpusRoot: string,
  question: string,
): ScoredAdversary[] {
  // For adversary-design, only load adversaries if the query has faction/theme signals.
  // Do not load adversaries for generic "make me a spy" requests.
  const hasFactionSignal = /mathr|vane|maw|vishara|yantravaq|shadow.walk|housecarl|karsac|losweg|torweg|valweg/i.test(question)
  if (!hasFactionSignal) return []

  return loadScoredAdversaries(adversaryCorpusRoot, question, 2)
}

// ── Output validation ─────────────────────────────────────────────────────────

export interface AdversaryValidation {
  violations: string[]
  valid: boolean
}

/**
 * Structurally validate adversary-design model output.
 * Checks mechanical inconsistencies that are verifiable without NLP.
 */
export function validateAdversaryOutput(
  outputText: string,
  requestedBase: string | null,
  baseContent: string | null,
): AdversaryValidation {
  const violations: string[] = []
  const lower = outputText.toLowerCase()

  // D&D stat block ability format: **Name.** Description (period BEFORE closing **)
  // Extract the Actions section using flexible heading depth (##, ###)
  const actionsSection = outputText.match(/#{2,3}\s+Actions\s*\n([\s\S]*?)(?=\n#{2,3}\s|\s*$)/i)?.[1] ?? ''

  // Item 4: Bonus Action inside Actions section
  if (/\(bonus\s+action\)/i.test(actionsSection)) {
    violations.push('Action economy: "(Bonus Action)" ability found under Actions section — move it to Bonus Actions')
  }

  // Item 3: Stale name — ability text uses a different adversary's name
  // D&D format: **Name.** Description — period is INSIDE closing bold
  const adversaryNameMatch = outputText.match(/^#\s+Adversary:\s+(.+)$/im)
  const adversaryName = adversaryNameMatch ? adversaryNameMatch[1].trim() : null
  if (adversaryName) {
    // Match: **AbilityName.** ProperNoun does/chooses/orders...
    const abilityTexts = outputText.match(/\*\*[^*]+\.\*\*\s+[^*\n]+/g) ?? []
    for (const abilityText of abilityTexts) {
      const nameUsed = abilityText.match(/\*\*[^*]+\.\*\*\s+([A-Z][a-z]{2,})'?s?\s+(?:chooses?|orders?|picks?|signals?|directs?)/)
      if (nameUsed) {
        const usedName = nameUsed[1].replace(/'s$/, '')
        if (!adversaryName.toLowerCase().includes(usedName.toLowerCase())) {
          violations.push(`Stale name in ability text: "${usedName}" is not this adversary ("${adversaryName}")`)
        }
      }
    }
  }

  // Item 2: Unexplained darkvision when base has none
  if (/darkvision/i.test(outputText) && baseContent && !/darkvision/i.test(baseContent)) {
    const statBlockSection = outputText.match(/#{2,3}\s+Stat\s+Block\s*\n([\s\S]*?)(?=\n##\s|\s*$)/i)?.[1] ?? ''
    if (/darkvision/i.test(statBlockSection)) {
      const adaptSection = outputText.match(/##\s+Adaptation\s+Summary\s*\n([\s\S]*?)(?=\n##\s|\s*$)/i)?.[1] ?? ''
      if (!/darkvision/i.test(adaptSection)) {
        violations.push(`Unexplained darkvision: base has none but stat block adds it without explanation in Adaptation Summary`)
      }
    }
  }

  // Item 5: Round-based delays in social context
  const roundDelayMatch = outputText.match(/delayed?\s+(?:for\s+)?\d+d\d+\s+rounds?/i)
  if (roundDelayMatch) {
    violations.push(`Round-based delay in social context: "${roundDelayMatch[0]}" — use scene consequences instead`)
  }

  // Item 6: Social-led "fights to the death" — only when affirmative (skip negations)
  const fightDeathMatches = [...outputText.matchAll(/\bfight(?:s)?\s+to\s+the\s+death/gi)]
  for (const match of fightDeathMatches) {
    const before = outputText.slice(Math.max(0, (match.index ?? 0) - 25), match.index ?? 0)
    const isNegated = /\b(?:not|never|don'?t|does\s+not|do\s+not|without)\b/i.test(before)
    if (!isNegated) {
      const designSection = outputText.match(/##\s+Design\s+Intent\s*\n([\s\S]*?)(?=\n##\s|\s*$)/i)?.[1] ?? ''
      if (/social.led|social\s+threat|not\s+combat/i.test(designSection)) {
        violations.push('"fights to the death" for a social-led adversary — use escape/de-escalation instead')
        break
      }
    }
  }

  // Modern tech language
  const modernTerms = ['database', 'surveillance system', 'tracking device', 'scanner']
  for (const term of modernTerms) {
    if (lower.includes(term)) {
      violations.push(`Modern tech language: "${term}" — replace with Karsac equivalent (harbour ledger, copied manifest, etc.)`)
    }
  }

  // Non-5e skill: Diplomacy
  if (/\bDiplomacy\b/.test(outputText)) {
    violations.push('Non-5e skill: "Diplomacy" is not a D&D 5e 2014 skill — use Persuasion instead')
  }

  // Damage formula accuracy: stated average should match dice formula
  for (const match of outputText.matchAll(/\bHit:\s+(\d+)\s*\((\d+)d(\d+)([^)]*)\)/gi)) {
    const stated = parseInt(match[1])
    const numDice = parseInt(match[2])
    const dieSize = parseInt(match[3])
    const modPart = match[4] ?? ''
    const modMatch = modPart.match(/([+-])\s*(\d+)/)
    const mod = modMatch ? (modMatch[1] === '+' ? parseInt(modMatch[2]) : -parseInt(modMatch[2])) : 0
    const diceAvg = Math.floor(numDice * (dieSize + 1) / 2)
    const expected = diceAvg + mod
    if (Math.abs(stated - expected) > 1) {
      violations.push(`Damage formula: stated "Hit: ${stated}" but average of ${numDice}d${dieSize}${mod !== 0 ? (mod > 0 ? '+'+mod : mod) : ''} is ${expected}`)
    }
  }

  return { violations, valid: violations.length === 0 }
}

/**
 * Auto-repair adversary output for mechanical violations that can be fixed
 * deterministically (without re-calling the model).
 *
 * Currently handles:
 * - Removing unexplained darkvision from senses line (item 1)
 */
export function repairAdversaryOutput(
  outputText: string,
  validation: AdversaryValidation,
  _baseContent: string | null,
): string {
  let repaired = outputText

  if (validation.violations.some(v => v.toLowerCase().includes('unexplained darkvision'))) {
    // Strip ", Darkvision N ft." or "Darkvision N ft., " from the senses line
    repaired = repaired.replace(/,\s*Darkvision\s+\d+\s*ft\.?/gi, '')
    repaired = repaired.replace(/Darkvision\s+\d+\s*ft\.?,?\s*/gi, '')
    // Clean up double commas or leading comma+space that might remain
    repaired = repaired.replace(/\*\*Senses\*\*\s*,/g, '**Senses**')
    repaired = repaired.replace(/Senses\s*,/gi, 'Senses')
  }

  return repaired
}
