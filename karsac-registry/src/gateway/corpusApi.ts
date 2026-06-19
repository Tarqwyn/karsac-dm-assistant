import type { IncomingMessage, ServerResponse } from 'http'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import type { AliasMap, Entity, EntityMap } from '../types.js'
import { INDEX_DIR, COLLECTIONS_ROOT, PLANNING_ROOT } from '../paths.js'
import {
  filterEntityIndexByReadMode,
  resolveCorpusFilePath,
  stripCorpusRuntimePrefix,
  type CorpusReadMode,
} from '../corpusPaths.js'
import { sendError, sendJson } from './httpUtils.js'

type CorpusEntitySummary = {
  id: string
  title: string
  type: string
  collection: string
  path: string
  source: 'collections' | 'planning' | 'external'
  canonical?: string
  visibility?: string
  summary?: string
  aliases: string[]
  related: Record<string, string[]>
}

function loadJSON<T>(name: string): T {
  const p = resolve(INDEX_DIR, name)
  if (!existsSync(p)) {
    throw new Error(`Index file not found: ${p}`)
  }
  return JSON.parse(readFileSync(p, { encoding: 'utf-8' })) as T
}

function parseReadMode(value: string | null): CorpusReadMode {
  return value === 'planning' ? 'planning' : 'live'
}

function corpusSourceForEntity(entity: Pick<Entity, 'path' | 'source'>): 'collections' | 'planning' | 'external' {
  if (entity.source === 'collections' || entity.source === 'planning') return entity.source
  const { source } = stripCorpusRuntimePrefix(entity.path)
  return source ?? 'external'
}

function summarizeEntity(entity: Entity): CorpusEntitySummary {
  return {
    id: entity.id,
    title: entity.title,
    type: entity.type,
    collection: entity.collection,
    path: entity.path,
    source: corpusSourceForEntity(entity),
    canonical: entity.canonical,
    visibility: entity.visibility,
    summary: entity.summary,
    aliases: entity.aliases,
    related: entity.related,
  }
}

function findEntityById(id: string, entities: EntityMap): Entity | null {
  const exact = entities[id]
  if (exact) return exact
  const lower = id.toLowerCase()
  return Object.values(entities).find((entity) => entity.id.toLowerCase() === lower) ?? null
}

export async function handleCorpusApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  if (!req.url) return false

  const url = new URL(req.url, 'http://localhost')
  const pathname = url.pathname
  if (!pathname.startsWith('/v1/corpus/')) return false

  if (req.method !== 'GET') {
    sendError(res, 405, 'Method not allowed.', 'invalid_request_error')
    return true
  }

  const readMode = parseReadMode(url.searchParams.get('mode'))
  const query = url.searchParams.get('query')?.trim() ?? ''
  const typeFilter = url.searchParams.get('type')?.trim().toLowerCase() ?? ''
  const limitRaw = url.searchParams.get('limit')
  const limit = limitRaw ? Math.max(1, Number.parseInt(limitRaw, 10) || 1) : 1000

  try {
    const entities = loadJSON<EntityMap>('entities.json')
    const aliases = loadJSON<AliasMap>('aliases.json')
    const corpus = filterEntityIndexByReadMode(entities, aliases, readMode)

    if (pathname.startsWith('/v1/corpus/entities/')) {
      const id = decodeURIComponent(pathname.slice('/v1/corpus/entities/'.length))
      const entity = findEntityById(id, corpus.entities)
      if (!entity) {
        sendError(res, 404, `Corpus entity not found: ${id}`, 'not_found_error')
        return true
      }

      const sourceRoots = {
        collections: COLLECTIONS_ROOT,
        planning: PLANNING_ROOT,
      } as const
      const contentPath = resolveCorpusFilePath(entity.path, sourceRoots)
      if (!existsSync(contentPath)) {
        sendError(res, 404, `Corpus file not found on disk: ${entity.path}`, 'not_found_error')
        return true
      }

      sendJson(res, 200, {
        mode: readMode,
        entity: {
          ...summarizeEntity(entity),
          visibleInMode: true,
          contentPath,
          content: readFileSync(contentPath, { encoding: 'utf-8' }),
        },
      })
      return true
    }

    let results = Object.values(corpus.entities)
    if (typeFilter) {
      results = results.filter((entity) => entity.type.toLowerCase() === typeFilter)
    }

    if (query) {
      const q = query.toLowerCase()
      results = results.filter((entity) =>
        entity.id.toLowerCase().includes(q) ||
        entity.title.toLowerCase().includes(q) ||
        entity.aliases.some((alias) => alias.toLowerCase().includes(q)),
      )
    }

    const summaries = results
      .sort((a, b) => a.title.localeCompare(b.title))
      .slice(0, limit)
      .map((entity) => ({
        ...summarizeEntity(entity),
        visibleInMode: true,
      }))

    sendJson(res, 200, {
      mode: readMode,
      query,
      count: summaries.length,
      entities: summaries,
    })
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Corpus API request failed.'
    sendError(res, 500, message, 'server_error')
    return true
  }
}
