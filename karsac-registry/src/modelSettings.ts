export interface GenerationSettings {
  temperature: number
  topP: number
}

function parseNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw || raw.trim() === '') return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

function envModel(...names: string[]): string | null {
  for (const name of names) {
    const value = process.env[name]
    if (value && value.trim() !== '') return value.trim()
  }
  return null
}

export function getDraftModel(): string {
  return envModel('KARSAC_DRAFT_MODEL', 'OLLAMA_MODEL') ?? 'gemma3:12b'
}

export function getCreativeModel(): string {
  return envModel(
    'KARSAC_TREATMENT_MODEL',
    'KARSAC_CREATIVE_MODEL',
    'KARSAC_DOCTRINE_MODEL',
    'KARSAC_DRAFT_MODEL',
    'OLLAMA_MODEL',
  ) ?? 'gemma3:12b'
}

export function getRulesModel(): string {
  return envModel('RULES_MODEL', 'KARSAC_DRAFT_MODEL', 'OLLAMA_MODEL') ?? 'gemma3:12b'
}

export function getSummaryModel(): string {
  return envModel('KARSAC_CREATIVE_MODEL', 'KARSAC_TREATMENT_MODEL', 'KARSAC_DRAFT_MODEL', 'OLLAMA_MODEL') ?? 'gemma3:12b'
}

export function getDraftGenerationSettings(): GenerationSettings {
  return {
    temperature: parseNumberEnv('KARSAC_DRAFT_TEMPERATURE', 0.5),
    topP: parseNumberEnv('KARSAC_DRAFT_TOP_P', 0.9),
  }
}

export function getCreativeGenerationSettings(): GenerationSettings {
  return {
    temperature: parseNumberEnv('KARSAC_CREATIVE_TEMPERATURE', 0.85),
    topP: parseNumberEnv('KARSAC_CREATIVE_TOP_P', 0.9),
  }
}

export function getCreativeRetryGenerationSettings(): GenerationSettings {
  return {
    temperature: parseNumberEnv('KARSAC_CREATIVE_RETRY_TEMPERATURE', 0.75),
    topP: parseNumberEnv('KARSAC_CREATIVE_RETRY_TOP_P', 0.85),
  }
}

export function getRulesGenerationSettings(): GenerationSettings {
  return {
    temperature: parseNumberEnv('KARSAC_RULES_TEMPERATURE', 0.2),
    topP: parseNumberEnv('KARSAC_RULES_TOP_P', 0.8),
  }
}

export function getSummaryGenerationSettings(): GenerationSettings {
  return {
    temperature: parseNumberEnv('KARSAC_SUMMARY_TEMPERATURE', 0.6),
    topP: parseNumberEnv('KARSAC_SUMMARY_TOP_P', 0.9),
  }
}

export function creativeTreatmentEnabled(): boolean {
  return /^true$/i.test(process.env.KARSAC_ENABLE_CREATIVE_TREATMENT ?? '')
}
