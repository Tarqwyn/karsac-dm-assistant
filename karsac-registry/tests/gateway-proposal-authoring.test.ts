import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { resolve, join } from 'path'
import { tmpdir } from 'os'

vi.mock('../src/gateway/karsacRunner.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../src/gateway/karsacRunner.js')>()
  return { ...mod, generateProposalFromPrompt: vi.fn() }
})

const authHeaders = {
  Authorization: 'Bearer local-karsac-dev-key',
  'Content-Type': 'application/json',
}

describe('gateway proposal authoring api', () => {
  let root = ''
  let server: import('http').Server | undefined
  let port = 0
  let baseUrl = ''

  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), 'karsac-proposal-authoring-'))
    process.env.KARSAC_PROPOSALS_DIR = resolve(root, 'corpus/proposals')
    process.env.KARSAC_COLLECTIONS_DIR = resolve(root, 'corpus/collections')
    process.env.KARSAC_PLANNING_DIR = resolve(root, 'corpus/planning')
    process.env.KARSAC_INDEX_DIR = resolve(root, '.karsac-index')

    mkdirSync(resolve(root, 'corpus/proposals'), { recursive: true })
    mkdirSync(resolve(root, 'corpus/collections'), { recursive: true })
    mkdirSync(resolve(root, 'corpus/planning'), { recursive: true })

    const mod = await import('../src/gateway/server.js')
    server = mod.createGatewayServer()
    await new Promise<void>((res) => {
      server!.listen(0, '127.0.0.1', () => {
        const address = server!.address()
        if (!address || typeof address === 'string') throw new Error('No address')
        port = (address as import('net').AddressInfo).port
        baseUrl = `http://127.0.0.1:${port}`
        res()
      })
    })
  })

  afterAll(() => {
    server?.close()
    rmSync(root, { recursive: true, force: true })
  })

  // ---- POST /api/v1/proposals (create) ----

  describe('POST /api/v1/proposals', () => {
    it('scaffolds a hand-authored proposal and returns 201', async () => {
      const res = await fetch(`${baseUrl}/api/v1/proposals?mode=live`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ type: 'npc', title: 'Test Warden', summary: 'A test NPC.' }),
      })
      expect(res.status).toBe(201)
      const { proposal } = await res.json() as { proposal: { id: string; proposalType: string; status: string; promoteTarget: string } }
      expect(proposal.id).toBe('proposals/npcs/test-warden')
      expect(proposal.proposalType).toBe('npc')
      expect(proposal.status).toBe('proposed')
      expect(proposal.promoteTarget).toBe('corpus/planning/npcs')
    })

    it('returns 409 on slug collision', async () => {
      const body = JSON.stringify({ type: 'npc', title: 'Duplicate NPC' })
      await fetch(`${baseUrl}/api/v1/proposals?mode=live`, { method: 'POST', headers: authHeaders, body })
      const res = await fetch(`${baseUrl}/api/v1/proposals?mode=live`, { method: 'POST', headers: authHeaders, body })
      expect(res.status).toBe(409)
    })

    it('returns 400 for missing title', async () => {
      const res = await fetch(`${baseUrl}/api/v1/proposals?mode=live`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ type: 'npc' }),
      })
      expect(res.status).toBe(400)
    })

    it('returns 400 for invalid type', async () => {
      const res = await fetch(`${baseUrl}/api/v1/proposals?mode=live`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ type: 'not-a-type', title: 'Test' }),
      })
      expect(res.status).toBe(400)
    })
  })

  // ---- PUT /api/v1/proposals/:id (update) ----

  describe('PUT /api/v1/proposals/:id', () => {
    const proposalId = 'proposals/npcs/updatable-warden'
    const proposalFile = () => resolve(root, 'corpus/proposals/npcs/updatable-warden.proposed.md')

    beforeAll(() => {
      mkdirSync(resolve(root, 'corpus/proposals/npcs'), { recursive: true })
      writeFileSync(
        proposalFile(),
        [
          '---',
          `id: ${proposalId}`,
          'proposal_type: npc',
          'title: Updatable Warden',
          'status: proposed',
          'canonical: provisional',
          'visibility: dm-only',
          "created_at: '2026-06-22T00:00:00.000Z'",
          'promote_target: corpus/planning/npcs',
          'summary: Original summary.',
          'related:',
          '  chapters: []',
          '  sessions: []',
          '  factions: []',
          '  places: []',
          '  npcs: []',
          '  items: []',
          'validation:',
          '  status: pass',
          '  issues: []',
          '---',
          '',
          '# Updatable Warden',
          '',
        ].join('\n'),
        'utf-8',
      )
    })

    it('updates title, summary, and body', async () => {
      const res = await fetch(`${baseUrl}/api/v1/proposals/${encodeURIComponent(proposalId)}?mode=live`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ title: 'Updated Warden', summary: 'New summary.', body: '# Updated Warden\n\nNew content.' }),
      })
      expect(res.status).toBe(200)
      const { proposal } = await res.json() as { proposal: { title: string; summary: string; body: string } }
      expect(proposal.title).toBe('Updated Warden')
      expect(proposal.summary).toBe('New summary.')
      expect(proposal.body).toContain('New content.')
    })

    it('updates related with valid string arrays', async () => {
      const res = await fetch(`${baseUrl}/api/v1/proposals/${encodeURIComponent(proposalId)}?mode=live`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ related: { chapters: ['chapter-3'], npcs: [], factions: [], places: [], sessions: [], items: [] } }),
      })
      expect(res.status).toBe(200)
      const { proposal } = await res.json() as { proposal: { frontmatter: { related: Record<string, string[]> } } }
      expect(proposal.frontmatter.related.chapters).toEqual(['chapter-3'])
    })

    it('returns 400 when related contains non-string array values', async () => {
      const res = await fetch(`${baseUrl}/api/v1/proposals/${encodeURIComponent(proposalId)}?mode=live`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ related: { npcs: [1, 2] } }),
      })
      expect(res.status).toBe(400)
    })

    it('returns 409 when proposal is promoted', async () => {
      const promotedId = 'proposals/npcs/promoted-warden'
      mkdirSync(resolve(root, 'corpus/proposals/npcs'), { recursive: true })
      writeFileSync(
        resolve(root, 'corpus/proposals/npcs/promoted-warden.proposed.md'),
        `---\nid: ${promotedId}\nproposal_type: npc\ntitle: Promoted Warden\nstatus: promoted\ncanonical: provisional\nvisibility: dm-only\ncreated_at: '2026-06-22T00:00:00.000Z'\npromote_target: corpus/planning/npcs\nsummary: Already promoted.\nvalidation:\n  status: pass\n  issues: []\n---\n\n# Promoted Warden\n`,
        'utf-8',
      )
      const res = await fetch(`${baseUrl}/api/v1/proposals/${encodeURIComponent(promotedId)}?mode=live`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ title: 'Should fail' }),
      })
      expect(res.status).toBe(409)
    })

    it('returns 404 for unknown proposal', async () => {
      const res = await fetch(`${baseUrl}/api/v1/proposals/${encodeURIComponent('proposals/npcs/does-not-exist')}?mode=live`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ title: 'Nope' }),
      })
      expect(res.status).toBe(404)
    })
  })

  // ---- POST /api/v1/proposals/generate ----

  describe('POST /api/v1/proposals/generate', () => {
    it('returns 400 when type is missing', async () => {
      const res = await fetch(`${baseUrl}/api/v1/proposals/generate?mode=live`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ prompt: 'a mysterious merchant' }),
      })
      expect(res.status).toBe(400)
    })

    it('returns 400 for invalid type', async () => {
      const res = await fetch(`${baseUrl}/api/v1/proposals/generate?mode=live`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ type: 'not-a-type', prompt: 'a mysterious merchant' }),
      })
      expect(res.status).toBe(400)
    })

    it('returns 400 when prompt is missing', async () => {
      const res = await fetch(`${baseUrl}/api/v1/proposals/generate?mode=live`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ type: 'npc' }),
      })
      expect(res.status).toBe(400)
    })

    it('returns 200 with proposal detail when subprocess writes a file', async () => {
      const { generateProposalFromPrompt } = await import('../src/gateway/karsacRunner.js')
      const proposalPath = resolve(root, 'corpus/proposals/npcs/generated-merchant.proposed.md')
      mkdirSync(resolve(root, 'corpus/proposals/npcs'), { recursive: true })
      writeFileSync(
        proposalPath,
        `---\nid: proposals/npcs/generated-merchant\nproposal_type: npc\ntitle: Generated Merchant\nstatus: proposed\ncanonical: provisional\nvisibility: dm-only\ncreated_at: '2026-06-22T00:00:00.000Z'\npromote_target: corpus/planning/npcs\nsummary: A generated merchant.\nvalidation:\n  status: pass\n  issues: []\n---\n\n# Generated Merchant\n`,
        'utf-8',
      )
      vi.mocked(generateProposalFromPrompt).mockResolvedValueOnce({
        proposalPath,
        validationStatus: 'pass',
        stdout: '',
        stderr: '',
      })

      const res = await fetch(`${baseUrl}/api/v1/proposals/generate?mode=live`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ type: 'npc', prompt: 'a mysterious merchant with a dark past' }),
      })
      expect(res.status).toBe(200)
      const payload = await res.json() as { proposal: { id: string; proposalType: string }; validationStatus: string }
      expect(payload.proposal.id).toBe('proposals/npcs/generated-merchant')
      expect(payload.proposal.proposalType).toBe('npc')
      expect(payload.validationStatus).toBe('pass')
    })

    it('returns 500 when subprocess produces no output file', async () => {
      const { generateProposalFromPrompt } = await import('../src/gateway/karsacRunner.js')
      vi.mocked(generateProposalFromPrompt).mockResolvedValueOnce({
        proposalPath: undefined,
        validationStatus: undefined,
        stdout: '',
        stderr: '',
      })

      const res = await fetch(`${baseUrl}/api/v1/proposals/generate?mode=live`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ type: 'npc', prompt: 'something that fails' }),
      })
      expect(res.status).toBe(500)
    })
  })
})
