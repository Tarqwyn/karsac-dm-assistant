import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import matter from 'gray-matter'
import { REGISTRY_ROOT } from './paths.js'

export interface FactionMechanicalOverrideRule {
  id: string
  description: string
  appliesWhen: {
    faction: string[]
    environmentContext: string[]
    doctrineTags: string[]
    roleTags: string[]
    base: string[]
    promptConstraints: string[]
  }
  conflicts: {
    weapons: string[]
    languages: string[]
    alignment: string[]
    spellcasting: string[]
    creatureType: string[]
    armour: string[]
    tactics: string[]
    traits: string[]
    actions: string[]
  }
  severity: 'repair' | 'fail' | 'warn'
  replacementStrategy: string | null
  override: {
    allowed: boolean
    requiresReason: boolean
  }
}

interface FactionMechanicalOverridesData {
  rules: FactionMechanicalOverrideRule[]
}

let cachedOverrides: FactionMechanicalOverridesData | null = null

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((entry) => String(entry).trim()).filter(Boolean)
}

function normalizeRule(raw: Record<string, unknown>): FactionMechanicalOverrideRule | null {
  const id = String(raw.id ?? '').trim()
  if (!id) return null
  const appliesWhen = (raw.applies_when ?? {}) as Record<string, unknown>
  const conflicts = (raw.conflicts ?? {}) as Record<string, unknown>
  const override = (raw.override ?? {}) as Record<string, unknown>
  const severityRaw = String(raw.severity ?? 'warn').trim().toLowerCase()

  return {
    id,
    description: String(raw.description ?? '').trim(),
    appliesWhen: {
      faction: toStringArray(appliesWhen.faction).map((entry) => entry.toLowerCase()),
      environmentContext: toStringArray(appliesWhen.environment_context).map((entry) => entry.toLowerCase()),
      doctrineTags: toStringArray(appliesWhen.doctrine_tags).map((entry) => entry.toLowerCase()),
      roleTags: toStringArray(appliesWhen.role_tags).map((entry) => entry.toLowerCase()),
      base: toStringArray(appliesWhen.base).map((entry) => entry.toLowerCase()),
      promptConstraints: toStringArray(appliesWhen.prompt_constraints).map((entry) => entry.toLowerCase()),
    },
    conflicts: {
      weapons: toStringArray(conflicts.weapons).map((entry) => entry.toLowerCase()),
      languages: toStringArray(conflicts.languages).map((entry) => entry.toLowerCase()),
      alignment: toStringArray(conflicts.alignment).map((entry) => entry.toLowerCase()),
      spellcasting: toStringArray(conflicts.spellcasting).map((entry) => entry.toLowerCase()),
      creatureType: toStringArray(conflicts.creature_type).map((entry) => entry.toLowerCase()),
      armour: toStringArray(conflicts.armour).map((entry) => entry.toLowerCase()),
      tactics: toStringArray(conflicts.tactics).map((entry) => entry.toLowerCase()),
      traits: toStringArray(conflicts.traits).map((entry) => entry.toLowerCase()),
      actions: toStringArray(conflicts.actions).map((entry) => entry.toLowerCase()),
    },
    severity: severityRaw === 'repair' || severityRaw === 'fail' ? severityRaw : 'warn',
    replacementStrategy: raw.replacement_strategy ? String(raw.replacement_strategy).trim() : null,
    override: {
      allowed: Boolean(override.allowed),
      requiresReason: Boolean(override.requires_reason),
    },
  }
}

function parseOverridesFile(): FactionMechanicalOverridesData {
  const path = resolve(REGISTRY_ROOT, 'faction-mechanical-overrides.yaml')
  if (!existsSync(path)) return { rules: [] }

  const raw = readFileSync(path, 'utf-8')
  const parsed = matter(`---\n${raw}\n---`).data as Record<string, unknown>
  const rules = (Array.isArray(parsed.faction_mechanical_overrides) ? parsed.faction_mechanical_overrides : [])
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
    .map((entry) => normalizeRule(entry))
    .filter((entry): entry is FactionMechanicalOverrideRule => entry !== null)

  return { rules }
}

export function loadFactionMechanicalOverrides(): FactionMechanicalOverridesData {
  cachedOverrides ??= parseOverridesFile()
  return cachedOverrides
}

export function getFactionMechanicalOverrides(): FactionMechanicalOverrideRule[] {
  return loadFactionMechanicalOverrides().rules
}

export function clearFactionMechanicalOverridesCacheForTests(): void {
  cachedOverrides = null
}
