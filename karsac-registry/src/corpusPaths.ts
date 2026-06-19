import { existsSync } from 'fs'
import { resolve } from 'path'
import type { AliasMap, Entity, EntityMap } from './types.js'

export type CorpusSource = 'collections' | 'planning'
export type CorpusReadMode = 'live' | 'planning'

export const CORPUS_RUNTIME_PREFIXES: Record<CorpusSource, string> = {
  collections: 'openwebui-runtime-collections/',
  planning: 'openwebui-runtime-planning/',
}

export function corpusRuntimePrefix(source: CorpusSource): string {
  return CORPUS_RUNTIME_PREFIXES[source]
}

export function stripCorpusRuntimePrefix(path: string): { source: CorpusSource | null; relativePath: string } {
  for (const [source, prefix] of Object.entries(CORPUS_RUNTIME_PREFIXES) as Array<[CorpusSource, string]>) {
    if (path.startsWith(prefix)) {
      return { source, relativePath: path.slice(prefix.length) }
    }
  }

  return { source: null, relativePath: path }
}

export function parseCorpusSourceFromAbsolutePath(
  absolutePath: string,
  collectionsRoot: string,
  planningRoot?: string,
): CorpusSource | null {
  if (absolutePath.startsWith(collectionsRoot + '/')) return 'collections'
  if (planningRoot && absolutePath.startsWith(planningRoot + '/')) return 'planning'
  return null
}

export function runtimePathForAbsolutePath(
  absolutePath: string,
  collectionsRoot: string,
  planningRoot?: string,
): string {
  const source = parseCorpusSourceFromAbsolutePath(absolutePath, collectionsRoot, planningRoot)
  if (source === 'collections') {
    return `${corpusRuntimePrefix(source)}${absolutePath.slice(collectionsRoot.length + 1)}`
  }
  if (source === 'planning' && planningRoot) {
    return `${corpusRuntimePrefix(source)}${absolutePath.slice(planningRoot.length + 1)}`
  }
  return absolutePath
}

export function resolveCorpusRuntimePath(
  runtimePath: string,
  roots: Partial<Record<CorpusSource, string>>,
): string {
  const parsed = stripCorpusRuntimePrefix(runtimePath)
  if (parsed.source) {
    const root = roots[parsed.source]
    return root ? resolve(root, parsed.relativePath) : resolve(parsed.relativePath)
  }
  return runtimePath
}

export function canonicalIsVisibleInLiveMode(entity: Pick<Entity, 'canonical'>, source: CorpusSource | null): boolean {
  const canonical = entity.canonical?.trim().toLowerCase()
  if (canonical && canonical !== 'provisional') return true
  if (source === 'planning') return false
  return true
}

export function entityVisibleInReadMode(entity: Pick<Entity, 'canonical'>, source: CorpusSource | null, mode: CorpusReadMode): boolean {
  return mode === 'planning' ? true : canonicalIsVisibleInLiveMode(entity, source)
}

export function filterEntityIndexByReadMode(
  entities: EntityMap,
  aliases: AliasMap,
  mode: CorpusReadMode,
): { entities: EntityMap; aliases: AliasMap } {
  if (mode === 'planning') {
    return { entities, aliases }
  }

  const filteredEntities: EntityMap = {}
  for (const [id, entity] of Object.entries(entities)) {
    const { source } = stripCorpusRuntimePrefix(entity.path)
    if (entityVisibleInReadMode(entity, source, mode)) {
      filteredEntities[id] = entity
    }
  }

  const filteredAliases: AliasMap = {}
  for (const entity of Object.values(filteredEntities)) {
    for (const alias of entity.aliases) {
      const key = alias.toLowerCase()
      if (!filteredAliases[key]) filteredAliases[key] = []
      if (!filteredAliases[key].includes(entity.id)) filteredAliases[key].push(entity.id)
    }
  }

  return { entities: filteredEntities, aliases: filteredAliases }
}

export function resolveCorpusFilePath(
  runtimePath: string,
  roots: Partial<Record<CorpusSource, string>>,
): string {
  const resolved = resolveCorpusRuntimePath(runtimePath, roots)
  return existsSync(resolved) ? resolved : runtimePath
}
