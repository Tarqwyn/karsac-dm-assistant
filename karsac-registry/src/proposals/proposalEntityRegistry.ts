import { existsSync, readdirSync, readFileSync } from 'fs'
import { resolve } from 'path'
import matter from 'gray-matter'
import { COLLECTIONS_ROOT, INDEX_DIR, PROPOSALS_ROOT } from '../paths.js'
import type { AliasMap, Entity, EntityMap } from '../types.js'
import type { ProposalType } from './proposalTypes.js'
import type { CorpusCoverageLevel, ProposalEntityPolicy } from './proposalEntityPolicies.js'
import { getProposalEntityPolicy, clearProposalEntityPolicyCachesForTests } from './proposalEntityPolicies.js'

export interface ProposalCorpusAnchor {
  corpusNamed: boolean
  proposalType: ProposalType
  subjectName: string | null
  entity: Entity | null
  stubLevel: boolean
  coverageLevel: CorpusCoverageLevel
  policy: ProposalEntityPolicy | null
  exactSnippets: string[]
}

export interface ProvisionalEntityEntry {
  name: string
  normalizedName: string
  type: ProposalType | 'faction' | 'npc' | 'place'
  sourceProposalPath: string
}

interface RegistryIndex {
  aliases: AliasMap
  entities: EntityMap
}

let cachedIndex: RegistryIndex | null = null
let cachedProvisionalRegister: ProvisionalEntityEntry[] | null = null

function loadJson<T>(name: string): T | null {
  const path = resolve(INDEX_DIR, name)
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf-8')) as T
}

export function normalizeEntityName(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function loadProposalEntityIndex(): RegistryIndex | null {
  if (cachedIndex) return cachedIndex
  const aliases = loadJson<AliasMap>('aliases.json')
  const entities = loadJson<EntityMap>('entities.json')
  if (!aliases || !entities) return null
  cachedIndex = { aliases, entities }
  return cachedIndex
}

function proposalTypesForSubject(proposalType: ProposalType): string[] {
  if (proposalType === 'npc') return ['npc']
  if (proposalType === 'place') return ['place']
  if (proposalType === 'adversary') return ['faction', 'npc', 'place']
  if (proposalType === 'item' || proposalType === 'handout' || proposalType === 'clue') return ['item', 'concept']
  return ['npc', 'place', 'faction']
}

function canonicalNameMatches(entity: Entity, phrase: string): boolean {
  const normalizedPhrase = normalizeEntityName(phrase)
  if (!normalizedPhrase) return false
  if (normalizeEntityName(entity.title) === normalizedPhrase) return true
  if (normalizeEntityName(entity.id.split('/').pop() ?? '') === normalizedPhrase) return true
  return entity.aliases
    .filter((alias) => alias.includes(' ') || alias.includes('/'))
    .some((alias) => normalizeEntityName(alias.replace(/^[^/]+\//, '')) === normalizedPhrase || normalizeEntityName(alias) === normalizedPhrase)
}

function resolveCollectionPath(entity: Entity): string | null {
  const relative = entity.path.replace(/^openwebui-runtime-collections\//, '')
  const path = resolve(COLLECTIONS_ROOT, relative)
  return existsSync(path) ? path : null
}

/**
 * For canonical NPCs, resolve the fuller major/minor NPC characterisation file.
 * Entity cards are index entries; NPC collection files hold authoritative detail.
 * e.g. npcs/jarl-beorn → karsac-major-npcs/jarl-beorn.md
 */
function resolveNpcDetailPath(entity: Entity): string | null {
  if (entity.type !== 'npc') return null
  const slug = entity.id.split('/').pop()
  if (!slug) return null
  for (const dir of ['karsac-major-npcs', 'karsac-minor-npcs']) {
    const candidate = resolve(COLLECTIONS_ROOT, dir, `${slug}.md`)
    if (existsSync(candidate)) return candidate
  }
  return null
}

function extractNonHeadingParagraphs(content: string): string[] {
  const body = content.replace(/^---[\s\S]*?---\s*/m, '')
  return body
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .filter((block) => !/^#/.test(block))
    .filter((block) => !/^\*\*Canon File ID:\*\*/i.test(block))
    .filter((block) => !/^\*\*Retrieval Summary:\*\*/i.test(block))
}

function snippetizeEntity(entity: Entity): { snippets: string[]; stubLevel: boolean } {
  const snippets = entity.summary ? [entity.summary] : []
  let headingCount = 0
  let bodyLength = entity.summary?.length ?? 0

  // For NPCs: load the full characterisation file (major/minor NPC dir) in addition to
  // the entity card. The NPC file holds the authoritative "not corrupted, deceived" detail
  // that the entity card summary omits. NPC file content takes precedence.
  const npcDetailPath = resolveNpcDetailPath(entity)
  const entityCardPath = resolveCollectionPath(entity)

  // Prefer NPC detail file for body extraction; fall back to entity card
  const primaryPath = npcDetailPath ?? entityCardPath
  const secondaryPath = npcDetailPath ? entityCardPath : null

  if (primaryPath) {
    const raw = readFileSync(primaryPath, 'utf-8')
    const body = raw.replace(/^---[\s\S]*?---\s*/m, '')
    headingCount = (body.match(/^##\s+/gm) ?? []).length
    bodyLength = body.length
    for (const block of extractNonHeadingParagraphs(raw)) {
      if (snippets.length >= 4) break
      const cleaned = block.replace(/^>\s*/gm, '').replace(/\s+/g, ' ').trim()
      if (!cleaned) continue
      if (!snippets.includes(cleaned)) snippets.push(cleaned)
    }
  }

  // Pull additional snippets from entity card if not already covered
  if (secondaryPath && snippets.length < 3) {
    for (const block of extractNonHeadingParagraphs(readFileSync(secondaryPath, 'utf-8'))) {
      if (snippets.length >= 5) break
      const cleaned = block.replace(/^>\s*/gm, '').replace(/\s+/g, ' ').trim()
      if (!cleaned || snippets.includes(cleaned)) continue
      snippets.push(cleaned)
    }
  }

  const stubLevel = headingCount <= 2 || bodyLength < 1600
  return { snippets: snippets.slice(0, 4), stubLevel }
}

export function extractProposalSubjectName(proposalType: ProposalType, prompt: string): string | null {
  const explicitMatch = prompt.match(/^\s*(?:please\s+)?propose\s+(?:a|an)\s+new\s+[a-z-]+:\s*(.+)$/i)
  const raw = explicitMatch?.[1]?.trim() ?? prompt.trim()
  if (!raw) return null
  const stripped = raw.replace(/^(?:a|an|the)\s+/i, '')
  const parts = stripped.split(/(?:,|\.|\bwho\b|\bthat\b|\bwhich\b|\bdesigned\b|\bstationed\b|\blocated\b|\busing\b|\bwith\b)/i)
  const candidate = parts[0]?.trim() ?? ''
  return candidate.length > 0 ? candidate : null
}

export function detectCorpusAnchorForProposal(proposalType: ProposalType, prompt: string): ProposalCorpusAnchor {
  const index = loadProposalEntityIndex()
  const subjectName = extractProposalSubjectName(proposalType, prompt)
  if (!index || !subjectName) {
    return {
      corpusNamed: false,
      proposalType,
      subjectName,
      entity: null,
      stubLevel: false,
      coverageLevel: 'full',
      policy: null,
      exactSnippets: [],
    }
  }

  const rawTokens = subjectName.split(/\s+/).filter(Boolean)
  const candidateTypes = new Set(proposalTypesForSubject(proposalType))

  for (let n = Math.min(6, rawTokens.length); n >= 1; n--) {
    const phrase = rawTokens.slice(0, n).join(' ').replace(/[,:;.!?]+$/g, '')
    const key = normalizeEntityName(phrase)
    const ids = index.aliases[key] ?? []
    const entity = ids
      .map((id) => index.entities[id])
      .find((candidate) => candidate && candidateTypes.has(candidate.type) && canonicalNameMatches(candidate, phrase))
    if (!entity) continue
    const { snippets, stubLevel } = snippetizeEntity(entity)
    const policy = getProposalEntityPolicy(entity.id)
    const coverageLevel = policy?.coverageLevel ?? (stubLevel ? 'stub' : 'full')
    return {
      corpusNamed: true,
      proposalType,
      subjectName: phrase,
      entity,
      stubLevel: coverageLevel === 'stub' || stubLevel,
      coverageLevel,
      policy,
      exactSnippets: snippets,
    }
  }

  return {
    corpusNamed: false,
    proposalType,
    subjectName,
    entity: null,
    stubLevel: false,
    coverageLevel: 'full',
    policy: null,
    exactSnippets: [],
  }
}

function extractNamedBullets(section: string): string[] {
  return section
    .split('\n')
    .map((line) => line.trim())
    .map((line) => line.match(/^[*-]\s+\*\*([^:*]+?)(?:\.|:)\*\*/)?.[1] ?? line.match(/^[*-]\s+([^:]+):/)?.[1] ?? '')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^provisional\b/i.test(line))
}

function extractSection(body: string, heading: string): string {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return body.match(new RegExp(`##\\s+${escaped}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`, 'i'))?.[1]?.trim() ?? ''
}

function scanProposalFiles(root: string): string[] {
  if (!existsSync(root)) return []
  const out: string[] = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    // Skip _rejected/ — failed proposals must not propagate invented entities
    if (entry.isDirectory() && entry.name === '_rejected') continue
    const full = resolve(root, entry.name)
    if (entry.isDirectory()) out.push(...scanProposalFiles(full))
    else if (entry.isFile() && entry.name.endsWith('.proposed.md')) out.push(full)
  }
  return out
}

export function loadProvisionalEntityRegister(root: string = PROPOSALS_ROOT): ProvisionalEntityEntry[] {
  if (root === PROPOSALS_ROOT && cachedProvisionalRegister) return cachedProvisionalRegister
  const index = loadProposalEntityIndex()
  const canonicalNames = new Set(
    index ? Object.values(index.entities).flatMap((entity) => [entity.title, ...entity.aliases].map(normalizeEntityName)) : [],
  )
  const entries: ProvisionalEntityEntry[] = []

  for (const path of scanProposalFiles(root)) {
    let parsed
    try {
      parsed = matter(readFileSync(path, 'utf-8'))
    } catch {
      continue
    }
    const frontmatter = parsed.data as Record<string, unknown>
    const title = String(frontmatter.title ?? '').trim()
    const proposalType = String(frontmatter.proposal_type ?? '').trim() as ProposalType
    if (title && !canonicalNames.has(normalizeEntityName(title))) {
      entries.push({
        name: title,
        normalizedName: normalizeEntityName(title),
        type: proposalType || 'npc',
        sourceProposalPath: path,
      })
    }

    for (const name of extractNamedBullets(extractSection(parsed.content, 'Key NPCs'))) {
      if (canonicalNames.has(normalizeEntityName(name))) continue
      entries.push({ name, normalizedName: normalizeEntityName(name), type: 'npc', sourceProposalPath: path })
    }
    const factionSection =
      extractSection(parsed.content, 'Factions and Power Structures') ||
      extractSection(parsed.content, 'Factions')
    for (const name of extractNamedBullets(factionSection)) {
      if (canonicalNames.has(normalizeEntityName(name))) continue
      entries.push({ name, normalizedName: normalizeEntityName(name), type: 'faction', sourceProposalPath: path })
    }
  }

  const deduped = entries.filter((entry, indexPos, all) =>
    all.findIndex((candidate) => candidate.normalizedName === entry.normalizedName && candidate.type === entry.type) === indexPos,
  )

  if (root === PROPOSALS_ROOT) cachedProvisionalRegister = deduped
  return deduped
}

export function clearProposalEntityRegistryCachesForTests(): void {
  cachedIndex = null
  cachedProvisionalRegister = null
  clearProposalEntityPolicyCachesForTests()
}
