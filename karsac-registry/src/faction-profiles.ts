import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import matter from 'gray-matter'
import { REGISTRY_ROOT } from './paths.js'

export interface FactionProfileOverrideConfig {
  allowSpellcasting?: boolean
  allowNonstandardLanguage?: boolean
  allowAlignmentDeviation?: boolean
  allowObviousWeapon?: boolean
  reason?: string
}

export interface PreferredFactionWeapon {
  name: string
  type: 'ranged' | 'melee'
  range?: string
  reach?: string
  damageDie: string
  ability: 'dex' | 'str'
  rider?: string
}

export interface FactionProfile {
  slug: string
  displayName: string
  aliases: string[]
  defaultAlignment: string | null
  allowedAlignments: string[]
  languageWhitelist: string[]
  bannedLanguages: string[]
  spellcasting: {
    default: 'prohibited' | 'allowed'
    allowWithExplicitOverride: boolean
  }
  preferredWeapons: string[]
  doctrineTags: string[]
  preferredConcealableWeapons: PreferredFactionWeapon[]
  discouragedWeaponsForCoverIdentity: string[]
  abilityFloors: Record<string, Record<string, number>>
  requiredDoctrineThemes: string[]
  styleNotes: string[]
}

interface FactionRegistryData {
  canonicalLanguages: string[]
  profiles: Record<string, FactionProfile>
}

let cachedRegistry: FactionRegistryData | null = null

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((entry) => String(entry).trim()).filter(Boolean)
}

function toLowercaseKeyedMap(value: unknown): Record<string, Record<string, number>> {
  if (!value || typeof value !== 'object') return {}
  const result: Record<string, Record<string, number>> = {}
  for (const [roleKey, roleValue] of Object.entries(value as Record<string, unknown>)) {
    if (!roleValue || typeof roleValue !== 'object') continue
    const normalizedRole = roleKey.trim().toLowerCase()
    result[normalizedRole] = {}
    for (const [abilityKey, abilityValue] of Object.entries(roleValue as Record<string, unknown>)) {
      const parsed = Number(abilityValue)
      if (!Number.isFinite(parsed)) continue
      result[normalizedRole][abilityKey.trim().toLowerCase()] = parsed
    }
  }
  return result
}

function normalizePreferredWeapons(value: unknown): PreferredFactionWeapon[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
    .map((entry) => {
      const typeRaw = String(entry.type ?? 'melee').trim().toLowerCase()
      return {
        name: String(entry.name ?? '').trim(),
        type: typeRaw === 'ranged' ? 'ranged' : 'melee',
        range: entry.range ? String(entry.range).trim() : undefined,
        reach: entry.reach ? String(entry.reach).trim() : undefined,
        damageDie: String(entry.damage_die ?? entry.damageDie ?? '1d4').trim(),
        ability: String(entry.ability ?? 'dex').trim().toLowerCase() === 'str' ? 'str' : 'dex',
        rider: entry.rider ? String(entry.rider).trim() : undefined,
      }
    })
    .filter((entry) => entry.name.length > 0)
}

function normalizeProfile(raw: Record<string, unknown>): FactionProfile | null {
  const slug = String(raw.slug ?? '').trim().toLowerCase()
  if (!slug) return null

  const spellcastingRaw = (raw.spellcasting ?? {}) as Record<string, unknown>

  return {
    slug,
    displayName: String(raw.display_name ?? raw.displayName ?? slug).trim(),
    aliases: toStringArray(raw.aliases),
    defaultAlignment: raw.default_alignment ? String(raw.default_alignment).trim().toLowerCase() : null,
    allowedAlignments: toStringArray(raw.allowed_alignments).map((entry) => entry.toLowerCase()),
    languageWhitelist: toStringArray(raw.language_whitelist),
    bannedLanguages: toStringArray(raw.banned_languages),
    spellcasting: {
      default: String(spellcastingRaw.default ?? 'allowed').trim().toLowerCase() === 'prohibited'
        ? 'prohibited'
        : 'allowed',
      allowWithExplicitOverride: Boolean(spellcastingRaw.allow_with_explicit_override),
    },
    preferredWeapons: toStringArray(raw.preferred_weapons),
    doctrineTags: toStringArray(raw.doctrine_tags).map((entry) => entry.toLowerCase()),
    preferredConcealableWeapons: normalizePreferredWeapons(raw.preferred_concealable_weapons),
    discouragedWeaponsForCoverIdentity: toStringArray(raw.discouraged_weapons_for_cover_identity),
    abilityFloors: toLowercaseKeyedMap(raw.ability_floors ?? raw.ability_score_floors),
    requiredDoctrineThemes: toStringArray(raw.required_doctrine_themes),
    styleNotes: toStringArray(raw.style_notes),
  }
}

function parseRegistryFile(): FactionRegistryData {
  const registryPath = resolve(REGISTRY_ROOT, 'factions.yaml')
  if (!existsSync(registryPath)) {
    return { canonicalLanguages: [], profiles: {} }
  }

  const raw = readFileSync(registryPath, 'utf-8')
  const parsed = matter(`---\n${raw}\n---`).data as Record<string, unknown>
  const canonicalLanguages = toStringArray(parsed.canonical_languages)
  const profiles: Record<string, FactionProfile> = {}

  for (const entry of Array.isArray(parsed.factions) ? parsed.factions : []) {
    if (!entry || typeof entry !== 'object') continue
    const profile = normalizeProfile(entry as Record<string, unknown>)
    if (!profile) continue
    profiles[profile.slug] = profile
  }

  return { canonicalLanguages, profiles }
}

export function loadFactionRegistry(): FactionRegistryData {
  cachedRegistry ??= parseRegistryFile()
  return cachedRegistry
}

export function getFactionProfile(slug: string | null | undefined): FactionProfile | undefined {
  if (!slug) return undefined
  return loadFactionRegistry().profiles[slug.trim().toLowerCase()]
}

export function getCanonicalLanguages(): string[] {
  return loadFactionRegistry().canonicalLanguages
}

export function clearFactionRegistryCacheForTests(): void {
  cachedRegistry = null
}
