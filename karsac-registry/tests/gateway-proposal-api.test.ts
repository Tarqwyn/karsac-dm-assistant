import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { resolve, join } from 'path'
import { tmpdir } from 'os'

const authHeaders = {
  Authorization: 'Bearer local-karsac-dev-key',
  'Content-Type': 'application/json',
}

describe('gateway proposal api', () => {
  let root = ''
  let server: import('http').Server | undefined
  let port = 0
  let baseUrl = ''
  const promotedPath = resolve(process.cwd(), 'corpus/planning/npcs/gateway-ui-warden.md')

  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), 'karsac-proposal-api-'))
    process.env.KARSAC_PROPOSALS_DIR = resolve(root, 'corpus/proposals')
    process.env.KARSAC_COLLECTIONS_DIR = resolve(root, 'corpus/collections')
    process.env.KARSAC_PLANNING_DIR = resolve(root, 'corpus/planning')
    process.env.KARSAC_INDEX_DIR = resolve(root, '.karsac-index')

    mkdirSync(resolve(root, 'corpus/proposals/npcs'), { recursive: true })
    mkdirSync(resolve(root, 'corpus/collections'), { recursive: true })
    mkdirSync(resolve(root, 'corpus/planning'), { recursive: true })

    writeFileSync(
      resolve(root, 'corpus/proposals/npcs/gateway-ui-warden.proposed.md'),
      `---\nid: proposals/gateway-ui-warden\nproposal_type: npc\ntitle: Gateway UI Warden\nstatus: proposed\ncanonical: provisional\nvisibility: dm-only\ncreated_at: '2026-06-22T00:00:00.000Z'\nsource_prompt: propose an npc\nroute_profile: npc-design\nrelated:\n  chapters: []\n  sessions: []\n  factions: []\n  places: []\n  npcs: []\n  items: []\npromote_target: corpus/planning/npcs\nsummary: A gateway UI test warden proposal.\nvalidation:\n  status: pass\n  issues: []\n---\n\n# NPC: Gateway UI Warden\n\n## Role\nTown warden and gatekeeper for a border post.\n\n## Physical Bearing\nBroad-shouldered, weathered cloak, watchful eyes.\n\n## What They Want\nTo keep the gate calm and the toll ledger balanced.\n\n## What They Hide\nA private debt to a distant noble house.\n\n## can_know\n- The old road still sees smugglers after dark.\n\n## must_not_know\n- The noble house plans to replace them.\n\n## Lines to Inhabit\n- \"State your business and keep moving.\"\n- \"I only need your name for the record.\"\n\n## Dramatic Utility\nA reliable authority figure who can become a pressure point.\n\n## player_safe\nThey are brusque but not hostile.\n\n## dm_only\nUse them to control access to the bridge and make the town feel watched.\n`,
      'utf-8',
    )

    const mod = await import('../src/gateway/server.js')
    server = mod.createGatewayServer()
    await new Promise<void>((resolveListen) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address()
        if (!address || typeof address === 'string') throw new Error('No address bound for proposal api test server.')
        port = address.port
        baseUrl = `http://127.0.0.1:${port}`
        resolveListen()
      })
    })
  })

  afterAll(() => {
    server?.close()
    rmSync(promotedPath, { force: true })
    rmSync(root, { recursive: true, force: true })
  })

  it('lists, reads, reviews, and promotes a proposal', async () => {
    const listResponse = await fetch(`${baseUrl}/api/v1/proposals?mode=live`, { headers: authHeaders })
    expect(listResponse.status).toBe(200)
    const listPayload = await listResponse.json() as { proposals: Array<{ id: string; validation: { status: string } }> }
    expect(listPayload.proposals).toHaveLength(1)
    expect(listPayload.proposals[0].id).toBe('proposals/gateway-ui-warden')
    expect(listPayload.proposals[0].validation.status).toBe('fail')

    const detailResponse = await fetch(`${baseUrl}/api/v1/proposals/${encodeURIComponent('proposals/gateway-ui-warden')}?mode=planning`, { headers: authHeaders })
    expect(detailResponse.status).toBe(200)
    const detailPayload = await detailResponse.json() as { proposal: { body: string; review: { reviewed: boolean } } }
    expect(detailPayload.proposal.body).toContain('# NPC: Gateway UI Warden')
    expect(detailPayload.proposal.review.reviewed).toBe(false)

    const reviewResponse = await fetch(`${baseUrl}/api/v1/proposals/${encodeURIComponent('proposals/gateway-ui-warden')}/review`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ reviewed: true, review_status: 'approved' }),
    })
    expect(reviewResponse.status).toBe(200)
    const reviewedPayload = await reviewResponse.json() as { proposal: { review: { reviewed: boolean; review_status: string } } }
    expect(reviewedPayload.proposal.review.reviewed).toBe(true)
    expect(reviewedPayload.proposal.review.review_status).toBe('approved')

    const promoteResponse = await fetch(`${baseUrl}/api/v1/proposals/${encodeURIComponent('proposals/gateway-ui-warden')}/promote`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ force: true }),
    })
    expect(promoteResponse.status).toBe(200)
    const promotePayload = await promoteResponse.json() as { result: { success: boolean; targetPath: string } }
    expect(promotePayload.result.success).toBe(true)
    expect(promotePayload.result.targetPath).toContain('corpus/planning/npcs/gateway-ui-warden.md')
  })
})
