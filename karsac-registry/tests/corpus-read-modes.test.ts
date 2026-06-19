import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
import { tmpdir } from 'os'

function writeMarkdown(root: string, relativePath: string, content: string): void {
  const fullPath = resolve(root, relativePath)
  mkdirSync(join(fullPath, '..'), { recursive: true })
  writeFileSync(fullPath, content, 'utf8')
}

function makeFixtureRoots(): { root: string; collections: string; planning: string; indexDir: string } {
  const root = mkdtempSync(join(tmpdir(), 'karsac-corpus-modes-'))
  const collections = resolve(root, 'corpus/collections')
  const planning = resolve(root, 'corpus/planning')
  const indexDir = resolve(root, '.karsac-index')
  mkdirSync(collections, { recursive: true })
  mkdirSync(planning, { recursive: true })
  mkdirSync(indexDir, { recursive: true })
  return { root, collections, planning, indexDir }
}

describe('corpus read modes', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('indexes collections and planning roots and keeps live reads provisional-safe', async () => {
    const fixture = makeFixtureRoots()

    writeMarkdown(
      fixture.collections,
      'karsac-major-npcs/live-npc.md',
      `---
id: npcs/live-npc
type: npc
title: Live NPC
tags: [live]
---

# Live NPC

**Canon File ID:** \`npcs/live-npc\`
`,
    )

    writeMarkdown(
      fixture.planning,
      'npcs/future-npc.md',
      `---
id: npcs/future-npc
type: npc
title: Future NPC
canonical: provisional
tags: [future]
---

# Future NPC

**Canon File ID:** \`npcs/future-npc\`
`,
    )

    vi.stubEnv('KARSAC_INDEX_DIR', fixture.indexDir)
    vi.stubEnv('KARSAC_COLLECTIONS_DIR', fixture.collections)
    vi.stubEnv('KARSAC_PLANNING_DIR', fixture.planning)

    const { buildIndex } = await import('../src/build-index.js')
    await buildIndex()

    const entities = JSON.parse(readFileSync(resolve(fixture.indexDir, 'entities.json'), 'utf8')) as Record<string, { id: string; path: string; canonical?: string }>
    expect(Object.keys(entities)).toContain('npcs/live-npc')
    expect(Object.keys(entities)).toContain('npcs/future-npc')
    expect(entities['npcs/future-npc'].path).toContain('openwebui-runtime-planning/')

    vi.resetModules()
    vi.stubEnv('KARSAC_INDEX_DIR', fixture.indexDir)
    vi.stubEnv('KARSAC_COLLECTIONS_DIR', fixture.collections)
    vi.stubEnv('KARSAC_PLANNING_DIR', fixture.planning)

    const { createGatewayServer } = await import('../src/gateway/server.js')

    const server = createGatewayServer()
    await new Promise<void>((resolveListen) => server.listen(0, '127.0.0.1', () => resolveListen()))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Failed to bind test gateway')
    const baseUrl = `http://127.0.0.1:${address.port}`

    try {
      const liveResponse = await fetch(`${baseUrl}/v1/corpus/entities?mode=live`, {
        headers: { Authorization: 'Bearer local-karsac-dev-key' },
      })
      expect(liveResponse.status).toBe(200)
      const liveBody = await liveResponse.json() as { entities: Array<{ id: string }> }
      expect(liveBody.entities.map((entry) => entry.id)).toContain('npcs/live-npc')
      expect(liveBody.entities.map((entry) => entry.id)).not.toContain('npcs/future-npc')

      const planningResponse = await fetch(`${baseUrl}/v1/corpus/entities?mode=planning`, {
        headers: { Authorization: 'Bearer local-karsac-dev-key' },
      })
      expect(planningResponse.status).toBe(200)
      const planningBody = await planningResponse.json() as { entities: Array<{ id: string }> }
      expect(planningBody.entities.map((entry) => entry.id)).toContain('npcs/future-npc')

      const detailResponse = await fetch(`${baseUrl}/v1/corpus/entities/npcs/future-npc?mode=planning`, {
        headers: { Authorization: 'Bearer local-karsac-dev-key' },
      })
      expect(detailResponse.status).toBe(200)
      const detailBody = await detailResponse.json() as { entity: { id: string; content: string } }
      expect(detailBody.entity.id).toBe('npcs/future-npc')
      expect(detailBody.entity.content).toContain('Future NPC')
    } finally {
      await new Promise<void>((resolveClose, reject) => server.close((err) => (err ? reject(err) : resolveClose())))
      rmSync(fixture.root, { recursive: true, force: true })
    }
  }, 60_000)
})
