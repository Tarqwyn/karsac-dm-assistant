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
import { getCanonicalLanguages, getFactionProfile, type FactionProfileOverrideConfig } from './faction-profiles.js'
import { getFactionMechanicalOverrides, type FactionMechanicalOverrideRule } from './faction-mechanical-overrides.js'
import { getCanonicalAlignments, getModernTechPattern } from './proposals/validationRulesLoader.js'

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

// ── Pre-generation constraint extraction ─────────────────────────────────────

export interface AdversaryProposalConstraints {
  lockedFaction:        string | null    // e.g. 'shadow-walkers'
  forbiddenFactions:    string[]         // e.g. ['mathr', 'yngondi', 'vishara']
  preferredBase:        string | null    // e.g. 'spy'
  allowedBases:         string[]         // loaded bases available for selection
  environmentContext:   string | null    // e.g. 'urban / towns / cities'
  variantOptionsRequired: boolean
  modularChoiceRule: { traits: number; actions: number; reactions: number } | null
}

interface FactionSpec {
  slug: string
  displayName: string
  mentionPattern: RegExp
  positivePatterns: RegExp[]
  dmNotesSynonyms: string[]
}

const FACTION_SPECS: FactionSpec[] = [
  {
    slug: 'shadow-walkers',
    displayName: 'Shadow Walkers',
    mentionPattern: /\bshadow(?:\s|-)?walkers?\b/i,
    positivePatterns: [
      /\bpart\s+of\s+(?:the\s+)?shadow(?:\s|-)?walkers?(?:\s+faction)?\b/i,
      /\bbelongs?\s+to\s+(?:the\s+)?shadow(?:\s|-)?walkers?\b/i,
      /\bserves?\s+(?:the\s+)?shadow(?:\s|-)?walkers?\b/i,
      /\bworks?\s+for\s+(?:the\s+)?shadow(?:\s|-)?walkers?\b/i,
      /\breports?\s+to\s+(?:the\s+)?shadow(?:\s|-)?walkers?\b/i,
      /\blinked\s+to\s+(?:the\s+)?shadow(?:\s|-)?walkers?\b/i,
      /\bshadow(?:\s|-)?walkers?\s+faction\b/i,
      /\bshadow(?:\s|-)?walker\s+(?:agent|operative|network)\b/i,
    ],
    dmNotesSynonyms: ['shadow-walker', 'shadow walker'],
  },
  {
    slug: 'mathr',
    displayName: 'Mathr',
    mentionPattern: /\bmathr\b/i,
    positivePatterns: [
      /\bpart\s+of\s+(?:the\s+)?mathr(?:\s+faction)?\b/i,
      /\bbelongs?\s+to\s+(?:the\s+)?mathr\b/i,
      /\bserves?\s+(?:the\s+)?mathr\b/i,
      /\bworks?\s+for\s+(?:the\s+)?mathr\b/i,
      /\breports?\s+to\s+(?:the\s+)?mathr\b/i,
      /\blinked\s+to\s+(?:the\s+)?mathr\b/i,
      /\bmathr\b.*(?:agent|operative|faction|network)/i,
      /(?:agent|operative|faction|network).*\bmathr\b/i,
    ],
    dmNotesSynonyms: ['mathr'],
  },
  {
    slug: 'yngondi',
    displayName: 'Yngondi',
    mentionPattern: /\byngondi\b/i,
    positivePatterns: [
      /\bpart\s+of\s+(?:the\s+)?yngondi(?:\s+faction)?\b/i,
      /\bbelongs?\s+to\s+(?:the\s+)?yngondi\b/i,
      /\bserves?\s+(?:the\s+)?yngondi\b/i,
      /\bworks?\s+for\s+(?:the\s+)?yngondi\b/i,
      /\breports?\s+to\s+(?:the\s+)?yngondi\b/i,
      /\blinked\s+to\s+(?:the\s+)?yngondi\b/i,
      /\byngondi\b.*(?:agent|operative|faction|network)/i,
      /(?:agent|operative|faction|network).*\byngondi\b/i,
    ],
    dmNotesSynonyms: ['yngondi'],
  },
  {
    slug: 'vishara',
    displayName: 'Vishara',
    mentionPattern: /\bvishara\b/i,
    positivePatterns: [
      /\bpart\s+of\s+(?:the\s+)?vishara(?:\s+faction)?\b/i,
      /\bbelongs?\s+to\s+(?:the\s+)?vishara\b/i,
      /\bserves?\s+(?:the\s+)?vishara\b/i,
      /\bworks?\s+for\s+(?:the\s+)?vishara\b/i,
      /\breports?\s+to\s+(?:the\s+)?vishara\b/i,
      /\blinked\s+to\s+(?:the\s+)?vishara\b/i,
      /\bvishara\b.*(?:agent|operative|faction|network)/i,
      /(?:agent|operative|faction|network).*\bvishara\b/i,
    ],
    dmNotesSynonyms: ['vishara'],
  },
  {
    slug: 'yantravaq',
    displayName: 'Yantravaq',
    mentionPattern: /\byantravaq\b/i,
    positivePatterns: [
      /\bpart\s+of\s+(?:the\s+)?yantravaq(?:\s+faction)?\b/i,
      /\bbelongs?\s+to\s+(?:the\s+)?yantravaq\b/i,
      /\bserves?\s+(?:the\s+)?yantravaq\b/i,
      /\bworks?\s+for\s+(?:the\s+)?yantravaq\b/i,
      /\breports?\s+to\s+(?:the\s+)?yantravaq\b/i,
      /\blinked\s+to\s+(?:the\s+)?yantravaq\b/i,
      /\byantravaq\b.*(?:agent|operative|faction|network)/i,
      /(?:agent|operative|faction|network).*\byantravaq\b/i,
    ],
    dmNotesSynonyms: ['yantravaq'],
  },
  {
    slug: 'vane',
    displayName: 'Vane',
    mentionPattern: /\bvane\b/i,
    positivePatterns: [
      /\bpart\s+of\s+(?:the\s+)?vane(?:\s+faction)?\b/i,
      /\bbelongs?\s+to\s+(?:the\s+)?vane\b/i,
      /\bserves?\s+(?:the\s+)?vane\b/i,
      /\bworks?\s+for\s+(?:the\s+)?vane\b/i,
      /\breports?\s+to\s+(?:the\s+)?vane\b/i,
      /\blinked\s+to\s+(?:the\s+)?vane\b/i,
      /\bvane\b.*(?:agent|operative|faction|network)/i,
      /(?:agent|operative|faction|network).*\bvane\b/i,
    ],
    dmNotesSynonyms: ['vane'],
  },
]

function uniqueOrdered(values: string[]): string[] {
  return [...new Set(values)]
}

function extractExplicitFactionMentions(text: string): string[] {
  const matches = FACTION_SPECS
    .map((spec) => {
      const match = text.match(spec.mentionPattern)
      return match?.index !== undefined ? { slug: spec.slug, index: match.index } : null
    })
    .filter((value): value is { slug: string; index: number } => value !== null)
    .sort((a, b) => a.index - b.index)

  return uniqueOrdered(matches.map((match) => match.slug))
}

function extractForbiddenFactions(prompt: string): string[] {
  const clauses = [...prompt.matchAll(/\bnot\s+([^.;:\n]+)/gi)]
  const forbidden: string[] = []

  for (const clauseMatch of clauses) {
    const clause = clauseMatch[1].trim()
    if (/^as\b/i.test(clause)) continue
    forbidden.push(...extractExplicitFactionMentions(clause))
  }

  return uniqueOrdered(forbidden)
}

function extractRequiredFactions(prompt: string): string[] {
  return uniqueOrdered(
    FACTION_SPECS
      .filter((spec) => spec.positivePatterns.some((pattern) => pattern.test(prompt)))
      .map((spec) => spec.slug),
  )
}

function getFactionSpec(slug: string): FactionSpec | undefined {
  return FACTION_SPECS.find((spec) => spec.slug === slug)
}

function isWarningViolation(violation: string): boolean {
  return violation.startsWith('WARN:')
}

function isNegativeFactionContext(sentence: string, forbidden: string): boolean {
  const escaped = forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patterns = [
    new RegExp(`\\bmust\\s+not\\s+know\\b[\\s\\S]{0,60}\\b${escaped}\\b`, 'i'),
    new RegExp(`\\bunaware\\s+of\\b[\\s\\S]{0,60}\\b${escaped}\\b`, 'i'),
    new RegExp(`\\bnot\\s+affiliated\\s+with\\b[\\s\\S]{0,60}\\b${escaped}\\b`, 'i'),
    new RegExp(`\\bnot\\s+directly\\s+controlled\\s+by\\b[\\s\\S]{0,60}\\b${escaped}\\b`, 'i'),
    new RegExp(`\\bnot\\s+connected\\s+to\\b[\\s\\S]{0,60}\\b${escaped}\\b`, 'i'),
    new RegExp(`\\bno\\s+direct\\s+link\\s+to\\b[\\s\\S]{0,60}\\b${escaped}\\b`, 'i'),
    new RegExp(`\\bno\\s+contact\\s+to\\b[\\s\\S]{0,60}\\b${escaped}\\b`, 'i'),
    new RegExp(`\\bindependent\\s+of\\b[\\s\\S]{0,60}\\b${escaped}\\b`, 'i'),
    new RegExp(`\\bnot\\s+linked\\s+to\\b[\\s\\S]{0,60}\\b${escaped}\\b`, 'i'),
    new RegExp(`\\boperating\\s+under\\s+the\\s+radar\\s+of\\b[\\s\\S]{0,60}\\b${escaped}\\b`, 'i'),
    new RegExp(`\\bforbidden[_\\s-]?factions?\\b[\\s\\S]{0,80}\\b${escaped}\\b`, 'i'),
    new RegExp(`\\bmust_not_know\\b[\\s\\S]{0,80}\\b${escaped}\\b`, 'i'),
    new RegExp(`\\bdo\\s+not\\s+know\\b[\\s\\S]{0,60}\\b${escaped}\\b`, 'i'),
  ]
  return patterns.some((pattern) => pattern.test(sentence))
}

function hasPositiveFactionAffiliation(sentence: string, forbidden: string): boolean {
  const escaped = forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patterns = [
    new RegExp(`\\baligned\\s+with\\b[\\s\\S]{0,40}\\b${escaped}\\b`, 'i'),
    new RegExp(`\\btied\\s+to\\b[\\s\\S]{0,40}\\b${escaped}\\b[\\s\\S]{0,20}\\bdirective\\b`, 'i'),
    new RegExp(`\\bprotecting\\b[\\s\\S]{0,20}\\b${escaped}\\b[\\s\\S]{0,20}\\basset\\b`, 'i'),
    new RegExp(`\\bserves?\\b[\\s\\S]{0,40}\\b${escaped}\\b`, 'i'),
    new RegExp(`\\breports?\\s+to\\b[\\s\\S]{0,40}\\b${escaped}\\b`, 'i'),
    new RegExp(`\\bagent\\s+of\\b[\\s\\S]{0,40}\\b${escaped}\\b`, 'i'),
    new RegExp(`\\bcontrolled\\s+by\\b[\\s\\S]{0,40}\\b${escaped}\\b`, 'i'),
    new RegExp(`\\blinked\\s+to\\b[\\s\\S]{0,40}\\b${escaped}(?:'s)?\\s+network\\b`, 'i'),
    new RegExp(`\\bworks?\\s+for\\b[\\s\\S]{0,40}\\b${escaped}\\b`, 'i'),
    new RegExp(`\\boperating\\s+for\\b[\\s\\S]{0,40}\\b${escaped}\\b`, 'i'),
    new RegExp(`\\bemployed\\s+by\\b[\\s\\S]{0,40}\\b${escaped}\\b`, 'i'),
    new RegExp(`\\bfaction:\\s*${escaped}\\b`, 'i'),
    new RegExp(`\\bfactions:\\s*\\[[^\\]]*\\b${escaped}\\b[^\\]]*\\]`, 'i'),
  ]
  return patterns.some((pattern) => pattern.test(sentence))
}

function expectedAverageFromDiceFormula(numDice: number, dieSize: number, modifier: number): number {
  return Math.floor((numDice * (dieSize + 1)) / 2) + modifier
}

function formatCreatureName(
  name: string,
  options: { definiteArticle?: boolean } = {},
): string {
  const trimmed = name.trim()
  if (!trimmed) return options.definiteArticle ? 'the adversary' : 'adversary'
  if (!options.definiteArticle) return trimmed
  if (/^the\s+/i.test(trimmed)) {
    return `the ${trimmed.replace(/^the\s+/i, '').trim()}`
  }
  return trimmed
}

function detectDexModifierFromStatBlock(statBlockSection: string): number | null {
  const rowMatch = statBlockSection.match(/\|\s*\d+\s+\([^)]+\)\s*\|\s*(\d+)\s+\(([+-]\d+)\)\s*\|\s*\d+\s+\([^)]+\)\s*\|\s*\d+\s+\([^)]+\)\s*\|\s*\d+\s+\([^)]+\)\s*\|\s*\d+\s+\([^)]+\)\s*\|/)
  if (!rowMatch) return null
  const parsed = Number(rowMatch[2])
  return Number.isFinite(parsed) ? parsed : null
}

function detectStrModifierFromStatBlock(statBlockSection: string): number | null {
  const rowMatch = statBlockSection.match(/\|\s*(\d+)\s+\(([+-]\d+)\)\s*\|\s*\d+\s+\([^)]+\)\s*\|\s*\d+\s+\([^)]+\)\s*\|\s*\d+\s+\([^)]+\)\s*\|\s*\d+\s+\([^)]+\)\s*\|\s*\d+\s+\([^)]+\)\s*\|/)
  if (!rowMatch) return null
  const parsed = Number(rowMatch[2])
  return Number.isFinite(parsed) ? parsed : null
}

function doctrineClaimsPressureAvoidance(text: string): boolean {
  return /\bavoid(?:s|ing)?\s+direct\s+combat\b|\bretreat(?:s|ing)?\b|\bwithdraw(?:s|al)?\b|\bbreak\s+contact\b|\bmisdirection\b|\buses?\s+crowds?\b|\bcrowd\b|\bpreserv(?:e|es|ing)\s+secrecy\b|\bsecrecy\b|\brefus(?:e|es)\s+to\s+fight\s+to\s+the\s+death\b|\bnot\s+here\s+to\s+win\s+a\s+fight\b|\bavoid(?:s|ing)?\s+public\s+bloodshed\b|\bsurvive(?:s|s)?\s+by\s+misdirection\b/i.test(text)
}

interface DoctrineSupportMechanic {
  label: string
  pattern: RegExp
  reliableUnderPressure: boolean
}

function findDoctrineSupportingMechanics(text: string): DoctrineSupportMechanic[] {
  const mechanics: DoctrineSupportMechanic[] = [
    {
      label: 'bonus action Disengage or Hide',
      pattern: /\bbonus action\b[\s\S]{0,160}\b(disengage|hide)\b|\bcunning action\b/i,
      reliableUnderPressure: true,
    },
    {
      label: 'reaction movement on being hit',
      pattern: /\bwhen\b[\s\S]{0,40}\bhit by an attack\b[\s\S]{0,180}\breaction\b[\s\S]{0,180}\b(move up to|half its speed|without provoking opportunity attacks|disengage|hide)\b|\breaction\b[\s\S]{0,180}\bwhen\b[\s\S]{0,40}\bhit by an attack\b[\s\S]{0,180}\b(move up to|half its speed|without provoking opportunity attacks|disengage|hide)\b|\bwhen\b[\s\S]{0,60}\b(hit or missed by an attack|reduced below half hit points|bloodied|exposed by name)\b[\s\S]{0,220}\breaction\b[\s\S]{0,180}\b(move up to|half its speed|without provoking opportunity attacks|disengage|hide)\b|\breaction\b[\s\S]{0,220}\bwhen\b[\s\S]{0,60}\b(hit or missed by an attack|reduced below half hit points|bloodied|exposed by name)\b[\s\S]{0,180}\b(move up to|half its speed|without provoking opportunity attacks|disengage|hide)\b/i,
      reliableUnderPressure: true,
    },
    {
      label: 'reaction movement on being missed',
      pattern: /\bwhen (?:a creature )?miss(?:es|ed)\b[\s\S]{0,180}\breaction\b[\s\S]{0,180}\b(move up to|half its speed|without provoking opportunity attacks|disengage|hide)\b|\breaction\b[\s\S]{0,180}\bwhen (?:a creature )?miss(?:es|ed)\b[\s\S]{0,180}\b(move up to|half its speed|without provoking opportunity attacks|disengage|hide)\b/i,
      reliableUnderPressure: false,
    },
    {
      label: 'first-round prepared movement',
      pattern: /\badvantage on initiative\b|\bmapped exits\b|\bon the first round of combat\b[\s\S]{0,140}\b(move up to|half its speed|without provoking opportunity attacks)\b/i,
      reliableUnderPressure: true,
    },
    {
      label: 'crowd or urban cover mechanic',
      pattern: /\bcrowd break\b|\bcrowd dissolution\b|\burban camouflage\b|\bblend\b|\bcamouflage\b|\bat least two non-hostile creatures\b|\bsignificant cover\b|\bgain(?:s)? cover\b/i,
      reliableUnderPressure: true,
    },
    {
      label: 'smoke, crowd, or social distraction',
      pattern: /\bdistraction\b|\bpublic misdirection\b|\bsmoke\b|\bfalse lead\b|\bwhispered suggestion\b|\bdelay someone\b/i,
      reliableUnderPressure: true,
    },
    {
      label: 'information protection on pressure',
      pattern: /\bbelow half hit points\b[\s\S]{0,160}\b(conceal|destroy|pass on)\b[\s\S]{0,120}\b(note|cipher strip|message|ledger|record|tally|chit)\b|\bexposed by name\b[\s\S]{0,160}\b(conceal|destroy|pass on)\b[\s\S]{0,120}\b(note|cipher strip|message|ledger|record|tally|chit)\b|\bbloodied\b[\s\S]{0,160}\b(conceal|destroy|pass on)\b/i,
      reliableUnderPressure: true,
    },
    {
      label: 'escape route in prepared urban location',
      pattern: /\bprepared urban location\b|\bmapped exits\b|\bescape route\b|\bservice corridor\b|\brear stair\b|\bdock ladder\b/i,
      reliableUnderPressure: true,
    },
    {
      label: 'non-lethal disabling effect',
      pattern: /\bnon-?lethal\b|\bunconscious\b|\bsedated\b|\bstunned\b|\brestrain(?:ed)?\b|\bgrappled\b|\bpoisoned\b/i,
      reliableUnderPressure: true,
    },
    {
      label: 'explicit morale or withdrawal trigger',
      pattern: /\bbelow half hit points\b[\s\S]{0,120}\b(attempts to flee|attempts to surrender|attempts to withdraw|breaks contact|retreats)\b|\bnamed publicly\b[\s\S]{0,120}\b(attempts to flee|attempts to surrender|attempts to withdraw|breaks contact|retreats)\b|\brestrained\b[\s\S]{0,120}\b(attempts to flee|attempts to surrender|attempts to withdraw|breaks contact|retreats)\b|\bseparated from (?:its|their) cover identity\b[\s\S]{0,120}\b(attempts to flee|attempts to surrender|attempts to withdraw|breaks contact|retreats)\b|\bno last stand\b/i,
      reliableUnderPressure: true,
    },
  ]

  return mechanics
    .filter((mechanic) => mechanic.pattern.test(text))
}

function normalizeNamedMechanic(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function extractDoctrineExpressiveMechanicNames(section: string): string[] {
  return section
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, ''))
    .map((line) => line.match(/^\*\*([^*]+)\*\*/)?.[1] ?? line.match(/^([^.:([—-]+?)(?:\s+expresses|\s*[:.(—-]|$)/i)?.[1] ?? '')
    .map((line) => line.trim())
    .filter(Boolean)
}

/**
 * Parse the user's prompt into locked constraints before calling the model.
 * These constraints are injected as override directives — the model cannot deviate.
 */
export function extractProposalConstraints(
  prompt: string,
  loadedBaseName: string | null,
): AdversaryProposalConstraints {
  // ── Faction ────────────────────────────────────────────────────────────────
  const forbiddenFactions = extractForbiddenFactions(prompt)
  const requiredFactions = extractRequiredFactions(prompt)
    .filter((slug) => !forbiddenFactions.includes(slug))
  const lockedFaction = requiredFactions[0] ?? null

  // ── Mechanical base ────────────────────────────────────────────────────────
  const allowedBases = ['spy', 'scout', 'guard', 'veteran', 'bandit', 'bandit captain', 'thug', 'assassin']

  // Use loaded base if explicitly requested; otherwise infer from context
  let preferredBase = loadedBaseName
  if (!preferredBase) {
    if (/blend(?:ing)?\s+in|social|urban|town|cit|market|disguise|infiltrat/i.test(prompt)) {
      preferredBase = 'spy'
    } else if (/road|checkpoint|patrol|trail|scout|track/i.test(prompt)) {
      preferredBase = 'scout'
    } else if (/captain|leader|veteran|dangerous|hard.to.kill/i.test(prompt)) {
      preferredBase = 'veteran'
    } else {
      preferredBase = 'spy'  // default for unspecified adversary
    }
  }

  // ── Environment ────────────────────────────────────────────────────────────
  let environmentContext: string | null = null
  if (/urban|town|cit|settlement|market|harbour|dock|inn|tavern/i.test(prompt)) {
    environmentContext = 'urban / towns / cities'
  } else if (/road|wilderness|outdoor|forest|coast|fjord/i.test(prompt)) {
    environmentContext = 'road / wilderness'
  }

  // ── Variant / modular ──────────────────────────────────────────────────────
  const variantOptionsRequired =
    /\bvariant\b|\bmodular\b|\bdm\s+can\s+choo?s\b|\bx\s+out\s+of\s+y\b|\bnever\s+identical\b|\bchoose\s+\d+\b/i.test(prompt)

  let modularChoiceRule: { traits: number; actions: number; reactions: number } | null = null
  if (variantOptionsRequired) {
    const t = prompt.match(/choose\s+(\d+)\s+traits?/i)
    const a = prompt.match(/choose\s+(\d+)\s+actions?/i)
    const r = prompt.match(/choose\s+(\d+)\s+reactions?/i)
    modularChoiceRule = {
      traits:    t ? parseInt(t[1]) : 2,
      actions:   a ? parseInt(a[1]) : 1,
      reactions: r ? parseInt(r[1]) : 1,
    }
  }

  return {
    lockedFaction,
    forbiddenFactions,
    preferredBase,
    allowedBases,
    environmentContext,
    variantOptionsRequired,
    modularChoiceRule,
  }
}

/**
 * Format constraints as a locked directive block for the system message.
 * Placed at the top of the prompt — these override all other model tendencies.
 */
export function formatConstraintBlock(c: AdversaryProposalConstraints): string {
  const has = c.lockedFaction || c.preferredBase || c.variantOptionsRequired
  if (!has) return ''

  const D = '═'.repeat(62)
  const lines: string[] = [D, 'LOCKED PROPOSAL CONSTRAINTS — OVERRIDE ALL MODEL DEFAULTS', D, '']

  if (c.lockedFaction) {
    lines.push(`FACTION: ${c.lockedFaction.toUpperCase()}`)
    lines.push(`  • Design Intent MUST state this adversary is a ${c.lockedFaction} variant or operative.`)
    lines.push(`  • ## DM-Only Notes MUST name "${c.lockedFaction}" as the faction affiliation.`)
    lines.push(`  • Corpus Frontmatter: related.factions MUST include [${c.lockedFaction}].`)
    if (c.forbiddenFactions.length > 0) {
      lines.push(`  • FORBIDDEN as primary faction: ${c.forbiddenFactions.join(', ')}.`)
      const first = c.forbiddenFactions[0]
      lines.push(`  • Do NOT say "serves ${first[0].toUpperCase() + first.slice(1)}" or link primarily to ${c.forbiddenFactions.slice(0, 2).join('/')}.`)
    }
    lines.push('')
  }

  if (c.preferredBase) {
    lines.push(`MECHANICAL BASE: ${c.preferredBase.toUpperCase()}`)
    lines.push(`  • Use npc-bases/srd-2014/${c.preferredBase} (or monsters/srd-2014/${c.preferredBase} if that path was loaded).`)
    lines.push(`  • DO NOT use: Human (Variant), Rogue (Thief), Ranger, Paladin, or any class-based base.`)
    lines.push(`  • Allowed bases: ${c.allowedBases.join(' | ')}.`)
    lines.push('')
  }

  if (c.environmentContext) {
    lines.push(`ENVIRONMENT: ${c.environmentContext}`)
    lines.push(`  • Social camouflage first; combat is an escalation, not the default.`)
    lines.push('')
  }

  if (c.variantOptionsRequired && c.modularChoiceRule) {
    const { traits, actions, reactions } = c.modularChoiceRule
    lines.push(`VARIANT OPTIONS: REQUIRED`)
    lines.push(`  • ## Variant Options section is MANDATORY.`)
    lines.push(`  • Provide at least ${traits * 2} trait options (DM chooses ${traits}).`)
    lines.push(`  • Provide at least ${actions * 2} action options (DM chooses ${actions}).`)
    lines.push(`  • Provide at least ${reactions * 2} reaction options (DM chooses ${reactions}).`)
    lines.push(`  • Each option must be mechanically self-contained (DC, damage, or condition specified).`)
    lines.push(`  • No vague options, no permanent stat changes as variant choices.`)
    lines.push('')
  }

  lines.push(D, '')
  return lines.join('\n')
}

// ── Output validation ─────────────────────────────────────────────────────────

export interface AdversaryValidation {
  violations: string[]
  valid: boolean
}

interface ParsedFactionProfileOverrides extends FactionProfileOverrideConfig {
  active: boolean
}

interface ParsedAbilityScores {
  str: number
  dex: number
  con: number
  int: number
  wis: number
  cha: number
}

const CANONICAL_ALIGNMENTS = getCanonicalAlignments()

function normalizeLanguageToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[.'’]/g, '')
    .replace(/\s+/g, ' ')
}

function parseFactionProfileOverrides(frontmatterSection: string): ParsedFactionProfileOverrides {
  const blockMatch = frontmatterSection.match(/faction_profile_overrides:\s*\n((?:[ \t]+[^\n]*\n?)*)/i)
  if (!blockMatch) return { active: false }

  const block = blockMatch[1]
  const parseBoolean = (key: string): boolean | undefined => {
    const match = block.match(new RegExp(`\\b${key}:\\s*(true|false)\\b`, 'i'))
    if (!match) return undefined
    return match[1].toLowerCase() === 'true'
  }

  const reason = block.match(/\breason:\s*["']?(.+?)["']?\s*$/im)?.[1]?.trim()
  const overrides: ParsedFactionProfileOverrides = {
    allowSpellcasting: parseBoolean('allow_spellcasting'),
    allowNonstandardLanguage: parseBoolean('allow_nonstandard_language'),
    allowAlignmentDeviation: parseBoolean('allow_alignment_deviation'),
    allowObviousWeapon: parseBoolean('allow_obvious_weapon'),
    reason,
    active: false,
  }

  overrides.active = Boolean(
    overrides.allowSpellcasting ||
    overrides.allowNonstandardLanguage ||
    overrides.allowAlignmentDeviation ||
    overrides.allowObviousWeapon,
  )

  return overrides
}

function parseAlignmentFromStatBlock(statBlockSection: string): string | null {
  const typeLine = statBlockSection.match(/^\*([^*\n]+)\*$/m)?.[1]?.trim()
  if (!typeLine) return null
  const parts = typeLine.split(',').map((part) => part.trim()).filter(Boolean)
  const alignment = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : null
  return alignment && CANONICAL_ALIGNMENTS.has(alignment) ? alignment : null
}

function parseLanguagesFromStatBlock(statBlockSection: string): string[] {
  const languagesLine = statBlockSection.match(/\*{0,2}Languages\*{0,2}\s+([^\n]+)/i)?.[1] ?? ''
  if (!languagesLine.trim()) return []
  return languagesLine
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function parseAbilityScoresFromStatBlock(statBlockSection: string): ParsedAbilityScores | null {
  const rowMatch = statBlockSection.match(/\|\s*(\d+)\s+\([^)]+\)\s*\|\s*(\d+)\s+\([^)]+\)\s*\|\s*(\d+)\s+\([^)]+\)\s*\|\s*(\d+)\s+\([^)]+\)\s*\|\s*(\d+)\s+\([^)]+\)\s*\|\s*(\d+)\s+\([^)]+\)\s*\|/)
  if (!rowMatch) return null
  return {
    str: Number(rowMatch[1]),
    dex: Number(rowMatch[2]),
    con: Number(rowMatch[3]),
    int: Number(rowMatch[4]),
    wis: Number(rowMatch[5]),
    cha: Number(rowMatch[6]),
  }
}

function parseProficiencyBonusFromStatBlock(statBlockSection: string): number {
  const match = statBlockSection.match(/\bProficiency Bonus\*{0,2}\s*\+(\d+)/i)
  if (match) return Number(match[1])
  return 2
}

function hasSpellcastingContent(text: string): boolean {
  return /\bspellcasting\b|\bcantrip\b|\bspell attack\b|\bminor illusion\b|\bcharm person\b|\bsuggestion\b/i.test(text)
}

function hasCoverIdentitySignals(text: string): boolean {
  return /\bcover identity\b|\bunremarkable presence\b|\bcivilian identity\b|\burban infiltrator\b|\bblend(?:ing)? in\b|\bpass as\b/i.test(text)
}

function explicitlyRequestsObviousWeapon(prompt: string): boolean {
  return /\bshortbow\b|\blongbow\b|\bheavy crossbow\b|\bcrossbow\b/i.test(prompt)
}

function explicitlyRequestsYngondi(prompt: string): boolean {
  return /\byngondi\b/i.test(prompt) && !/\bnot\b[^.\n;:]{0,120}\byngondi\b/i.test(prompt)
}

function hasObserverDoctrine(text: string): boolean {
  return /\bobservation\b|\bobserve\b|\bread(?:ing)? people\b|\bassess(?:ing)? motives\b|\bmapping social patterns\b|\bread the room\b/i.test(text)
}

function themeIsRepresented(theme: string, text: string): boolean {
  switch (theme.toLowerCase()) {
    case 'secrecy':
      return /\bsecrecy\b|\bsecret\b|\bconceal\b|\bcover identity\b|\bunremarkable\b/i.test(text)
    case 'restraint':
      return /\brestraint\b|\brestrained\b|\bdiscipline\b|\bmeasured\b|\bavoid unnecessary violence\b|\bdo not escalate\b/i.test(text)
    case 'mission-first behaviour':
      return /\bmission[- ]first\b|\bobjective\b|\bproblem\b|\bpriority\b|\binformation first\b/i.test(text)
    case 'controlled withdrawal':
      return /\bcontrolled withdrawal\b|\bwithdraw\b|\bretreat\b|\bbreak contact\b|\bno last stand\b|\bflee\b/i.test(text)
    case 'information preservation':
      return /\binformation\b|\bmessage\b|\bcipher\b|\bledger\b|\btally\b|\bevidence\b|\bpreserv(?:e|es|ing)\b/i.test(text)
    default:
      return text.toLowerCase().includes(theme.toLowerCase())
  }
}

const STANDARD_5E_SKILLS = new Set([
  'acrobatics',
  'animal handling',
  'arcana',
  'athletics',
  'deception',
  'history',
  'insight',
  'intimidation',
  'investigation',
  'medicine',
  'nature',
  'perception',
  'performance',
  'persuasion',
  'religion',
  'sleight of hand',
  'stealth',
  'survival',
])

function hasShadowWalkerRestraintTheme(text: string): boolean {
  return /\brestraint is not mercy\b|\bit is discipline\b|\bdiscipline, not mercy\b|\bviolence only to preserve the mission\b|\bdo not kill to punish\b|\bdo not kill to dominate\b|\bdo not kill to prove strength\b|\bcontrolled withdrawal matters more than victory\b/i.test(text)
}

function isRunnableMechanicText(text: string): boolean {
  return /\bwhen\b|\bif\b|\bonce per\b|\bmust succeed\b|\bdc\s*\d+\b|\bcheck\b|\bsaving throw\b|\badvantage\b|\bdisadvantage\b|\bmove up to\b|\bwithout provoking\b|\buntil the end of\b|\buntil the start of\b|\breduced by\b|\bdamage\b|\bhit points\b|\bcan use its reaction\b|\bcan use a bonus action\b|\bgains?\b|\bloses?\b|\bspeed\b/i.test(text)
}

function inferDoctrineTags(
  outputText: string,
  constraints?: AdversaryProposalConstraints,
  factionProfile?: ReturnType<typeof getFactionProfile>,
): string[] {
  const combined = outputText.toLowerCase()
  const tags = new Set<string>()
  for (const tag of factionProfile?.doctrineTags ?? []) {
    if (
      (tag === 'cover-identity' && hasCoverIdentitySignals(combined)) ||
      (tag === 'unremarkable-presence' && /\bunremarkable presence\b|\bunremarkable\b|\bordinary life\b|\bpass as\b/i.test(combined)) ||
      (tag === 'urban-infiltration' && isShadowWalkerUrbanInfiltrator(outputText, constraints)) ||
      (tag === 'secrecy' && themeIsRepresented('secrecy', combined)) ||
      (tag === 'restraint' && themeIsRepresented('restraint', combined)) ||
      (tag === 'mission-first' && /\bmission[- ]first\b|\bobjective\b|\bpriority\b/i.test(combined)) ||
      (tag === 'controlled-withdrawal' && themeIsRepresented('controlled withdrawal', combined)) ||
      (tag === 'information-preservation' && themeIsRepresented('information preservation', combined))
    ) {
      tags.add(tag)
    }
  }
  if (hasCoverIdentitySignals(combined)) tags.add('cover-identity')
  if (/\bunremarkable presence\b|\bunremarkable\b|\bordinary life\b|\bpass as\b/i.test(combined)) tags.add('unremarkable-presence')
  if (isShadowWalkerUrbanInfiltrator(outputText, constraints)) tags.add('urban-infiltration')
  return [...tags]
}

function inferEnvironmentTags(outputText: string, constraints?: AdversaryProposalConstraints): string[] {
  const tags = new Set<string>()
  const combined = `${constraints?.environmentContext ?? ''}\n${outputText}`.toLowerCase()
  if (
    /\burban\b|\btown\b|\bcity\b|\bsettlement\b|\bmarket\b|\bharbour\b|\bdock\b|\bcrowd\b|\bpublic\b|\bcivilian identity\b|\bunremarkable presence\b/.test(combined)
  ) {
    tags.add('urban')
    tags.add('town')
    tags.add('city')
    tags.add('settlement')
  }
  return [...tags]
}

function overrideSatisfied(allowed: boolean, requiresReason: boolean, flag: boolean | undefined, reason: string | undefined): boolean {
  if (!allowed || !flag) return false
  if (requiresReason) return Boolean(reason)
  return true
}

function ruleAppliesToAdversary(
  rule: FactionMechanicalOverrideRule,
  input: {
    factionSlug: string | null
    doctrineTags: string[]
    environmentTags: string[]
    base: string | null
  },
): boolean {
  if (rule.appliesWhen.faction.length > 0 && (!input.factionSlug || !rule.appliesWhen.faction.includes(input.factionSlug))) {
    return false
  }
  if (rule.appliesWhen.base.length > 0 && (!input.base || !rule.appliesWhen.base.includes(input.base.toLowerCase()))) {
    return false
  }
  if (rule.appliesWhen.doctrineTags.length > 0 && !rule.appliesWhen.doctrineTags.some((tag) => input.doctrineTags.includes(tag))) {
    return false
  }
  if (rule.appliesWhen.environmentContext.length > 0 && !rule.appliesWhen.environmentContext.some((tag) => input.environmentTags.includes(tag))) {
    return false
  }
  return true
}

function getApplicableFactionMechanicalRules(
  outputText: string,
  constraints: AdversaryProposalConstraints | undefined,
  factionProfile: ReturnType<typeof getFactionProfile>,
  requestedBase: string | null,
): FactionMechanicalOverrideRule[] {
  const inferredFactionSlug = inferFactionSlugFromOutput(outputText, constraints)
  const doctrineTags = inferDoctrineTags(outputText, constraints, factionProfile)
  const environmentTags = inferEnvironmentTags(outputText, constraints)
  const base = constraints?.preferredBase ?? requestedBase

  return getFactionMechanicalOverrides().filter((rule) =>
    ruleAppliesToAdversary(rule, {
      factionSlug: inferredFactionSlug,
      doctrineTags,
      environmentTags,
      base,
    }),
  )
}

function findWeaponConflictInStatBlock(
  statBlockSection: string,
  rule: FactionMechanicalOverrideRule,
): string | null {
  return rule.conflicts.weapons.find((weapon) =>
    new RegExp(`\\b${weapon.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(statBlockSection),
  ) ?? null
}

function getApplicableWeaponConflictNames(
  outputText: string,
  constraints: AdversaryProposalConstraints | undefined,
  factionProfile: ReturnType<typeof getFactionProfile>,
  requestedBase: string | null,
): string[] {
  const statBlockSection = outputText.match(/##\s+Stat\s+Block\s*\n([\s\S]*?)(?=\n##\s|\s*$)/i)?.[1] ?? ''
  const conflicts = new Set<string>()

  for (const rule of getApplicableFactionMechanicalRules(outputText, constraints, factionProfile, requestedBase)) {
    const conflict = findWeaponConflictInStatBlock(statBlockSection, rule)
    if (conflict) conflicts.add(conflict)
  }

  return [...conflicts]
}

function inferFactionSlugFromOutput(
  outputText: string,
  constraints?: AdversaryProposalConstraints,
): string | null {
  const dmNotesSection = outputText.match(/##\s+DM.Only\s+Notes?\s*\n([\s\S]*?)(?=\n##\s|\s*$)/i)?.[1] ?? ''
  const frontmatterSection = outputText.match(/##\s+Corpus\s+Frontmatter\s*\n([\s\S]*?)(?=\n##\s|\s*$)/i)?.[1] ?? ''
  const frontmatterFactionList = (frontmatterSection.match(/\bfactions:\s*\[([^\]]*)\]/i)?.[1] ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)

  return (
    constraints?.lockedFaction
    ?? frontmatterFactionList[0]
    ?? FACTION_SPECS.find((spec) => spec.dmNotesSynonyms.some((synonym) => dmNotesSection.toLowerCase().includes(synonym)))?.slug
    ?? null
  )
}

/**
 * Structurally validate adversary-design model output.
 * Checks mechanical inconsistencies that are verifiable without NLP.
 */
export function validateAdversaryOutput(
  outputText: string,
  requestedBase: string | null,
  baseContent: string | null,
  sourcePrompt = '',
  constraints?: AdversaryProposalConstraints,
): AdversaryValidation {
  const violations: string[] = []
  const lower = outputText.toLowerCase()
  const effectiveConstraints =
    constraints ?? (sourcePrompt ? extractProposalConstraints(sourcePrompt, requestedBase) : undefined)

  // D&D stat block ability format: **Name.** Description (period BEFORE closing **)
  // Extract the Actions section using flexible heading depth (##, ###)
  const actionsSection = outputText.match(/#{2,3}\s+Actions\s*\n([\s\S]*?)(?=\n#{2,3}\s|\s*$)/i)?.[1] ?? ''

  if (/\*\*Disguise Kit\.?\*\*/i.test(actionsSection)) {
    violations.push('Disguise Kit appears under Actions without a concrete encounter mechanic — move it to Tool Proficiencies or replace it with Prepared Cover.')
  }
  if (/\b(?:Persuasion|Social Action)\b[\s\S]{0,220}\bcharmed\b/i.test(actionsSection)) {
    violations.push('Mundane social action applies the charmed condition — replace it with Social Pressure or False Confidence unless the adversary is explicitly magical.')
  }

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

  // Darkvision validation: base has no darkvision → output must not add it without explanation.
  // Works from baseContent when loaded, OR from known-bases list when baseContent is null.
  const BASES_WITHOUT_DARKVISION = new Set([
    'spy', 'noble', 'guard', 'bandit', 'bandit captain', 'bandit-captain',
    'thug', 'scout', 'commoner', 'mage', 'priest', 'acolyte', 'assassin',
    'archmage', 'veteran',
  ])
  const baseHasDarkvision =
    (baseContent && /darkvision/i.test(baseContent)) ||
    (requestedBase != null && !BASES_WITHOUT_DARKVISION.has(requestedBase.toLowerCase()))
  const baseDefinitelyLacksDarkvision =
    (baseContent && !/darkvision/i.test(baseContent)) ||
    (baseContent == null && requestedBase != null && BASES_WITHOUT_DARKVISION.has(requestedBase.toLowerCase()))

  if (/darkvision/i.test(outputText) && !baseHasDarkvision) {
    const statBlockSection = outputText.match(/#{2,3}\s+Stat\s+Block\s*\n([\s\S]*?)(?=\n##\s|\s*$)/i)?.[1] ?? ''
    if (/darkvision/i.test(statBlockSection)) {
      const adaptSection2 = outputText.match(/##\s+Adaptation\s+Summary\s*\n([\s\S]*?)(?=\n##\s|\s*$)/i)?.[1] ?? ''
      if (!/darkvision/i.test(adaptSection2)) {
        const baseLabel = requestedBase ?? 'unknown base'
        violations.push(
          `Unexplained darkvision: "${baseLabel}" base has no darkvision ` +
          `but stat block adds it without explanation in Adaptation Summary. ` +
          `Remove it or add "Added: Darkvision [reason]" to Adaptation Summary.`,
        )
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

  // Modern tech language — includes Karsac-specific device terms
  const modernTerms = [
    'database', 'surveillance system', 'tracking device', 'scanner',
    'communications device', 'communication device', 'encrypted device', 'comms device',
    'encrypted message', 'encrypted messages', 'transmits encrypted',
  ]
  for (const term of modernTerms) {
    if (lower.includes(term)) {
      violations.push(
        `Modern tech language: "${term}" — replace with Karsac equivalent ` +
        `(coded tally, waxed cipher strip, knotted cord, marked bone sliver, folded harbour chit)`,
      )
    }
  }

  // Non-5e skill: Diplomacy
  if (/\bDiplomacy\b/.test(outputText)) {
    violations.push('Non-5e skill: "Diplomacy" is not a D&D 5e 2014 skill — use Persuasion instead')
  }

  for (const match of outputText.matchAll(/\b(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s*\(\s*([A-Za-z' -]+)\s*\)/g)) {
    const skill = match[2].trim().toLowerCase()
    if (!STANDARD_5E_SKILLS.has(skill)) {
      violations.push(`Invalid 5e skill pairing: "${match[0]}" uses non-standard skill "${match[2].trim()}". Use a standard 5e skill unless a campaign skill is explicitly registered.`)
    }
  }

  if (/\bCharisma\s*\(\s*Insight\s*\)/i.test(outputText)) {
    violations.push('Invalid 5e skill pairing: use Wisdom (Insight), not Charisma (Insight).')
  }

  if (/\bthe The\b/i.test(outputText)) {
    violations.push('Doubled article string found ("the The") — normalize injected creature names.')
  }

  // Damage formula accuracy: stated average should match dice formula
  for (const match of outputText.matchAll(/\bHit:\s+(\d+)\s*\((\d+)d(\d+)([^)]*)\)/gi)) {
    const stated = parseInt(match[1])
    const numDice = parseInt(match[2])
    const dieSize = parseInt(match[3])
    const modPart = match[4] ?? ''
    const modMatch = modPart.match(/([+-])\s*(\d+)/)
    const mod = modMatch ? (modMatch[1] === '+' ? parseInt(modMatch[2]) : -parseInt(modMatch[2])) : 0
    const expected = expectedAverageFromDiceFormula(numDice, dieSize, mod)
    if (Math.abs(stated - expected) > 1) {
      violations.push(
        `Damage formula: stated "Hit: ${stated}" but average of ` +
        `${numDice}d${dieSize}${mod !== 0 ? (mod > 0 ? '+' + mod : mod) : ''} is ${expected}`,
      )
    }
  }

  // Mechanical base corpus validity
  // "Rogue (Thief)", "Ranger", "Paladin", etc. are NOT loaded SRD NPC bases.
  const VALID_SRD_BASE_NAMES = new Set([
    'spy', 'noble', 'guard', 'veteran', 'bandit captain', 'bandit-captain',
    'bandit', 'thug', 'scout', 'mage', 'priest', 'acolyte', 'assassin',
    'archmage', 'commoner',
  ])
  const mechBaseSection = outputText.match(/##\s+Mechanical\s+Base\s*\n([\s\S]*?)(?=\n##\s|\s*$)/i)?.[1] ?? ''
  const statBlockSection = outputText.match(/#{2,3}\s+Stat\s+Block\s*\n([\s\S]*?)(?=\n##\s|\s*$)/i)?.[1] ?? ''
  const hitPointsLineMatch = statBlockSection.match(/\*{0,2}Hit\s+Points\*{0,2}\s+(\d+)\s*\((\d+)d(\d+)([^)]*)\)/i)
  if (hitPointsLineMatch) {
    const stated = parseInt(hitPointsLineMatch[1])
    const numDice = parseInt(hitPointsLineMatch[2])
    const dieSize = parseInt(hitPointsLineMatch[3])
    const modPart = hitPointsLineMatch[4] ?? ''
    const modMatch = modPart.match(/([+-])\s*(\d+)/)
    const mod = modMatch ? (modMatch[1] === '+' ? parseInt(modMatch[2]) : -parseInt(modMatch[2])) : 0
    const expected = expectedAverageFromDiceFormula(numDice, dieSize, mod)
    if (Math.abs(stated - expected) > 1) {
      violations.push(
        `Hit point formula: stated "Hit Points ${stated}" but average of ` +
        `${numDice}d${dieSize}${mod !== 0 ? (mod > 0 ? ' + ' + mod : ' - ' + Math.abs(mod)) : ''} is ${expected}`,
      )
    }
  }

  const armourClassLineMatch = statBlockSection.match(/(\*{0,2}Armou?r\s+Class\*{0,2}\s+)(\d+)(\s*\(([^)\n]+)\))?/i)
  if (armourClassLineMatch) {
    const statedAc = Number(armourClassLineMatch[2])
    const armourDetail = (armourClassLineMatch[4] ?? '').trim()
    const isPlainLeather = /^leather\s+armou?r$/i.test(armourDetail)
    if (isPlainLeather) {
      const dexMod = detectDexModifierFromStatBlock(statBlockSection)
      const hasExplicitBonus = /\bshield\b|\bwith\b|\bplus\b|\+\d|\bnatural\b|\bmage\b|\bdefen/i.test(armourDetail)
      if (dexMod !== null && !hasExplicitBonus) {
        const expectedAc = 11 + dexMod
        if (statedAc !== expectedAc) {
          violations.push(
            `WARN: Armour Class formula: stated "Armour Class ${statedAc} (${armourDetail})" but leather armour with DEX modifier ${dexMod >= 0 ? `+${dexMod}` : dexMod} is ${expectedAc} unless another AC bonus is explicitly listed.`,
          )
        }
      }
    }
  }

  const citeMatch = mechBaseSection.match(/\bBase:\s*(.+)/i)
  if (citeMatch) {
    const cited = citeMatch[1].trim().toLowerCase()
    const isKnown =
      cited.includes('npc-bases/srd-2014/') ||
      cited.includes('monsters/srd-2014/') ||
      Array.from(VALID_SRD_BASE_NAMES).some(b => cited.includes(b))
    if (!isKnown) {
      violations.push(
        `Mechanical base "${citeMatch[1].trim()}" is not a known SRD NPC base. ` +
        `Use one of: spy, scout, guard, veteran, bandit, thug, assassin, etc. ` +
        `Class-based bases ("Rogue", "Ranger") are not SRD NPC stat blocks.`,
      )
    }
  }

  // Forbidden faction body scan — warn if forbidden factions appear as active affiliations
  if (sourcePrompt && effectiveConstraints) {
    const languagesLine = statBlockSection.match(/\*{0,2}Languages\*{0,2}\s+([^\n]+)/i)?.[1] ?? ''
    for (const forbidden of (effectiveConstraints.forbiddenFactions ?? [])) {
      const languageRef = new RegExp(`\\b${forbidden}\\b`, 'i')
      if (languagesLine && languageRef.test(languagesLine)) {
        violations.push(
          `Forbidden faction ambiguity: Languages line mentions "${forbidden}" even though it is forbidden by the prompt. ` +
          `Use a neutral language line unless the corpus explicitly requires that faction language.`,
        )
      }
    }

    const affiliationContexts = [
      outputText.match(/##\s+Design\s+Intent\s*\n([\s\S]*?)(?=\n##\s|\s*$)/i)?.[1] ?? '',
      outputText.match(/##\s+DM.Only\s+Notes?\s*\n([\s\S]*?)(?=\n##\s|\s*$)/i)?.[1] ?? '',
      outputText.match(/##\s+Corpus\s+Frontmatter\s*\n([\s\S]*?)(?=\n##\s|\s*$)/i)?.[1] ?? '',
    ].join('\n')

    for (const forbidden of (effectiveConstraints.forbiddenFactions ?? [])) {
      const re = new RegExp(`\\b${forbidden}\\b`, 'i')
      if (re.test(affiliationContexts)) {
        const sentences = affiliationContexts.split(/[.!?]\s+/)
        for (const s of sentences) {
          if (!re.test(s)) continue
          if (isNegativeFactionContext(s, forbidden)) continue
          if (hasPositiveFactionAffiliation(s, forbidden)) {
            violations.push(
              `Forbidden faction affiliation: "${forbidden}" appears as an active affiliation ` +
              `in Design Intent, DM-Only Notes, or Corpus Frontmatter. ` +
              `The locked faction is "${effectiveConstraints.lockedFaction}" — do not link to forbidden factions.`,
            )
            break
          }
        }
      }
    }
  }

  // Adaptation summary vs stat block — strengthened check
  // Exempt standard D&D 5e stat block fields that are not custom traits/actions.
  // These appear in specific stat block lines (type line, Languages field, etc.)
  // and do not need to appear as named traits or actions.
  const STAT_BLOCK_IMPLICIT_FIELDS = new Set([
    'size', 'alignment', 'type', 'creature type',
    'languages', 'language',
    'senses', 'saving throws', 'saves',
    'skills', 'speed', 'challenge', 'cr',
    'armor class', 'armour class', 'ac',
    'hit points', 'hp',
    'ability score increase', 'ability score increases',
    'feat', 'feats',
    'skill proficiency', 'skill proficiencies',
    'skill versatility',
    'humanoid stats', 'ability scores',
    'darkvision',  // handled separately by the darkvision check
  ])

  const adaptSection = outputText.match(/##\s+Adaptation\s+Summary\s*\n([\s\S]*?)(?=\n##\s|\s*$)/i)?.[1] ?? ''
  const keptLine = adaptSection.match(/[-*\s]+Kept\s+from\s+base:\s*(.+)/i)?.[1] ?? ''
  if (keptLine) {
    const statBlockSection = outputText.match(/#{2,3}\s+Stat\s+Block\s*\n([\s\S]*?)(?=\n##\s|\s*$)/i)?.[1] ?? ''
    // Extract the Skills line for proficiency/skill lookups
    const skillsLine = (statBlockSection.match(/\*{0,2}Skills?\*{0,2}\s+([^\n]+)/i)?.[1] ?? '').toLowerCase()
    const profsLine  = (statBlockSection.match(/\*{0,2}(?:Tool\s+)?Proficiencies?\*{0,2}\s+([^\n]+)/i)?.[1] ?? '').toLowerCase()

    const keptAbilities = keptLine.split(/[,;|]/).map(a =>
      a.replace(/\s*\(.*?\)/g, '').replace(/\.$/, '').trim()
    ).filter(a => a.length > 3)

    for (const ability of keptAbilities) {
      const abilityLower = ability.toLowerCase()
      // Skip standard implicit stat block fields
      if (STAT_BLOCK_IMPLICIT_FIELDS.has(abilityLower)) continue

      if (/\bexpertise\b/i.test(ability)) {
        if (!/\bexpertise\b/i.test(statBlockSection)) {
          violations.push(
            `Adaptation mismatch: "${ability}" listed as kept but Expertise is not explicitly represented in the Stat Block ` +
            `— remove it from "Kept from base" or add an explicit Expertise line/trait`,
          )
        }
        continue
      }

      if (/\btool\b|\bkit\b/i.test(ability)) {
        const toolName = abilityLower
          .replace(/\btool\s+proficiencies?\b/gi, '')
          .replace(/\bproficiencies?\b/gi, '')
          .replace(/\bproficiency\b/gi, '')
          .trim()
        if (toolName.length > 1 && profsLine.includes(toolName)) continue
        violations.push(
          `Adaptation mismatch: "${ability}" listed as kept but no Tool Proficiencies line shows it in the Stat Block ` +
          `— add a Tool Proficiencies line or move it to "Removed:"/"Changed from base:"`,
        )
        continue
      }

      // Check: direct text in stat block
      if (statBlockSection.toLowerCase().includes(abilityLower)) continue

      // Check: "X proficiency" or "X skill" → look in Skills line or Proficiencies line
      const nameOnly = abilityLower
        .replace(/\s+proficiency$/i, '')
        .replace(/\s+skill$/i, '')
        .replace(/-like\s+\w+\s+role$/i, '') // "spy-like social/stealth role"
        .trim()
      if (nameOnly.length > 2 && (skillsLine.includes(nameOnly) || profsLine.includes(nameOnly))) continue

      // Check: role/context descriptors that are summary labels, not specific traits
      if (/\brole\b|\bemphasis\b|\bfocus\b|\bstyle\b|\bapproach\b/i.test(ability)) continue

      violations.push(
        `Adaptation mismatch: "${ability}" listed as kept but not found in Stat Block ` +
        `— add it to the stat block or move it to "Removed:"`,
      )
    }
  }

  // Faction preservation — faction must appear as an AFFILIATION (DM-Only Notes or
  // Corpus Frontmatter related.factions), not just as a passing comparison.
  // "not as dangerous as Shadow Walkers" is NOT sufficient — the faction must be
  // present in the sections that define what the adversary IS.
  const dmNotesSection = outputText.match(/##\s+DM.Only\s+Notes?\s*\n([\s\S]*?)(?=\n##\s|\s*$)/i)?.[1] ?? ''
  const frontmatterSection = outputText.match(/##\s+Corpus\s+Frontmatter\s*\n([\s\S]*?)(?=\n##\s|\s*$)/i)?.[1] ?? ''

  if (effectiveConstraints?.lockedFaction) {
    // Extract the specific related.factions YAML line — "factions: [...]"
    // This is the only authoritative place for faction membership.
    // The summary field is NOT sufficient ("A Shadow Walker operative" in summary is not affiliation).
    const factionsYamlMatch = frontmatterSection.match(/\bfactions:\s*\[([^\]]*)\]/)
    const factionsYamlValue  = factionsYamlMatch ? factionsYamlMatch[1].toLowerCase() : ''

    const lockedFactionSpec = getFactionSpec(effectiveConstraints.lockedFaction)
    if (lockedFactionSpec) {
      const factionInYaml = factionsYamlValue.includes(lockedFactionSpec.slug)
      const factionInDmNotes = lockedFactionSpec.dmNotesSynonyms
        .some((synonym) => dmNotesSection.toLowerCase().includes(synonym))

      if (!factionInYaml && !factionInDmNotes) {
        violations.push(
          `Faction drift: prompt requests "${lockedFactionSpec.displayName}" affiliation but ` +
          `related.factions in Corpus Frontmatter does not contain "${lockedFactionSpec.slug}" ` +
          `AND ## DM-Only Notes does not mention "${lockedFactionSpec.displayName}". ` +
          `The summary field alone is not sufficient. ` +
          `Set related.factions: [${lockedFactionSpec.slug}] and name the faction in DM-Only Notes.`,
        )
      } else if (!factionInYaml) {
        violations.push(
          `Faction missing from related.factions: prompt requests "${lockedFactionSpec.displayName}" ` +
          `but Corpus Frontmatter factions field does not contain "${lockedFactionSpec.slug}". ` +
          `Add: related:\\n  factions: [${lockedFactionSpec.slug}]`,
        )
      } else if (!factionInDmNotes) {
        violations.push(
          `Faction not in DM-Only Notes: "${lockedFactionSpec.displayName}" is in related.factions but ` +
          `## DM-Only Notes does not explicitly mention the faction affiliation.`,
        )
      }
    }
  }

  const doctrineSection = outputText.match(/##\s+Doctrine\s*\n([\s\S]*?)(?=\n##\s|\s*$)/i)?.[1] ?? ''
  const doctrineUnderPressureSection = outputText.match(/##\s+Doctrine\s+Under\s+Pressure\s*\n([\s\S]*?)(?=\n##\s|\s*$)/i)?.[1] ?? ''
  const behaviouralStagesSection = outputText.match(/##\s+Behavioural\s+Stages\s*\n([\s\S]*?)(?=\n##\s|\s*$)/i)?.[1] ?? ''
  const tacticalNotesSection = outputText.match(/##\s+Tactical\s+Notes\s*\n([\s\S]*?)(?=\n##\s|\s*$)/i)?.[1] ?? ''
  const doctrineExpressiveMechanicsSection = outputText.match(/##\s+Doctrine-Expressive\s+Mechanics\s*\n([\s\S]*?)(?=\n##\s|\s*$)/i)?.[1] ?? ''
  const variantSection = outputText.match(/##\s+Variant\s+Options\s*\n([\s\S]*?)(?=\n##\s|\s*$)/i)?.[1]
  const traitsSection = statBlockSection.match(/###\s+Traits\s*\n([\s\S]*?)(?=\n###\s|\s*$)/i)?.[1] ?? ''
  const inferredFactionSlug = inferFactionSlugFromOutput(outputText, effectiveConstraints)
  const typeLine = statBlockSection.match(/^\*([^*\n]+)\*$/m)?.[1]?.trim() ?? ''

  if (/\bQuick Step\b/i.test(outputText) && /\barea[- ]of[- ]effect\b|\bspell or attack\b/i.test(outputText)) {
    violations.push(
      'Quick Step is too broad/vague for area effects — use a Dex-save trigger such as "When the adversary succeeds on a Dexterity saving throw against an effect that allows such a save, it can move up to half its speed without provoking opportunity attacks."',
    )
  }

  if (/\bQuick Concealment\b/i.test(outputText)) {
    const quickConcealmentContext = outputText.match(/\bQuick Concealment\b[\s\S]{0,260}/i)?.[0] ?? ''
    const hasTightenedCondition =
      /\bwithin 10 feet of cover\b/i.test(quickConcealmentContext) &&
      /\bcrowd\b/i.test(quickConcealmentContext) &&
      /\bprepared hiding place\b/i.test(quickConcealmentContext)
    if (!hasTightenedCondition) {
      violations.push('Quick Concealment is too loose — require being within 10 feet of cover, a crowd, or a prepared hiding place before moving and making a Dexterity (Stealth) check.')
    }
  }

  if (/\bCounter-Observation\b/i.test(outputText)) {
    const counterObservationContext = outputText.match(/\bCounter-Observation\b[\s\S]{0,260}/i)?.[0] ?? ''
    if (!/\bWisdom\s*\(\s*Insight\s*\)\b/i.test(counterObservationContext) || !/\bIntelligence\s*\(\s*Investigation\s*\)\b/i.test(counterObservationContext) || !/\bdisadvantage\b/i.test(counterObservationContext)) {
      violations.push(
        'Counter-Observation is too vague — specify that when a creature makes a Wisdom (Insight) or Intelligence (Investigation) check to expose the cover, the adversary can impose disadvantage on that check.',
      )
    }
  }

  if (/\bcitywide blackout\b/i.test(dmNotesSection)) {
    violations.push(
      'DM-Only Notes uses over-broad/modern consequence "citywide blackout" — replace it with a grounded local consequence such as a dockside fire signal, cut lantern lines in one alley, an emptied ledger-room, or a false alarm at the gate.',
    )
  }

  const frontmatterFactionList = (frontmatterSection.match(/\bfactions:\s*\[([^\]]*)\]/i)?.[1] ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
  const factionKnown =
    Boolean(effectiveConstraints?.lockedFaction) ||
    frontmatterFactionList.length > 0 ||
    FACTION_SPECS.some((spec) => spec.dmNotesSynonyms.some((synonym) => dmNotesSection.toLowerCase().includes(synonym)))

  if (factionKnown) {
    const missingDoctrineSections = [doctrineSection, behaviouralStagesSection, tacticalNotesSection]
      .filter((section) => section.trim().length === 0)
    if (missingDoctrineSections.length > 0) {
      violations.push('WARN: Faction adversary lacks doctrine/tactical behaviour sections.')
    }
  }

  if (inferredFactionSlug === 'shadow-walkers') {
    const restraintText = [doctrineSection, tacticalNotesSection].join('\n')
    if (!hasShadowWalkerRestraintTheme(restraintText)) {
      violations.push('WARN: Shadow Walker doctrine lacks the required restraint-as-discipline theme.')
    }
    if (/\byngondi\b/i.test(typeLine) && !explicitlyRequestsYngondi(sourcePrompt)) {
      violations.push('Faction profile creature-type mismatch: Shadow Walker urban infiltrators must not leak "Yngondi" creature subtype unless explicitly requested and canon-supported.')
    }
  }

  if (doctrineSection.trim().length > 0 && doctrineUnderPressureSection.trim().length === 0) {
    if (factionKnown) {
      violations.push('Faction adversary missing required "## Doctrine Under Pressure" section.')
    } else {
      violations.push('WARN: Adversary has Doctrine but lacks "## Doctrine Under Pressure" section.')
    }
  }

  const doctrinePressureText = [
    doctrineSection,
    doctrineUnderPressureSection,
    behaviouralStagesSection,
    tacticalNotesSection,
  ].join('\n')
  const mechanicsSupportText = statBlockSection
  if (doctrineClaimsPressureAvoidance(doctrinePressureText)) {
    const supportingMechanics = findDoctrineSupportingMechanics(mechanicsSupportText)
    const reliableUnderPressureMechanics = supportingMechanics.filter((mechanic) => mechanic.reliableUnderPressure)
    if (supportingMechanics.length < 2 || reliableUnderPressureMechanics.length < 1) {
      const detail = supportingMechanics.length > 0
        ? ` Only found: ${supportingMechanics.map((mechanic) => mechanic.label).join(', ')}.`
        : ''
      violations.push(
        `WARN: Doctrine not mechanically supported under pressure: adversary claims to escape/misdirect when exposed but lacks reliable mechanics against a combat-optimised party.${detail}`,
      )
    }
  }

  const doctrineExpressiveMechanicNames = extractDoctrineExpressiveMechanicNames(doctrineExpressiveMechanicsSection)
  const statBlockMechanicNames = new Set(
    [...statBlockSection.matchAll(/\*\*([^*]+)\.\*\*/g)]
      .map((match) => normalizeNamedMechanic(match[1])),
  )
  const moraleBehaviourSection = statBlockSection.match(
    /#{3,4}\s+(?:Morale(?:\s*\/\s*Behaviour)?|Behaviour(?:\s*\/\s*Morale)?)\s*\n([\s\S]*?)(?=\n#{3,4}\s|\s*$)/i,
  )?.[1] ?? ''
  const requiredStatBlockMechanics = new Set([
    'mapped exits',
    'crowd break',
    'information first',
    'no last stand',
  ])
  for (const mechanicName of doctrineExpressiveMechanicNames) {
    const normalized = normalizeNamedMechanic(mechanicName)
    if (!requiredStatBlockMechanics.has(normalized)) continue
    const presentInMoraleBehaviour = moraleBehaviourSection.toLowerCase().includes(normalized)
    if (!statBlockMechanicNames.has(normalized) && !presentInMoraleBehaviour) {
      violations.push(
        `Doctrine-expressive mechanic "${mechanicName}" is named in ## Doctrine-Expressive Mechanics but is not present in the Stat Block. Put it under Traits, Actions, Bonus Actions, Reactions, or explicit Morale / Behaviour rules.`,
      )
    }
  }

  const factionProfile = getFactionProfile(inferredFactionSlug)
  const factionOverrides = parseFactionProfileOverrides(frontmatterSection)
  const canonicalLanguages = new Set(getCanonicalLanguages().map(normalizeLanguageToken))

  if (factionOverrides.active && !factionOverrides.reason) {
    violations.push('Faction profile override is missing a reason — add faction_profile_overrides.reason explaining the deviation.')
  }

  if (factionProfile) {
    const alignment = parseAlignmentFromStatBlock(statBlockSection)
    const languages = parseLanguagesFromStatBlock(statBlockSection)
    const normalizedWhitelist = new Set(factionProfile.languageWhitelist.map(normalizeLanguageToken))
    const normalizedBannedLanguages = new Set(factionProfile.bannedLanguages.map(normalizeLanguageToken))
    const doctrineThemeText = [
      doctrineSection,
      doctrineUnderPressureSection,
      behaviouralStagesSection,
      tacticalNotesSection,
      doctrineExpressiveMechanicsSection,
      dmNotesSection,
    ].join('\n')
    const applicableMechanicalRules = getApplicableFactionMechanicalRules(
      outputText,
      effectiveConstraints,
      factionProfile,
      requestedBase,
    )
    const abilityScores = parseAbilityScoresFromStatBlock(statBlockSection)

    if (alignment) {
      const allowedAlignments = new Set(factionProfile.allowedAlignments.map((entry) => entry.toLowerCase()))
      const alignmentAllowed = allowedAlignments.size === 0 || allowedAlignments.has(alignment)
      if (!alignmentAllowed) {
        if (factionOverrides.allowAlignmentDeviation && factionOverrides.reason) {
          violations.push(`WARN: Faction profile override allows alignment deviation from ${factionProfile.displayName}: "${alignment}" (${factionOverrides.reason}).`)
        } else {
          violations.push(
            `Faction profile alignment mismatch: ${factionProfile.displayName} allows ${factionProfile.allowedAlignments.join(', ')} but the stat block uses "${alignment}".`,
          )
        }
      }
    }

    for (const language of languages) {
      const normalizedLanguage = normalizeLanguageToken(language)
      if (normalizedBannedLanguages.has(normalizedLanguage)) {
        if (factionOverrides.allowNonstandardLanguage && factionOverrides.reason) {
          violations.push(`WARN: Faction profile override allows banned language "${language}" for ${factionProfile.displayName} (${factionOverrides.reason}).`)
        } else {
          violations.push(`Faction profile language mismatch: ${factionProfile.displayName} should not use "${language}".`)
        }
        continue
      }
      const allowedByRegistry = canonicalLanguages.has(normalizedLanguage) || normalizedWhitelist.has(normalizedLanguage)
      if (!allowedByRegistry) {
        if (factionOverrides.allowNonstandardLanguage && factionOverrides.reason) {
          violations.push(`WARN: Faction profile override allows nonstandard language "${language}" for ${factionProfile.displayName} (${factionOverrides.reason}).`)
        } else {
          violations.push(`Faction profile language mismatch: "${language}" is not in the canonical language registry or ${factionProfile.displayName} whitelist.`)
        }
      }
    }

    if (factionProfile.spellcasting.default === 'prohibited' && hasSpellcastingContent(statBlockSection)) {
      if (factionOverrides.allowSpellcasting && factionOverrides.reason && factionProfile.spellcasting.allowWithExplicitOverride) {
        violations.push(`WARN: Faction profile override allows spellcasting for ${factionProfile.displayName} (${factionOverrides.reason}).`)
      } else {
        violations.push(`Faction profile spellcasting mismatch: ${factionProfile.displayName} prohibits spellcasting unless an explicit override is justified.`)
      }
    }

    for (const rule of applicableMechanicalRules) {
      const hasWeaponConflict = findWeaponConflictInStatBlock(statBlockSection, rule)
      if (!hasWeaponConflict) continue

      const hasOverride = overrideSatisfied(
        rule.override.allowed,
        rule.override.requiresReason,
        factionOverrides.allowObviousWeapon,
        factionOverrides.reason,
      )
      const explicitRequest = explicitlyRequestsObviousWeapon(sourcePrompt)
      if (hasOverride) {
        violations.push(`WARN: Faction profile override allows obvious weapon "${hasWeaponConflict}" for ${factionProfile.displayName} (${factionOverrides.reason}).`)
      } else if (!explicitRequest) {
        violations.push(`Faction profile cover-identity mismatch: ${factionProfile.displayName} urban cover identities should not use obvious weapon "${hasWeaponConflict}" unless the prompt explicitly requests it or frontmatter overrides it with a reason.`)
      }
    }

    if (abilityScores) {
      if (hasObserverDoctrine(doctrineThemeText)) {
        const observerWisFloor = factionProfile.abilityFloors.observer?.wis
        if (observerWisFloor && abilityScores.wis < observerWisFloor) {
          violations.push(`WARN: Faction profile observer floor: ${factionProfile.displayName} observer doctrine expects WIS ${observerWisFloor}+ but the stat block uses ${abilityScores.wis}.`)
        }
      }

      if (hasCoverIdentitySignals(doctrineThemeText)) {
        const infiltratorDexFloor = factionProfile.abilityFloors.infiltrator?.dex
        const infiltratorChaFloor = factionProfile.abilityFloors.infiltrator?.cha
        if (infiltratorDexFloor && abilityScores.dex < infiltratorDexFloor) {
          violations.push(`WARN: Faction profile infiltrator floor: ${factionProfile.displayName} infiltrators should have DEX ${infiltratorDexFloor}+ but the stat block uses ${abilityScores.dex}.`)
        }
        if (infiltratorChaFloor && abilityScores.cha < infiltratorChaFloor) {
          violations.push(`WARN: Faction profile infiltrator floor: ${factionProfile.displayName} infiltrators should have CHA ${infiltratorChaFloor}+ but the stat block uses ${abilityScores.cha}.`)
        }
      }
    }

    if (factionProfile.requiredDoctrineThemes.length > 0) {
      const missingThemes = factionProfile.requiredDoctrineThemes.filter((theme) => !themeIsRepresented(theme, doctrineThemeText))
      if (missingThemes.length > 0) {
        violations.push(`WARN: Faction profile doctrine themes missing for ${factionProfile.displayName}: ${missingThemes.join(', ')}.`)
      }
    }
  }

  const traitEntries = [...traitsSection.matchAll(/\*\*([^*]+)\.\*\*\s+([^\n]+(?:\n(?!\*\*|###|##).+)*)/g)]
  for (const [, traitName, traitBody] of traitEntries) {
    if (!isRunnableMechanicText(traitBody.trim())) {
      violations.push(`WARN: Trait is descriptive rather than runnable: "${traitName}". Turn it into a concrete mechanic or move it to DM-Only Notes.`)
    }
  }

  // Modular options validation — ## Variant Options section must be mechanically sound
  if (variantSection) {
    if (!/choose\s+\d+/i.test(variantSection)) {
      violations.push('## Variant Options section must contain "Choose N" selection instructions')
    }
    // Flag vague ability descriptions or "DM discretion" without a concrete effect
    if (/\bdm\s+decides?\b|\bundefined\b|\bvague\b/i.test(variantSection)) {
      violations.push('Variant options contain vague ability descriptions — each option must be mechanically self-contained')
    }
    if (/\bdm\s+discretion\b(?![^.]*(?:advantage|disadvantage|damage|dc\s+\d+|save|check|half|full|once|per\s+(?:turn|day|scene|rest)))/i.test(variantSection)) {
      violations.push('Variant option uses "DM discretion" without a concrete mechanical effect — specify what changes (damage, check, save DC, advantage, etc.)')
    }
    if (/\+\d+\s+to\s+[A-Za-z ()'-]+\s+checks?\b/i.test(variantSection)) {
      violations.push('WARN: Variant option uses a flat bonus instead of a scene-runnable mechanic.')
    }
    if (/\blearns?\s+(?:a\s+)?new\s+skill proficiency\b|\bnew skill proficiency after an hour\b/i.test(variantSection)) {
      violations.push('WARN: Variant option grants a long-horizon proficiency instead of a scene-runnable mechanic.')
    }
    if (/\bcan often acquire information\b|\boften acquire information\b/i.test(variantSection)) {
      violations.push('WARN: Variant option is descriptive rather than runnable.')
    }
    const bareOptionLines = variantSection
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^[-*]\s+/.test(line))
      .filter((line) => {
        const stripped = line.replace(/^[-*]\s+/, '').trim()
        if (/\*\*[^*]+\.\*\*\s+\S+/.test(stripped)) return false
        if (/\*\*[^*]+:\*\*\s+\S+/.test(stripped)) return false
        if (/^[^:]+:\s+\S+/.test(stripped)) return false
        if (/\.\s+\S+/.test(stripped)) return false
        return true
      })
    if (bareOptionLines.length > 0) {
      violations.push('Variant options must be concrete mechanics, not names only.')
    }
    // Flag permanent stat changes as variant options (those belong in the base)
    if (/\bpermanent(?:ly)?\s+(?:gain|add|increase|new\s+skill|proficiency)\b/i.test(variantSection)) {
      violations.push('Variant options must not grant permanent stat/skill changes — use temporary or scene-scoped effects')
    }
    // Flag modern language in variant options
    const modernTechPattern = getModernTechPattern()
    if (modernTechPattern && modernTechPattern.test(variantSection)) {
      violations.push('Variant options contain modern technology language — use Karsac-appropriate props')
    }
    for (const match of variantSection.matchAll(/\*\*([^*:]+?)(?:\.|:)\*\*\s+([^\n]+(?:\n(?!\*\*|###|##|- \*\*).+)*)/g)) {
      const optionName = match[1].trim()
      const optionText = match[2].trim()
      if (!isRunnableMechanicText(optionText)) {
        violations.push(`WARN: Variant option is descriptive rather than runnable: "${optionName}".`)
      }
    }
  }

  return { violations, valid: violations.filter((violation) => !isWarningViolation(violation)).length === 0 }
}


/**
 * Auto-repair adversary output for mechanical violations that can be fixed
 * deterministically (without re-calling the model).
 *
 * Currently handles:
 * - Removing unexplained darkvision from senses line (item 1)
 */
/**
 * Deterministically inject faction metadata into the Corpus Frontmatter section.
 * Called after model generation when constraints specify a locked faction.
 * This ensures the faction appears in related.factions and tags regardless of
 * whether the model remembered to include it.
 */
export function repairFactionMetadata(
  outputText: string,
  constraints: AdversaryProposalConstraints,
): string {
  if (!constraints.lockedFaction) return outputText

  const faction    = constraints.lockedFaction              // e.g. 'shadow-walkers'
  const factionTag = faction.replace('-walkers', '-walker') // e.g. 'shadow-walker'

  let repaired = outputText

  // ── Inject into related.factions field ──────────────────────────────────────
  // Match: "  factions: []" or "  factions: [...]"
  if (/\bfactions:\s*\[\s*\]/.test(repaired)) {
    repaired = repaired.replace(
      /\bfactions:\s*\[\s*\]/,
      `factions: [${faction}]`,
    )
  } else if (/\bfactions:\s*\[([^\]]*)\]/.test(repaired)) {
    repaired = repaired.replace(
      /\bfactions:\s*\[([^\]]*)\]/,
      (_, existing: string) => {
        const entries = existing.split(',').map(s => s.trim()).filter(Boolean)
        if (!entries.includes(faction)) entries.push(faction)
        return `factions: [${entries.join(', ')}]`
      },
    )
  } else if (/##\s+Corpus\s+Frontmatter/i.test(repaired)) {
    repaired = repaired.replace(
      /(##\s+Corpus\s+Frontmatter\s*\n(?:```yaml\s*\n)?---\n[\s\S]*?)(tags:\s*\[[^\]]*\])/i,
      (_match, prefix: string, tagsLine: string) => `${prefix}related:\n  factions: [${faction}]\n${tagsLine}`,
    )
  }

  // ── Inject tag ───────────────────────────────────────────────────────────────
  // Only if the tag is not already present
  if (/\btags:\s*\[([^\]]*)\]/.test(repaired)) {
    repaired = repaired.replace(
      /\btags:\s*\[([^\]]*)\]/,
      (_, existing: string) => {
        const entries = existing.split(',').map(s => s.trim()).filter(Boolean)
        if (!entries.includes(factionTag)) entries.push(factionTag)
        return `tags: [${entries.join(', ')}]`
      },
    )
  }

  return repaired
}

export function repairAdversaryOutput(
  outputText: string,
  validation: AdversaryValidation,
  baseContent: string | null,
  constraints?: AdversaryProposalConstraints,
): string {
  // Precedence order for adversary generation and repair:
  // 1. User locked constraints
  // 2. Faction profile / doctrine profile
  // 3. Proposal type contract
  // 4. Mechanical base scaffold
  // 5. Model creative additions
  // Lower-precedence content is repaired or rejected when it conflicts with higher-precedence constraints.
  let repaired = outputText

  if (validation.violations.some(v => v.toLowerCase().includes('unexplained darkvision'))) {
    // Strip ", Darkvision N ft." or "Darkvision N ft., " from the senses line
    repaired = repaired.replace(/,\s*Darkvision\s+\d+\s*ft\.?/gi, '')
    repaired = repaired.replace(/Darkvision\s+\d+\s*ft\.?,?\s*/gi, '')
    // Clean up double commas or leading comma+space that might remain
    repaired = repaired.replace(/\*\*Senses\*\*\s*,/g, '**Senses**')
    repaired = repaired.replace(/Senses\s*,/gi, 'Senses')
  }

  repaired = injectDoctrineExpressiveStatBlockMechanics(repaired, constraints)
  repaired = normalizeDisguiseKitAndSocialPressure(repaired)
  repaired = tightenQuickConcealment(repaired)
  repaired = normalizeForbiddenFactionAffiliations(repaired, constraints)
  repaired = applyFactionProfileSafeRepairs(repaired, validation, constraints)
  repaired = normalizeWeakVariantMechanics(repaired)
  repaired = normalizeFinalStatBlockMath(repaired)
  repaired = normalizeFinalAdversaryLanguage(repaired)
  repaired = rewriteAdaptationSummaryFromFinalStatBlock(repaired, baseContent, validation)

  return repaired
}

function applyFactionProfileSafeRepairs(
  outputText: string,
  validation: AdversaryValidation,
  constraints?: AdversaryProposalConstraints,
): string {
  let repaired = outputText
  const inferredFactionSlug = inferFactionSlugFromOutput(repaired, constraints)
  const factionProfile = getFactionProfile(inferredFactionSlug)
  if (!factionProfile) return repaired

  if (inferredFactionSlug === 'shadow-walkers') {
    repaired = ensureShadowWalkerDmOnlyNotes(repaired)
    repaired = normalizeShadowWalkerIdentityLine(repaired, factionProfile, constraints)
  }

  const hasFactionLanguageIssue = validation.violations.some((violation) => violation.includes('Faction profile language mismatch'))
  if (hasFactionLanguageIssue) {
    repaired = normalizeFactionLanguages(repaired, factionProfile, constraints)
  }

  if (
    validation.violations.some((violation) =>
      violation.includes('creature-type mismatch') || violation.includes('alignment mismatch'),
    )
  ) {
    repaired = normalizeShadowWalkerIdentityLine(repaired, factionProfile, constraints)
  }
  repaired = normalizeShadowWalkerSpellPolicy(repaired, validation, factionProfile)
  repaired = normalizeCoverIdentityWeapons(repaired, factionProfile, constraints)
  repaired = ensureShadowWalkerRestraintTheme(repaired, factionProfile)
  return repaired
}

function normalizeFinalAdversaryLanguage(outputText: string): string {
  return outputText
    .replace(/\bthe The\b/g, 'the ')
    .replace(/\bWhen the The\b/g, 'When the ')
    .replace(/\bIf the The\b/g, 'If the ')
    .replace(/\bwhen the The\b/g, 'when the ')
    .replace(/\bif the The\b/g, 'if the ')
    .replace(/\bthe\s{2,}/g, 'the ')
    .replace(/coded communication device\s*\(disguised as a trinket\)/gi, 'coded trinket and waxed cipher strip')
    .replace(/\btransmits encrypted messages\b/gi, 'passes coded messages')
    .replace(/\bcoded communication device\b/gi, 'coded trinket')
    .replace(/\bcommunication device\b/gi, 'waxed cipher strip')
    .replace(/\bencrypted device\b/gi, 'marked bone tally')
    .replace(/\btransmits encrypted\b/gi, 'passes coded messages by')
    .replace(/\btransmits\b/gi, 'passes messages by')
}

function normalizeFinalStatBlockMath(outputText: string): string {
  const statBlockSectionMatch = outputText.match(/(##\s+Stat\s+Block\s*\n)([\s\S]*?)(?=\n##\s|\s*$)/i)
  if (!statBlockSectionMatch) return outputText

  let statBlockSection = statBlockSectionMatch[2]

  statBlockSection = statBlockSection.replace(
    /(\*{0,2}Hit\s+Points\*{0,2}\s+)(\d+)(\s*\()(\d+)d(\d+)([^)]*)(\))/i,
    (_match, prefix: string, _stated: string, openParen: string, numDiceRaw: string, dieSizeRaw: string, modPart: string, closeParen: string) => {
      const numDice = Number(numDiceRaw)
      const dieSize = Number(dieSizeRaw)
      const modMatch = String(modPart).match(/([+-])\s*(\d+)/)
      const modifier = modMatch ? (modMatch[1] === '+' ? Number(modMatch[2]) : -Number(modMatch[2])) : 0
      const expected = expectedAverageFromDiceFormula(numDice, dieSize, modifier)
      return `${prefix}${expected}${openParen}${numDice}d${dieSize}${modPart}${closeParen}`
    },
  )

  const dexMod = detectDexModifierFromStatBlock(statBlockSection)
  if (dexMod !== null) {
    statBlockSection = statBlockSection.replace(
      /(\*{0,2}Armou?r\s+Class\*{0,2}\s+)(\d+)(\s*\(([^)\n]+)\))/i,
      (match: string, prefix: string, _stated: string, parenPart: string, armourDetail: string) => {
        if (!/^leather\s+armou?r$/i.test(armourDetail.trim())) return match
        const hasExplicitBonus = /\bshield\b|\bwith\b|\bplus\b|\+\d|\bnatural\b|\bmage\b|\bdefen/i.test(armourDetail)
        if (hasExplicitBonus) return match
        const expectedAc = 11 + dexMod
        return `${prefix}${expectedAc}${parenPart}`
      },
    )
  }

  return outputText.replace(statBlockSectionMatch[0], `${statBlockSectionMatch[1]}${statBlockSection}`)
}

function normalizeDisguiseKitAndSocialPressure(outputText: string): string {
  let repaired = outputText
  const statBlockSectionMatch = repaired.match(/(##\s+Stat\s+Block\s*\n)([\s\S]*?)(?=\n##\s|\s*$)/i)
  if (!statBlockSectionMatch) return repaired

  let statBlockSection = statBlockSectionMatch[2]
  const adversaryName = repaired.match(/^#\s+Adversary:\s+(.+)$/im)?.[1]?.trim() ?? 'Adversary'
  const actor = formatCreatureName(adversaryName, { definiteArticle: true })

  if (/\*\*Disguise Kit\.?\*\*/i.test(statBlockSection)) {
    statBlockSection = statBlockSection.replace(/\n?\*\*Disguise Kit\.?\*\*[\s\S]*?(?=\n\*\*|\n###\s|\s*$)/i, '\n')
    statBlockSection = upsertToolProficienciesLine(statBlockSection, ['disguise kit', 'forgery kit'])
    if (!/\*\*Prepared Cover\.\*\*/i.test(statBlockSection)) {
      statBlockSection = upsertStatBlockAbility(
        statBlockSection,
        'Traits',
        `**Prepared Cover.** ${adversaryName} has advantage on Charisma (Deception) checks made to maintain a prepared civilian identity or pass as an unremarkable worker, clerk, or passerby in the current settlement.`,
      )
    }
  }

  statBlockSection = statBlockSection.replace(
    /\*\*(?:Persuasion|Social Pressure)\.?\*\*[\s\S]*?\bcharmed\b[\s\S]*?(?=\n\*\*|\n###\s|\s*$)/gi,
    `**Social Pressure.** One creature within 30 feet that can hear ${actor} must succeed on a DC 13 Wisdom (Insight) check or treat ${actor}'s cover identity as plausible until given clear evidence otherwise. This effect ends early if ${actor} takes hostile action or if the target is shown direct contradictory evidence.`,
  )

  statBlockSection = statBlockSection.replace(
    /\*\*Whispered Suggestion\.?\*\*[\s\S]*?\bcharmed\b[\s\S]*?(?=\n\*\*|\n###\s|\s*$)/gi,
    `**False Confidence.** ${adversaryName} makes a Charisma (Deception) check contested by the target's Wisdom (Insight). On a success, the target hesitates, accepts a harmless procedural explanation, or gives ${actor} enough time to move 10 feet without provoking opportunity attacks.`,
  )

  return repaired.replace(statBlockSectionMatch[0], `${statBlockSectionMatch[1]}${statBlockSection}`)
}

function ensureShadowWalkerDmOnlyNotes(outputText: string): string {
  const dmHeading = '## DM-Only Notes'
  const sentence = 'This adversary is a Shadow Walker operative working within a local cell.'
  const existingSection = outputText.match(/##\s+DM.Only\s+Notes?\s*\n([\s\S]*?)(?=\n##\s|\s*$)/i)

  if (!existingSection) {
    return upsertTopLevelSection(outputText, dmHeading, `${dmHeading}\n${sentence}`)
  }

  const body = existingSection[1].trim()
  if (/\bshadow(?:\s|-)?walker\b/i.test(body)) return outputText

  const nextBody = body.length > 0 ? `${body}\n\n${sentence}` : sentence
  return outputText.replace(existingSection[0], `${dmHeading}\n${nextBody}`)
}

function normalizeFactionLanguages(
  outputText: string,
  factionProfile: ReturnType<typeof getFactionProfile>,
  constraints?: AdversaryProposalConstraints,
): string {
  if (!factionProfile) return outputText
  const statBlockSectionMatch = outputText.match(/(##\s+Stat\s+Block\s*\n)([\s\S]*?)(?=\n##\s|\s*$)/i)
  if (!statBlockSectionMatch) return outputText

  let statBlockSection = statBlockSectionMatch[2]
  let replacementLanguages = factionProfile.languageWhitelist.slice(0, 3)

  if (factionProfile.slug === 'shadow-walkers' && isShadowWalkerUrbanInfiltrator(outputText, constraints)) {
    replacementLanguages = ['Common', 'Trade Tongue (local)', 'Shadow Walker Sign']
  }

  if (replacementLanguages.length === 0) return outputText

  const languagesLine = `**Languages** ${replacementLanguages.join(', ')}`
  if (/\*{0,2}Languages\*{0,2}\s+[^\n]+/i.test(statBlockSection)) {
    statBlockSection = statBlockSection.replace(/\*{0,2}Languages\*{0,2}\s+[^\n]+/i, languagesLine)
  } else if (/\*{0,2}Senses\*{0,2}\s+[^\n]+\n/i.test(statBlockSection)) {
    statBlockSection = statBlockSection.replace(/(\*{0,2}Senses\*{0,2}\s+[^\n]+\n)/i, `${languagesLine}\n$1`)
  } else {
    statBlockSection = `${statBlockSection.trimEnd()}\n${languagesLine}\n`
  }

  return outputText.replace(statBlockSectionMatch[0], `${statBlockSectionMatch[1]}${statBlockSection}`)
}

function normalizeCoverIdentityWeapons(
  outputText: string,
  factionProfile: ReturnType<typeof getFactionProfile>,
  constraints?: AdversaryProposalConstraints,
): string {
  if (!factionProfile) return outputText
  const frontmatterSection = outputText.match(/##\s+Corpus\s+Frontmatter\s*\n([\s\S]*?)(?=\n##\s|\s*$)/i)?.[1] ?? ''
  const overrides = parseFactionProfileOverrides(frontmatterSection)
  const doctrineText = [
    outputText.match(/##\s+Doctrine\s*\n([\s\S]*?)(?=\n##\s|\s*$)/i)?.[1] ?? '',
    outputText.match(/##\s+Doctrine\s+Under\s+Pressure\s*\n([\s\S]*?)(?=\n##\s|\s*$)/i)?.[1] ?? '',
    outputText.match(/##\s+Tactical\s+Notes\s*\n([\s\S]*?)(?=\n##\s|\s*$)/i)?.[1] ?? '',
    outputText.match(/##\s+DM.Only\s+Notes?\s*\n([\s\S]*?)(?=\n##\s|\s*$)/i)?.[1] ?? '',
  ].join('\n')
  const coverIdentityContext = `${outputText}\n${doctrineText}`
  const hasCoverIdentityContext =
    hasCoverIdentitySignals(coverIdentityContext) ||
    /\*\*Prepared Cover(?:\.|:)\*\*/i.test(outputText) ||
    isShadowWalkerUrbanInfiltrator(outputText, constraints)
  if (!hasCoverIdentityContext) return outputText
  if (overrides.allowObviousWeapon && overrides.reason) return outputText

  const statBlockSectionMatch = outputText.match(/(##\s+Stat\s+Block\s*\n)([\s\S]*?)(?=\n##\s|\s*$)/i)
  if (!statBlockSectionMatch) return outputText

  let statBlockSection = statBlockSectionMatch[2]
  const conflictingWeapons = getApplicableWeaponConflictNames(
    outputText,
    constraints,
    factionProfile,
    constraints?.preferredBase ?? null,
  )
  if (conflictingWeapons.length === 0) return outputText

  const conflictRegex = new RegExp(
    `\\*\\*(?:${conflictingWeapons.map((weapon) => weapon.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?:\\.|:)\\*\\*[\\s\\S]*?(?=\\n\\*\\*|\\n###\\s|\\n##\\s|\\s*$)`,
    'i',
  )
  if (!conflictRegex.test(statBlockSection)) return outputText

  const dexMod = detectDexModifierFromStatBlock(statBlockSection) ?? 2
  const strMod = detectStrModifierFromStatBlock(statBlockSection) ?? 0
  const proficiencyBonus = parseProficiencyBonusFromStatBlock(statBlockSection)
  const preferredWeapon = choosePreferredConcealableWeapon(factionProfile, 'ranged') ?? choosePreferredConcealableWeapon(factionProfile, 'melee')
  if (!preferredWeapon) return outputText

  statBlockSection = statBlockSection.replace(
    conflictRegex,
    renderPreferredConcealableWeapon(preferredWeapon, { dex: dexMod, str: strMod }, proficiencyBonus),
  )

  return outputText.replace(statBlockSectionMatch[0], `${statBlockSectionMatch[1]}${statBlockSection}`)
}

function choosePreferredConcealableWeapon(
  factionProfile: ReturnType<typeof getFactionProfile>,
  preferredType: 'ranged' | 'melee',
) {
  if (!factionProfile) return null
  return factionProfile.preferredConcealableWeapons.find((weapon) => weapon.type === preferredType) ?? null
}

function renderPreferredConcealableWeapon(
  weapon: NonNullable<ReturnType<typeof choosePreferredConcealableWeapon>>,
  abilityMods: { dex: number; str: number },
  proficiencyBonus: number,
): string {
  const abilityMod = weapon.ability === 'str' ? abilityMods.str : abilityMods.dex
  const attackBonus = proficiencyBonus + abilityMod
  const damageMatch = weapon.damageDie.match(/^(\d+)d(\d+)$/i)
  const averageDamage = damageMatch
    ? expectedAverageFromDiceFormula(Number(damageMatch[1]), Number(damageMatch[2]), abilityMod)
    : expectedAverageFromDiceFormula(1, 4, abilityMod)
  const attackLead = weapon.type === 'ranged'
    ? `Ranged Weapon Attack: +${attackBonus} to hit, range ${weapon.range ?? '20/60 ft.'}, one target.`
    : `Melee Weapon Attack: +${attackBonus} to hit, reach ${weapon.reach ?? '5 ft.'}, one target.`
  const rider = weapon.rider ? ` ${weapon.rider}` : ''
  return `**${weapon.name}.** ${attackLead} Hit: ${averageDamage} (${weapon.damageDie} + ${abilityMod}) piercing damage.${rider}`
}

function normalizeShadowWalkerIdentityLine(
  outputText: string,
  factionProfile: ReturnType<typeof getFactionProfile>,
  constraints?: AdversaryProposalConstraints,
): string {
  if (!factionProfile || factionProfile.slug !== 'shadow-walkers') return outputText
  if ((constraints?.lockedFaction ?? inferFactionSlugFromOutput(outputText, constraints)) !== 'shadow-walkers') return outputText

  const statBlockSectionMatch = outputText.match(/(##\s+Stat\s+Block\s*\n)([\s\S]*?)(?=\n##\s|\s*$)/i)
  if (!statBlockSectionMatch) return outputText

  let statBlockSection = statBlockSectionMatch[2]
  const typeLineMatch = statBlockSection.match(/^\*([^*\n]+)\*$/m)
  if (!typeLineMatch) return outputText

  const currentLine = typeLineMatch[1].trim()
  const parts = currentLine.split(',').map((part) => part.trim()).filter(Boolean)
  const sizeAndType = parts[0] ?? 'Medium humanoid'
  const size = sizeAndType.match(/^(Tiny|Small|Medium|Large|Huge|Gargantuan)\b/i)?.[1] ?? 'Medium'
  const alignmentPart = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''
  const needsSubtypeRepair = /\byngondi\b/i.test(currentLine)
  const needsAlignmentRepair = /\bevil\b/i.test(currentLine)
  const malformedAlignmentSlot = alignmentPart.length > 0 && !CANONICAL_ALIGNMENTS.has(alignmentPart)
  if (!needsSubtypeRepair && !needsAlignmentRepair && !malformedAlignmentSlot) return outputText

  const repairedLine = `*${size} humanoid, neutral*`
  statBlockSection = statBlockSection.replace(typeLineMatch[0], repairedLine)
  return outputText.replace(statBlockSectionMatch[0], `${statBlockSectionMatch[1]}${statBlockSection}`)
}

function normalizeShadowWalkerSpellPolicy(
  outputText: string,
  validation: AdversaryValidation,
  factionProfile: ReturnType<typeof getFactionProfile>,
): string {
  if (!factionProfile || factionProfile.slug !== 'shadow-walkers') return outputText
  if (!validation.violations.some((violation) => violation.includes('spellcasting mismatch'))) return outputText

  const frontmatterSection = outputText.match(/##\s+Corpus\s+Frontmatter\s*\n([\s\S]*?)(?=\n##\s|\s*$)/i)?.[1] ?? ''
  const overrides = parseFactionProfileOverrides(frontmatterSection)
  if (overrides.allowSpellcasting && overrides.reason) return outputText

  const statBlockSectionMatch = outputText.match(/(##\s+Stat\s+Block\s*\n)([\s\S]*?)(?=\n##\s|\s*$)/i)
  if (!statBlockSectionMatch) return outputText

  let statBlockSection = statBlockSectionMatch[2]
  statBlockSection = statBlockSection
    .replace(/\n?\*\*Spellcasting\.?\*\*[\s\S]*?(?=\n\*\*|\n###\s|\n##\s|\s*$)/gi, '\n')
    .replace(/\n?\*\*Minor Illusion\.?\*\*[\s\S]*?(?=\n\*\*|\n###\s|\n##\s|\s*$)/gi, '\n')
    .replace(/\n?\*\*(?:Charm Person|Suggestion)\.?\*\*[\s\S]*?(?=\n\*\*|\n###\s|\n##\s|\s*$)/gi, '\n')

  if (!/\*\*False Surface\.\*\*/i.test(statBlockSection)) {
    statBlockSection = upsertStatBlockAbility(
      statBlockSection,
      'Actions',
      '**False Surface.** The adversary uses a prepared prop, practised lie, or staged distraction to misdirect attention. One creature within 30 feet that can see or hear it must succeed on a DC 13 Wisdom (Insight) check or have disadvantage on its next check to track, identify, or expose the adversary before the end of its next turn.',
    )
  }

  return outputText.replace(statBlockSectionMatch[0], `${statBlockSectionMatch[1]}${statBlockSection}`)
}

function ensureShadowWalkerRestraintTheme(
  outputText: string,
  factionProfile: ReturnType<typeof getFactionProfile>,
): string {
  if (!factionProfile || factionProfile.slug !== 'shadow-walkers') return outputText

  const doctrineSection = outputText.match(/##\s+Doctrine\s*\n([\s\S]*?)(?=\n##\s|\s*$)/i)?.[1] ?? ''
  const tacticalNotesSection = outputText.match(/##\s+Tactical\s+Notes\s*\n([\s\S]*?)(?=\n##\s|\s*$)/i)?.[1] ?? ''
  const combined = `${doctrineSection}\n${tacticalNotesSection}`
  if (hasShadowWalkerRestraintTheme(combined)) return outputText

  const sentence = 'Their restraint is not mercy; it is discipline. They use violence only to preserve the mission, escape, or prevent exposure.'
  if (doctrineSection.trim()) {
    return outputText.replace(
      /##\s+Doctrine\s*\n([\s\S]*?)(?=\n##\s|\s*$)/i,
      (_match, body: string) => `## Doctrine\n${body.trim()}\n\n${sentence}`,
    )
  }

  if (tacticalNotesSection.trim()) {
    return outputText.replace(
      /##\s+Tactical\s+Notes\s*\n([\s\S]*?)(?=\n##\s|\s*$)/i,
      (_match, body: string) => `## Tactical Notes\n${body.trim()}\n\n${sentence}`,
    )
  }

  return upsertTopLevelSection(outputText, '## Tactical Notes', `## Tactical Notes\n${sentence}`, '## Stat Block')
}

function normalizeForbiddenFactionAffiliations(
  outputText: string,
  constraints?: AdversaryProposalConstraints,
): string {
  if (constraints?.lockedFaction !== 'shadow-walkers') return outputText
  if (!(constraints.forbiddenFactions ?? []).includes('yngondi')) return outputText

  return outputText
    .replace(/\blikely\s+tied\s+to\s+a\s+yngondi\s+directive\b/gi, 'likely tied to an internal Shadow Walker directive')
    .replace(/\btied\s+to\s+a\s+yngondi\s+directive\b/gi, 'tied to an internal Shadow Walker directive')
    .replace(/\bpotentially\s+aligned\s+with\s+broader\s+yngondi\s+interests\b/gi, 'potentially aligned with broader Shadow Walker objectives')
    .replace(/\baligned\s+with\s+broader\s+yngondi\s+interests\b/gi, 'aligned with broader Shadow Walker objectives')
    .replace(/\bprotecting\s+a\s+yngondi\s+asset\b/gi, 'protecting a Shadow Walker contact, cache, or dead-drop route')
}

function normalizeWeakVariantMechanics(outputText: string): string {
  let repaired = outputText
  const variantSection = repaired.match(/##\s+Variant\s+Options\s*\n([\s\S]*?)(?=\n##\s|\s*$)/i)?.[1]
  if (!variantSection) return repaired

  repaired = repaired.replace(
    /(?:^|\n)\s*(?:[-*]\s+)?(?:\*\*)?Silver Tongue(?:\.\*\*|\:\*\*|\.|:)?\s*(?:\+\d+\s+to\s+Persuasion checks\.|The adversary can re-?roll one failed Charisma check per long rest\.)/i,
    '\n**Silver Tongue.** Once per scene, when the adversary fails a Charisma (Persuasion or Deception) check by 3 or less, it can turn the failure into a partial success: the target hesitates, delays action, or gives away one minor detail, but becomes suspicious afterwards.',
  )

  repaired = repaired.replace(
    /(?:^|\n)\s*(?:[-*]\s+)?(?:\*\*)?Quick Study(?:\.\*\*|\:\*\*|\.|:)?\s*(?:Learns? a new skill proficiency after an hour\.|The adversary can learn a new skill proficiency from observing someone else using it\.|The adversary can learn one new skill proficiency from observing a skilled individual\.|The adversary can learn a simple skill or trade secret with a short period of observation\.)/i,
    '\n**Quick Study.** After observing a creature for 1 minute, the adversary has advantage on its next Wisdom (Insight) or Intelligence (Investigation) check involving that creature before the end of the scene.',
  )

  repaired = repaired.replace(
    /(?:^|\n)\s*(?:[-*]\s+)?(?:\*\*)?(?:Information Broker|Contacts|Network Contact)(?:\.\*\*|\:\*\*|\.|:)?\s*(?:Can often acquire information\.|The adversary knows several individuals within the settlement who can provide information or assistance\.|The adversary can spend a bonus action to contact a local informant for information\.)/i,
    "\n**Contacts.** Once per scene in a settlement, the adversary can name or signal a minor contact. The contact can provide one rumour, delay a pursuer for 1 round, or point to a plausible route, at the DM's discretion.",
  )

  repaired = repaired.replace(
    /(?:^|\n)\s*(?:[-*]\s+)?(?:\*\*)?Network Contact(?:\.\*\*|\:\*\*|\.|:)?\s*The adversary can,\s*once per long rest,\s*send a coded message to another Shadow Walker operative within a 50-mile radius\./i,
    "\n**Contacts.** Once per scene in a settlement, the adversary can name or signal a minor contact. The contact can provide one rumour, delay a pursuer for 1 round, or point to a plausible route, at the DM's discretion.",
  )

  repaired = repaired.replace(
    /(?:^|\n)\s*(?:[-*]\s+)?(?:\*\*)?Keen Observer(?:\.\*\*|\:\*\*|\.|:)?\s*The adversary has advantage on Wisdom \(Insight\) checks\./i,
    '\n**Keen Observer.** Once per scene, the adversary can gain advantage on one Wisdom (Insight) check to read motive, catch a contradiction, or assess whether a creature is hiding intent.',
  )

  repaired = repaired.replace(
    /(?:^|\n)\s*(?:[-*]\s+)?(?:\*\*)?Master of Disguise(?:\.\*\*|\:\*\*|\.|:)?\s*The adversary gains proficiency with the Disguise Kit and can spend 1 minute to alter their appearance to resemble a different person\./i,
    '\n**Prepared Cover.** Once per scene, the adversary can reinforce a prepared civilian identity, gaining advantage on one Charisma (Deception) check to pass as an unremarkable worker, clerk, or passerby in the current settlement.',
  )

  repaired = repaired.replace(
    /(?:^|\n)\s*(?:[-*]\s+)?(?:\*\*)?Whispered Rumou?r(?:\.\*\*|\:\*\*|\.|:)?[\s\S]*?(?=\n\*\*|\n\s*[-*]\s+\*\*|\n###\s|\n##\s|\s*$)/i,
    '\n**Whispered Rumour.** The adversary plants a damaging rumour in a public conversation. One creature that can hear it must succeed on a DC 13 Wisdom (Insight) check or have disadvantage on its next Charisma check with that group before the end of the scene.',
  )

  repaired = repaired.replace(
    /(?:^|\n)\s*(?:[-*]\s+)?(?:\*\*)?Local Knowledge(?:\.\*\*|\:\*\*|\.|:)?\s*The adversary has advantage on Intelligence checks related to local customs, trade routes, civic offices, and known public figures in the settlement\./i,
    '\n**Local Knowledge.** The adversary has advantage on Intelligence checks related to local customs, trade routes, civic offices, and known public figures in the settlement.',
  )

  return repaired
}

function extractNamedMechanics(text: string): string[] {
  return [...text.matchAll(/\*\*([^*:]+?)(?:\.|:)\*\*/g)]
    .map((match) => match[1].trim())
    .filter(Boolean)
}

function rewriteAdaptationSummaryFromFinalStatBlock(
  outputText: string,
  baseContent: string | null,
  validation: AdversaryValidation,
): string {
  const needsRewrite = validation.violations.some((violation) => violation.startsWith('Adaptation mismatch:'))
  if (!needsRewrite) return outputText

  const statBlockSection = outputText.match(/##\s+Stat\s+Block\s*\n([\s\S]*?)(?=\n##\s|\s*$)/i)?.[1] ?? ''
  if (!statBlockSection.trim()) return outputText

  const statMechanics = extractNamedMechanics(statBlockSection)
  const baseMechanics = baseContent ? extractNamedMechanics(baseContent) : []
  const keptMechanics = statMechanics.filter((mechanic) =>
    baseMechanics.some((baseMechanic) => normalizeNamedMechanic(baseMechanic) === normalizeNamedMechanic(mechanic)),
  )
  const addedMechanics = statMechanics.filter((mechanic) =>
    !keptMechanics.some((keptMechanic) => normalizeNamedMechanic(keptMechanic) === normalizeNamedMechanic(mechanic)),
  )

  const keptLineItems = keptMechanics.length > 0
    ? keptMechanics.slice(0, 4)
    : ['Languages', 'ability scores']
  const addedLineItems = addedMechanics.length > 0
    ? addedMechanics.slice(0, 4)
    : ['Faction doctrine support', 'cover-identity presentation']

  const summaryBlock = [
    '## Adaptation Summary',
    `- Kept from base: ${keptLineItems.join(', ')}`,
    '- Changed from base: Finalised around the repaired stat block, faction doctrine, and settlement-cover behaviour.',
    `- Added: ${addedLineItems.join(', ')}`,
    '- Removed: Draft-only or unsupported claims not present in the final stat block.',
    '- Mechanical risk: Normalized after final deterministic repair.',
  ].join('\n')

  return upsertTopLevelSection(outputText, '## Adaptation Summary', summaryBlock, '## Stat Block')
}

function upsertToolProficienciesLine(statBlockSection: string, toolNames: string[]): string {
  const existingMatch = statBlockSection.match(/(\*{0,2}Tool\s+Proficiencies\*{0,2}\s+)([^\n]+)/i)
  if (existingMatch) {
    const existingTools = existingMatch[2].split(',').map((entry) => entry.trim()).filter(Boolean)
    for (const toolName of toolNames) {
      if (!existingTools.some((entry) => entry.toLowerCase() === toolName.toLowerCase())) {
        existingTools.push(toolName)
      }
    }
    return statBlockSection.replace(existingMatch[0], `${existingMatch[1]}${existingTools.join(', ')}`)
  }

  const afterSkills = /(\*{0,2}Skills\*{0,2}\s+[^\n]+\n)/i
  if (afterSkills.test(statBlockSection)) {
    return statBlockSection.replace(afterSkills, `$1**Tool Proficiencies** ${toolNames.join(', ')}\n`)
  }

  const afterSavingThrows = /(\*{0,2}Saving Throws\*{0,2}\s+[^\n]+\n)/i
  if (afterSavingThrows.test(statBlockSection)) {
    return statBlockSection.replace(afterSavingThrows, `$1**Tool Proficiencies** ${toolNames.join(', ')}\n`)
  }

  const beforeResistances = /(\*{0,2}Damage Resistances\*{0,2}\s+[^\n]+\n)/i
  if (beforeResistances.test(statBlockSection)) {
    return statBlockSection.replace(beforeResistances, `**Tool Proficiencies** ${toolNames.join(', ')}\n$1`)
  }

  const beforeSenses = /(\*{0,2}Senses\*{0,2}\s+[^\n]+\n)/i
  if (beforeSenses.test(statBlockSection)) {
    return statBlockSection.replace(beforeSenses, `**Tool Proficiencies** ${toolNames.join(', ')}\n$1`)
  }

  return `${statBlockSection.trimEnd()}\n**Tool Proficiencies** ${toolNames.join(', ')}\n`
}

function tightenQuickConcealment(outputText: string): string {
  const adversaryName = outputText.match(/^#\s+Adversary:\s+(.+)$/im)?.[1]?.trim() ?? 'Adversary'
  return outputText.replace(
    /\*\*Quick Concealment\.?\*\*[\s\S]*?(?=\n\*\*|\n[-*]\s+\*\*|\n###\s|\n##\s|\s*$)/gi,
    `**Quick Concealment.** When ${adversaryName} takes damage while within 10 feet of cover, a crowd, or a prepared hiding place, it can move up to 10 feet and make a Dexterity (Stealth) check.`,
  )
}

function injectDoctrineExpressiveStatBlockMechanics(
  outputText: string,
  constraints?: AdversaryProposalConstraints,
): string {
  const doctrineSection = outputText.match(/##\s+Doctrine-Expressive\s+Mechanics\s*\n([\s\S]*?)(?=\n##\s|\s*$)/i)?.[1] ?? ''
  const shadowWalkerUrban = isShadowWalkerUrbanInfiltrator(outputText, constraints)
  if (!doctrineSection.trim() && !shadowWalkerUrban) return outputText

  const namedMechanics = new Set(
    extractDoctrineExpressiveMechanicNames(doctrineSection)
      .map((name) => normalizeNamedMechanic(name))
      .filter(Boolean),
  )
  if (shadowWalkerUrban) {
    namedMechanics.add('mapped exits')
    namedMechanics.add('no last stand')
    namedMechanics.add('information first')
    namedMechanics.add('crowd break')
  }
  if (namedMechanics.size === 0) return outputText

  const statBlockSectionMatch = outputText.match(/(##\s+Stat\s+Block\s*\n)([\s\S]*?)(?=\n##\s|\s*$)/i)
  if (!statBlockSectionMatch) return outputText

  const adversaryName = outputText.match(/^#\s+Adversary:\s+(.+)$/im)?.[1]?.trim() ?? 'Adversary'
  const actor = formatCreatureName(adversaryName, { definiteArticle: true })
  let statBlockSection = statBlockSectionMatch[2]

  const doctrineMechanics: Record<string, { section: 'Traits' | 'Reactions'; text: string }> = {
    'prepared cover': {
      section: 'Traits',
      text: `**Prepared Cover.** ${adversaryName} has advantage on Charisma (Deception) checks made to maintain a prepared civilian identity or pass as an unremarkable worker, clerk, or passerby in the current settlement.`,
    },
    'mapped exits': {
      section: 'Traits',
      text: `**Mapped Exits.** If ${actor} has spent at least 10 minutes in a settlement location before combat begins, it has advantage on initiative. During the first round of combat, it can move up to half its speed without provoking opportunity attacks.`,
    },
    'no last stand': {
      section: 'Traits',
      text: `**No Last Stand.** ${adversaryName} does not fight to the death. If reduced below half its hit points, exposed by name, or separated from its cover identity, it attempts to flee, surrender under a false identity, or create a public misdirection.`,
    },
    'information first': {
      section: 'Traits',
      text: `**Information First.** When ${actor} is reduced below half its hit points, captured, or forced to reveal information, it can conceal, destroy, or pass on one carried note, cipher strip, ledger scrap, or marked bone tally.`,
    },
    'crowd break': {
      section: 'Reactions',
      text: `**Crowd Break.** When ${actor} is hit or missed by an attack while at least two non-hostile creatures or significant cover are within 30 feet, it can move up to half its speed without provoking opportunity attacks.`,
    },
  }

  if (shadowWalkerUrban && !/\*\*(?:Urban Camouflage|Prepared Cover)\.\*\*/i.test(statBlockSection)) {
    namedMechanics.add('prepared cover')
  }

  for (const [mechanicName, mechanicSpec] of Object.entries(doctrineMechanics)) {
    if (!namedMechanics.has(mechanicName)) continue
    if (new RegExp(`\\*\\*${mechanicSpec.text.match(/\*\*([^*]+)\.\*\*/)?.[1]?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') ?? ''}\\.\\*\\*`, 'i').test(statBlockSection)) {
      continue
    }
    statBlockSection = upsertStatBlockAbility(statBlockSection, mechanicSpec.section, mechanicSpec.text)
  }

  let repaired = outputText.replace(statBlockSectionMatch[0], `${statBlockSectionMatch[1]}${statBlockSection}`)
  repaired = upsertDoctrineExpressiveMechanicsSection(repaired, adversaryName, shadowWalkerUrban)
  return repaired
}

function isShadowWalkerUrbanInfiltrator(
  outputText: string,
  constraints?: AdversaryProposalConstraints,
): boolean {
  const factionSlug = constraints?.lockedFaction ?? inferFactionSlugFromOutput(outputText, constraints) ?? ''
  const environment = constraints?.environmentContext ?? ''
  const lower = outputText.toLowerCase()
  const urbanSignal = /\burban\b|\btown\b|\bcity\b|\bsettlement\b|\bmarket\b|\bharbour\b|\bdock\b/.test(environment.toLowerCase())
    || /\burban\b|\btown\b|\bcity\b|\bsettlement\b|\bmarket\b|\bharbour\b|\bdock\b/.test(lower)
  return factionSlug === 'shadow-walkers' && urbanSignal
}

function upsertDoctrineExpressiveMechanicsSection(
  outputText: string,
  adversaryName: string,
  shadowWalkerUrban: boolean,
): string {
  const statBlockSection = outputText.match(/##\s+Stat\s+Block\s*\n([\s\S]*?)(?=\n##\s|\s*$)/i)?.[1] ?? ''
  const mechanics: string[] = []

  if (/\*\*(?:Urban Camouflage|Prepared Cover)\.\*\*/i.test(statBlockSection)) {
    mechanics.push(`- **Cover Identity / Unremarkable Presence.** ${adversaryName} stays legible as ordinary city life first, using concealment or a prepared civilian identity to remain forgettable until pressure closes in.`)
  }
  if (/\*\*Mapped Exits\.\*\*/i.test(statBlockSection)) {
    mechanics.push(`- **Mapped Exits.** Pre-read routes and room geometry let ${adversaryName} turn round-one pressure into movement instead of paralysis.`)
  }
  if (/\*\*No Last Stand\.\*\*/i.test(statBlockSection)) {
    mechanics.push(`- **No Last Stand.** Controlled withdrawal matters more than pride; once exposed or bloodied, ${adversaryName} chooses escape, false surrender, or public misdirection over dying in place.`)
  }
  if (/\*\*Crowd Break\.\*\*/i.test(statBlockSection)) {
    mechanics.push(`- **Crowd Break.** The city itself becomes cover under pressure, turning contact with the party into fresh movement lanes through bodies, stalls, and obstructed sightlines.`)
  }
  if (/\*\*Information First\.\*\*/i.test(statBlockSection)) {
    mechanics.push(`- **Information First.** Messages, tallies, and scraps are preserved or denied before retaliation; the mission survives even if the operative does not keep control of the scene.`)
  }
  if (/\*\*(?:False Surface|False Lead|Misdirection|Prepared Cover)\.\*\*/i.test(statBlockSection) || shadowWalkerUrban) {
    mechanics.push(`- **Social Misdirection.** ${adversaryName} solves pressure socially where possible, using false certainty, harmless pretexts, and shifting public attention before steel becomes the only answer.`)
  }

  if (mechanics.length === 0) return outputText

  const sectionBody = `## Doctrine-Expressive Mechanics\n${mechanics.join('\n')}`
  return upsertTopLevelSection(outputText, '## Doctrine-Expressive Mechanics', sectionBody, '## Player-Safe Description')
}

function upsertTopLevelSection(
  markdown: string,
  heading: string,
  block: string,
  insertBeforeHeading?: string,
): string {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const existing = markdown.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\n[\\s\\S]*?(?=\\n##\\s|$)`, 'i'))
  if (existing) {
    return markdown.replace(existing[0], `\n${block}`)
  }

  if (insertBeforeHeading) {
    const beforeEscaped = insertBeforeHeading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const beforeRegex = new RegExp(`(?:^|\\n)(${beforeEscaped}\\s*\\n)`, 'i')
    if (beforeRegex.test(markdown)) {
      return markdown.replace(beforeRegex, `\n${block}\n\n$1`)
    }
  }

  return `${markdown.trimEnd()}\n\n${block}\n`
}

function upsertStatBlockAbility(
  statBlockSection: string,
  sectionName: 'Traits' | 'Actions' | 'Reactions',
  abilityText: string,
): string {
  const sectionRegex = new RegExp(`(###\\s+${sectionName}\\s*\\n)([\\s\\S]*?)(?=\\n###\\s|\\s*$)`, 'i')
  const sectionMatch = statBlockSection.match(sectionRegex)

  if (!sectionMatch) {
    const insertion = `\n### ${sectionName}\n${abilityText}\n`
    if (sectionName === 'Reactions') {
      const bonusActionsRegex = /(###\s+Bonus Actions\s*\n[\s\S]*?)(?=\n###\s|\s*$)/i
      if (bonusActionsRegex.test(statBlockSection)) {
        return statBlockSection.replace(bonusActionsRegex, `$1${insertion}`)
      }
    }
    return `${statBlockSection.trimEnd()}${insertion}`
  }

  const currentBody = sectionMatch[2].trim()
  const nextBody = currentBody.length === 0 || /^none\b/i.test(currentBody)
    ? `${abilityText}\n`
    : `${currentBody}\n${abilityText}\n`

  return statBlockSection.replace(sectionRegex, `$1${nextBody}`)
}
