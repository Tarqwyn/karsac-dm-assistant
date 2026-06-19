import { existsSync, readFileSync } from 'fs'
import matter from 'gray-matter'
import { INDEX_DIR } from '../paths.js'
import { getCanonicalLanguages, getFactionProfile, getAllFactionProfiles } from '../faction-profiles.js'
import type { AliasMap, EntityMap, Entity } from '../types.js'
import type { ProposalType } from './proposalTypes.js'
import {
  clearProposalEntityRegistryCachesForTests,
  detectCorpusAnchorForProposal,
  loadProvisionalEntityRegister,
  normalizeEntityName,
} from './proposalEntityRegistry.js'
import { getProposalEntityPolicy } from './proposalEntityPolicies.js'
import {
  getSentenceBoundaryPronouns,
  getCommonNounSkips,
  getTitleTokens,
  getCosmologicalForceNames,
  getGenericSingleWordSkips,
  getTitleTokenAlternation,
} from './styleGuardsLoader.js'
import {
  getWarningRules,
  getActionEconomyPattern,
  getActionEconomyMessage,
  getStateChangePattern,
} from './validationRulesLoader.js'

interface GovernanceValidationResult {
  issues: string[]
}

interface RegistryIndex {
  aliases: AliasMap
  entities: EntityMap
}

let cachedIndex: RegistryIndex | null = null

function loadJson<T>(name: string): T | null {
  const path = `${INDEX_DIR}/${name}`
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf-8')) as T
}

function loadRegistryIndex(): RegistryIndex | null {
  if (cachedIndex) return cachedIndex
  const aliases = loadJson<AliasMap>('aliases.json')
  const entities = loadJson<EntityMap>('entities.json')
  if (!aliases || !entities) return null
  cachedIndex = { aliases, entities }
  return cachedIndex
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0))
  for (let i = 0; i <= a.length; i++) dp[i][0] = i
  for (let j = 0; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    }
  }
  return dp[a.length][b.length]
}

function allEntitiesOfType(index: RegistryIndex, type: string): Entity[] {
  return Object.values(index.entities).filter((entity) => entity.type === type)
}

function findEntityByAlias(index: RegistryIndex, text: string, type?: string): Entity | null {
  const key = normalizeEntityName(text)
  const ids = index.aliases[key] ?? []
  const entity = ids
    .map((id) => index.entities[id])
    .find((candidate) => candidate && (!type || candidate.type === type))
  return entity ?? null
}

function findClosestEntity(index: RegistryIndex, text: string, type: string): Entity | null {
  const key = normalizeEntityName(text)
  let best: { entity: Entity; distance: number } | null = null

  for (const entity of allEntitiesOfType(index, type)) {
    const names = [entity.title, entity.id.split('/').pop() ?? '', ...entity.aliases]
    for (const name of names) {
      const distance = levenshtein(key, normalizeEntityName(name))
      if (best === null || distance < best.distance) {
        best = { entity, distance }
      }
    }
  }

  if (!best) return null
  return best.distance <= 2 ? best.entity : null
}

function parseCorpusFrontmatter(body: string): Record<string, unknown> {
  const match = body.match(/##\s+Corpus\s+Frontmatter\s*\n```yaml\s*([\s\S]*?)```/i)
  if (!match) return {}
  try {
    return matter(`---\n${match[1].trim()}\n---`).data as Record<string, unknown>
  } catch {
    return {}
  }
}

function extractNpcCandidates(section: string): string[] {
  const names: string[] = []
  for (const line of section.split('\n')) {
    const trimmed = line.trim()
    const bold = trimmed.match(/^[*-]\s+\*\*([^:*]+?)(?:\.|:)\*\*/)
    if (bold?.[1]) names.push(bold[1].trim())
    const plain = trimmed.match(/^[*-]\s+([A-Z][A-Za-z''.-]+(?:\s+[A-Z][A-Za-z''.-]+){0,3})\s*:/)
    if (plain?.[1]) names.push(plain[1].trim())
  }
  return [...new Set(names)].filter((name) => !/^provisional\b/i.test(name))
}

// Word lists loaded from corpus/registry/style-guards.yaml
const SENTENCE_BOUNDARY_PRONOUNS = getSentenceBoundaryPronouns()
const COMMON_NOUN_SKIPS = getCommonNounSkips()
const TITLE_TOKENS = getTitleTokens()
const COSMOLOGICAL_FORCE_NAMES = getCosmologicalForceNames()

function extractNamedIndividuals(section: string): string[] {
  const names = new Set<string>(extractNpcCandidates(section))
  const genericSingleWordSkips = getGenericSingleWordSkips()
  const titleAlt = getTitleTokenAlternation()
  const titleCompoundPattern = new RegExp(`\\b(${titleAlt})\\s+([A-Z][\\p{L}''-]+(?:\\s+[A-Z][\\p{L}''-]+){0,2})\\b`, 'gu')
  for (const match of section.matchAll(titleCompoundPattern)) {
    const candidate = `${match[1]} ${match[2]}`.trim()
    names.add(candidate)
  }

  const roleSignalPattern = /\b([A-Z][\p{L}''-]+(?:\s+[A-Z][\p{L}''-]+){0,2})\b(?=\s+(?:is|was|serves?|works?|commands?|leads?|wants?|fears?|guards?|acts as|serves as|private enforcer|garrison captain|captain|jarl|warden|handler|first mate)\b)/gu
  for (const match of section.matchAll(roleSignalPattern)) {
    const candidate = match[1].trim()
    if (genericSingleWordSkips.has(candidate)) continue
    if (TITLE_TOKENS.has(candidate)) continue
    // Filter capitalised pronouns — they appear at sentence boundaries, never as proper nouns
    if (SENTENCE_BOUNDARY_PRONOUNS.has(candidate)) continue
    // Filter common nouns that appear capitalised in fantasy prose but are never proper names
    if (COMMON_NOUN_SKIPS.has(candidate)) continue
    // Skip words that are hyphenated suffixes (e.g. "Sharr" from "al-Sharr") - not standalone names
    const matchStart = match.index ?? 0
    if (matchStart > 0 && section[matchStart - 1] === '-') continue
    names.add(candidate)
  }
  return [...names].map((candidate) => candidate.replace(/[,:;.!?]+$/g, '').replace(/[''’]s$/u, '').trim()).filter(Boolean)
}

function extractSection(body: string, heading: string): string {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`##\\s+${escaped}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`, 'i')
  return body.match(regex)?.[1]?.trim() ?? ''
}

function extractHeadingNames(body: string): string[] {
  return [...body.matchAll(/^##\s+(.+?)\s*$/gm)].map((match) => match[1].trim())
}

function canonicalNpcConflictMessage(candidate: string, canonicalNpc: Entity): string {
  // Surface the canonical entity's own ID, not a passage that happens to mention the name
  return `FAIL: Character conflict: "${candidate}" resolves to corpus entity ${canonicalNpc.id} (${canonicalNpc.title}) — verify this is the same individual or rename.`
}

/**
 * Resolve a name to its own canonical entity, not to any document that mentions the name.
 * Mathr → npcs/jarl-mathr; Truthspeaker file mentioning Mathr should not count.
 */
function resolveToOwnEntity(index: RegistryIndex, name: string, type: string): Entity | null {
  const key = normalizeEntityName(name)
  const ids = index.aliases[key] ?? []
  const candidates = ids
    .map((id) => index.entities[id])
    .filter((candidate): candidate is Entity => Boolean(candidate) && (!type || candidate.type === type))

  if (candidates.length === 0) return null

  const score = (candidate: Entity): number => {
    const title = normalizeEntityName(candidate.title)
    const slug = normalizeEntityName(candidate.id.split('/').pop() ?? '')
    const aliases = candidate.aliases.map((alias) => normalizeEntityName(alias.replace(/^[^/]+\//, '')))
    if (title === key || slug === key || aliases.includes(key)) return 100
    if (title.endsWith(` ${key}`) || slug.endsWith(` ${key}`)) return 75
    if (title.includes(` ${key} `) || slug.includes(` ${key} `)) return 50
    return 0
  }

  return candidates
    .map((candidate) => ({ candidate, score: score(candidate) }))
    .sort((a, b) => b.score - a.score)[0]?.candidate ?? null
}

/**
 * Returns true if the candidate name is a suffix word of any allowlisted entity's
 * title or slug — covers partial names like "Dugweb" matching "King Dugweb".
 */
function candidateMatchesAllowlistedEntity(
  index: RegistryIndex,
  candidate: string,
  allowedCanonicalReferences: Set<string>,
): boolean {
  const candidateNorm = normalizeEntityName(candidate)
  // Also try stripping a leading title token to handle "Jarl Mathr" → "Mathr"
  const titleStripped = candidateNorm.replace(/^(king|jarl|lord|lady|captain|archivist|elder|housecarl|skald|truthspeaker)\s+/, '')

  for (const entityId of allowedCanonicalReferences) {
    const entity = index.entities[entityId]
    if (!entity) continue
    const names = [entity.title, entity.id.split('/').pop() ?? '', ...entity.aliases]
    for (const name of names) {
      const norm = normalizeEntityName(name)
      const words = norm.split(/\s+/)
      const lastWord = words[words.length - 1]
      if (lastWord === candidateNorm || lastWord === titleStripped) return true
      if (norm === candidateNorm || norm === titleStripped) return true
    }
  }
  return false
}

function validateNamedNpcBoundary(
  index: RegistryIndex,
  frontmatter: Record<string, unknown>,
  body: string,
  proposalType: ProposalType,
  issues: string[],
  proposalTitle?: string,
): void {
  const sectionNames =
    proposalType === 'place'
      ? ['Overview', 'Geography and Layout', 'Key Districts', 'Notable Landmarks', 'Factions and Power Structures', 'Key NPCs', 'Rumours', 'DM Notes', 'player_safe', 'dm_only']
      : proposalType === 'encounter'
        ? ['Cast', 'Campaign Purpose', 'Complication', 'Consequence', 'dm_only']
        : proposalType === 'npc'
          ? ['Role', 'What They Hide', 'can_know', 'must_not_know', 'Dramatic Utility', 'player_safe', 'dm_only']
          : []

  if (sectionNames.length === 0) return
  const normalizedProposalTitle = proposalTitle ? normalizeEntityName(proposalTitle) : null
  const anchorEntityId = String(frontmatter.corpus_anchor_entity ?? '').trim()
  const anchorEntity = anchorEntityId ? index.entities[anchorEntityId] : null
  // Build allowlist from all related entity IDs in the canonical file.
  // related values are bare slugs (e.g. "jarl-mathr"), but entity IDs are prefixed ("npcs/jarl-mathr").
  // Prefix each slug with its related-block key to match the entity ID format.
  const allowedCanonicalReferences = new Set<string>([
    ...(anchorEntity ? [anchorEntity.id] : []),
    ...Object.entries(anchorEntity?.related ?? {}).flatMap(([type, slugs]) =>
      (slugs as string[]).map((slug) => `${type}/${slug}`)
    ),
  ])
  const proposalTitleLastToken =
    proposalTitle && /\b(?:King|Jarl|Lord|Lady|Captain|Archivist|Elder|Housecarl|Skald|Truthspeaker)\b/i.test(proposalTitle)
      ? normalizeEntityName(proposalTitle.split(/\s+/).slice(-1)[0] ?? '')
      : null

  for (const sectionName of sectionNames) {
    const section = extractSection(body, sectionName)
    if (!section) continue
    for (const candidate of extractNamedIndividuals(section)) {
      if (/^(the|an|a)\s+/i.test(candidate)) continue
      if (normalizedProposalTitle && normalizeEntityName(candidate) === normalizedProposalTitle) continue
      if (proposalTitleLastToken && normalizeEntityName(candidate) === proposalTitleLastToken) continue
      // Skip standalone capitalised pronouns (sentence boundary false positives)
      if (SENTENCE_BOUNDARY_PRONOUNS.has(candidate)) continue
      // Skip common nouns that appear capitalised in fantasy prose but are never proper names
      if (COMMON_NOUN_SKIPS.has(candidate)) continue
      // Skip cosmological forces — they are not individual NPCs
      if (COSMOLOGICAL_FORCE_NAMES.has(candidate)) continue
      // Resolve against the entity's own canonical file ID — not any document that mentions the name
      const canonicalNpc = resolveToOwnEntity(index, candidate, 'npc')
      // Check partial name match against allowlisted entities first.
      // This handles: (a) resolved-to-wrong-entity via tag alias (e.g. "Mathr" → Truthspeaker when
      // Jarl Mathr is in related.npcs), and (b) unresolved partial names (e.g. "Dugweb" → King Dugweb).
      if (candidateMatchesAllowlistedEntity(index, candidate, allowedCanonicalReferences)) continue
      if (canonicalNpc) {
        if (allowedCanonicalReferences.has(canonicalNpc.id)) continue
        issues.push(canonicalNpcConflictMessage(candidate, canonicalNpc))
        continue
      }
      const closest = findClosestEntity(index, candidate, 'npc')
      if (closest) {
        issues.push(canonicalNpcConflictMessage(candidate, closest))
      } else {
        // If the name appears in the alias map under any type, it is a known corpus name
        // referenced by partial form — downgrade to WARN rather than FAIL.
        const anyAlias = (index.aliases[normalizeEntityName(candidate)] ?? []).length > 0
        if (anyAlias) {
          issues.push(`WARN: Named NPC boundary: "${candidate}" appears in the corpus index but does not resolve to a canonical NPC — verify this is intentional.`)
        } else {
          issues.push(`FAIL: Named NPC boundary: "${candidate}" is not in the NPC registry. Use a separate NPC proposal path or mark it provisional.`)
        }
      }
    }
  }
}

function validateRegistryReferences(index: RegistryIndex, frontmatter: Record<string, unknown>, body: string, issues: string[]): void {
  const corpusFrontmatter = parseCorpusFrontmatter(body)
  const relatedFactions = [
    ...(((frontmatter.related as any)?.factions as string[] | undefined) ?? []),
    ...((((corpusFrontmatter.related as any)?.factions as string[] | undefined) ?? [])),
  ]
  const relatedPlaces = [
    ...(((frontmatter.related as any)?.places as string[] | undefined) ?? []),
    ...((((corpusFrontmatter.related as any)?.places as string[] | undefined) ?? [])),
  ]
  const relatedNpcs = [
    ...(((frontmatter.related as any)?.npcs as string[] | undefined) ?? []),
    ...((((corpusFrontmatter.related as any)?.npcs as string[] | undefined) ?? [])),
  ]
  const relatedItems = [
    ...(((frontmatter.related as any)?.items as string[] | undefined) ?? []),
    ...((((corpusFrontmatter.related as any)?.items as string[] | undefined) ?? [])),
  ]
  const relatedEvents = [
    ...(((frontmatter.related as any)?.events as string[] | undefined) ?? []),
    ...((((corpusFrontmatter.related as any)?.events as string[] | undefined) ?? [])),
  ]

  for (const faction of relatedFactions) {
    if (findEntityByAlias(index, faction, 'faction')) continue
    const closest = findClosestEntity(index, faction, 'faction')
    if (closest) {
      issues.push(`FAIL: Faction registry mismatch: "${faction}" is not canonical. Did you mean "${closest.title}"?`)
    } else {
      issues.push(`FAIL: Faction registry mismatch: "${faction}" is not present in the faction registry.`)
    }
  }

  for (const place of relatedPlaces) {
    if (findEntityByAlias(index, place, 'place')) continue
    const closest = findClosestEntity(index, place, 'place')
    if (closest) {
      issues.push(`FAIL: Place registry mismatch: "${place}" is not canonical. Did you mean "${closest.title}"?`)
    } else {
      issues.push(`FAIL: Place registry mismatch: "${place}" is not present in the place registry.`)
    }
  }

  for (const npc of relatedNpcs) {
    if (findEntityByAlias(index, npc, 'npc')) continue
    const closest = findClosestEntity(index, npc, 'npc')
    if (closest) {
      issues.push(`FAIL: NPC registry mismatch: "${npc}" is not canonical. Did you mean "${closest.title}"?`)
    } else {
      issues.push(`FAIL: NPC registry mismatch: "${npc}" is not present in the NPC registry.`)
    }
  }

  for (const item of relatedItems) {
    if (findEntityByAlias(index, item, 'item')) continue
    const closest = findClosestEntity(index, item, 'item')
    if (closest) {
      issues.push(`FAIL: Item registry mismatch: "${item}" is not canonical. Did you mean "${closest.title}"?`)
    } else {
      issues.push(`FAIL: Item registry mismatch: "${item}" is not present in the item registry.`)
    }
  }

  for (const event of relatedEvents) {
    if (findEntityByAlias(index, event, 'event')) continue
    const closest = findClosestEntity(index, event, 'event')
    if (closest) {
      issues.push(`FAIL: Event registry mismatch: "${event}" is not canonical. Did you mean "${closest.title}"?`)
    } else {
      issues.push(`FAIL: Event registry mismatch: "${event}" is not present in the event registry.`)
    }
  }
}

function validateCanonicalItemStateChanges(index: RegistryIndex, body: string, issues: string[]): void {
  const stateChangePattern = getStateChangePattern()
  if (!stateChangePattern || !stateChangePattern.test(body)) return

  const items = allEntitiesOfType(index, 'item')
  for (const item of items) {
    const names = [item.title, ...item.aliases]
    if (names.some((name) => name && new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(body))) {
      issues.push(`FAIL: Canonical item state change: proposal implies a new state for "${item.title}" without corpus-established support.`)
      return
    }
  }
}

function validateWarningPatterns(body: string, frontmatter: Record<string, unknown>, issues: string[]): void {
  const proposalType = (frontmatter.proposal_type as ProposalType) ?? 'encounter'
  const sourcePrompt = String(frontmatter.source_prompt ?? '')
  const anchor = detectCorpusAnchorForProposal(proposalType, sourcePrompt)
  const policy = getProposalEntityPolicy(String(frontmatter.corpus_anchor_entity ?? anchor.entity?.id ?? '').trim())
  if (anchor.corpusNamed && frontmatter.corpus_named !== true) {
    issues.push(`WARN: Corpus-named entity without corpus-anchor instruction: "${anchor.entity?.title ?? anchor.subjectName}" exists in corpus and should be generated with corpus-anchor constraints.`)
  }
  if (policy && String(frontmatter.corpus_policy_id ?? '') !== policy.entityId) {
    issues.push(`WARN: Corpus policy metadata missing or mismatched: expected policy "${policy.entityId}" for this canonical entity.`)
  }
  if (frontmatter.visibility === 'dm-only' && !['npc', 'place', 'adversary'].includes(proposalType) && /##\s+player_safe\b/i.test(body)) {
    issues.push('WARN: visibility/content mismatch: dm-only proposal contains a player_safe section and should be reviewed before promotion.')
  }

  for (const rule of getWarningRules()) {
    if (!rule.regex.test(body)) continue
    if (rule.secondaryRegex && !rule.secondaryRegex.test(body)) continue
    issues.push(`${rule.severity === 'fail' ? 'FAIL' : 'WARN'}: ${rule.message}`)
  }

  const inventedCount = (body.match(/\bProvisional:/g) ?? []).length
  if (inventedCount > 4) {
    issues.push('WARN: Invention volume threshold exceeded: proposal introduces many provisional details and needs human review.')
  }

  if (frontmatter.corpus_stub_level === true && /##\s+Key Districts\b|##\s+Notable Landmarks\b|##\s+Factions(?:\s+and\s+Power Structures)?\b/i.test(body)) {
    issues.push('WARN: Stub-level place overreach: corpus treatment is stub level, but the proposal adds full district, landmark, or faction structure.')
  }

  if (policy) {
    const headingNames = extractHeadingNames(body)
    const normalizedAllowed = new Set(policy.allowedSections.map((section) => normalizeEntityName(section)))
    const normalizedForbidden = new Set(policy.forbiddenSections.map((section) => normalizeEntityName(section)))
    const metadataSections = new Set(['corpus frontmatter', 'promotion details', 'validation notes'])

    for (const heading of headingNames) {
      const normalizedHeading = normalizeEntityName(heading)
      if (metadataSections.has(normalizedHeading)) continue
      if (normalizedForbidden.has(normalizedHeading)) {
        issues.push(`FAIL: Corpus scope violation: section "${heading}" is outside the allowed scope for ${policy.entityId}.`)
      } else if (
        policy.coverageLevel === 'stub' &&
        normalizedAllowed.size > 0 &&
        !normalizedAllowed.has(normalizedHeading)
      ) {
        issues.push(`FAIL: Stub-level scope violation: section "${heading}" exceeds the supported scope for ${policy.entityId}.`)
      }
    }

    if (policy.requireAmbiguitySection && !headingNames.some((heading) => normalizeEntityName(heading) === 'ambiguities')) {
      issues.push(`WARN: Ambiguity flag missing: ${policy.entityId} should preserve unresolved canon in an "Ambiguities" section or validation note.`)
    }

    for (const rule of policy.forbiddenPatterns) {
      const regex = new RegExp(rule.pattern, 'i')
      if (!regex.test(body)) continue
      issues.push(`${rule.severity === 'fail' ? 'FAIL' : 'WARN'}: ${rule.message}`)
    }
  }

  const languagesLine = body.match(/(?:\*\*Languages\*\*|Languages)\s*([^\n]+)/i)?.[1]
  if (languagesLine) {
    const canonicalLanguages = new Set(getCanonicalLanguages().map((entry) => normalizeEntityName(entry)))
    const lowerBody = body.toLowerCase()
    const additionalAllowed = new Set<string>()
    if (lowerBody.includes('shadow walker')) additionalAllowed.add(normalizeEntityName('Shadow Walker Sign'))
    for (const language of languagesLine.split(/[,·]/).map((entry) => entry.trim()).filter(Boolean)) {
      const normalized = normalizeEntityName(language)
      if (!normalized || normalized === 'none') continue
      if (!canonicalLanguages.has(normalized) && !additionalAllowed.has(normalized)) {
        issues.push(`WARN: Language not in whitelist: "${language}" is not in the canonical language set.`)
      }
    }
  }

  const actionEconomyPattern = getActionEconomyPattern()
  if (actionEconomyPattern) {
    const actionEconomyMatch = body.match(actionEconomyPattern)
    if (actionEconomyMatch) {
      const actionName = (actionEconomyMatch[1] ?? actionEconomyMatch[2] ?? 'Unnamed action').trim()
      issues.push(`WARN: Action economy warning: ${actionName} ${getActionEconomyMessage()}`)
    }
  }
}

function validateFactionProposal(factionSlug: string, body: string, issues: string[]): void {
  const factionProfile = getFactionProfile(factionSlug)
  if (!factionProfile || factionProfile.validationRules.length === 0) return

  for (const rule of factionProfile.validationRules) {
    const regex = new RegExp(rule.pattern, 'i')
    if (!regex.test(body)) continue
    if (rule.secondaryPattern && !new RegExp(rule.secondaryPattern, 'i').test(body)) continue
    issues.push(`${rule.severity === 'fail' ? 'FAIL' : 'WARN'}: ${rule.message}`)
  }
}

export function validateProposalGovernance(
  frontmatter: Record<string, unknown>,
  body: string,
  proposalType: ProposalType,
): GovernanceValidationResult {
  const issues: string[] = []
  const index = loadRegistryIndex()
  if (!index) return { issues }

  validateRegistryReferences(index, frontmatter, body, issues)
  validateNamedNpcBoundary(index, frontmatter, body, proposalType, issues, String(frontmatter.title ?? ''))
  validateCanonicalItemStateChanges(index, body, issues)
  validateWarningPatterns(body, frontmatter, issues)
  for (const provisional of loadProvisionalEntityRegister()) {
    if (normalizeEntityName(String(frontmatter.title ?? '')) === provisional.normalizedName) continue
    if ((body.includes(provisional.name) || String(frontmatter.summary ?? '').includes(provisional.name)) && !findEntityByAlias(index, provisional.name)) {
      issues.push(`WARN: Provisional entity reference: "${provisional.name}" exists only in unpromoted proposals — cannot be treated as canonical.`)
    }
  }
  if (proposalType === 'adversary') {
    for (const profile of getAllFactionProfiles()) {
      if (!profile.detection) continue
      if (!new RegExp(profile.detection.mentionPattern, 'i').test(body)) continue
      validateFactionProposal(profile.slug, body, issues)
    }
  }

  return { issues }
}

export function clearProposalGovernanceCachesForTests(): void {
  cachedIndex = null
  clearProposalEntityRegistryCachesForTests()
}
