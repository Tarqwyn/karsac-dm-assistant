import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { resolve, join } from 'path'
import { tmpdir } from 'os'
import {
  isPromoteRequest,
  parsePromoteIntent,
  resolveProposalForPromotion,
  renderNoMatch,
  renderBlocked,
} from '../src/gateway/promoteIntent.js'

function writeProposal(
  root: string,
  folder: string,
  slug: string,
  fm: Record<string, string>,
): void {
  const dir = resolve(root, 'corpus/proposals', folder)
  mkdirSync(dir, { recursive: true })
  const frontmatter = Object.entries(fm).map(([k, v]) => `${k}: ${v}`).join('\n')
  writeFileSync(join(dir, `${slug}.proposed.md`), `---\n${frontmatter}\n---\n\nbody\n`)
}

describe('promote intent detection', () => {
  it('detects an explicit promote request', () => {
    expect(isPromoteRequest('promote Astrid Half-Stone')).toBe(true)
    expect(isPromoteRequest('force promote astrid-half-stone')).toBe(true)
  })

  it('does not fire on "propose" or "promotion"/"promoted"', () => {
    expect(isPromoteRequest('propose a new adversary')).toBe(false)
    expect(isPromoteRequest('make this a promotion-reviewable proposal')).toBe(false)
    expect(isPromoteRequest('it was already promoted')).toBe(false)
  })

  it('extracts the target name and strips command noise', () => {
    expect(parsePromoteIntent('please promote the Astrid Half-Stone proposal').slug).toBe('astrid-half-stone')
    expect(parsePromoteIntent('promote astrid-half-stone into the corpus').slug).toBe('astrid-half-stone')
  })

  it('detects explicit force / overwrite overrides without eating the slug', () => {
    const forced = parsePromoteIntent('force promote astrid-half-stone')
    expect(forced.force).toBe(true)
    expect(forced.slug).toBe('astrid-half-stone')

    const over = parsePromoteIntent('promote keldvik and overwrite')
    expect(over.overwrite).toBe(true)
    expect(over.slug).toBe('keldvik')

    expect(parsePromoteIntent('promote maret').force).toBe(false)
  })
})

describe('proposal resolution', () => {
  let root: string

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'promote-resolve-'))
    writeProposal(root, 'npcs', 'astrid-half-stone', { title: 'Astrid Half-Stone', proposal_type: 'npc', status: 'proposed' })
    writeProposal(root, 'places', 'keldvik', { title: 'Keldvik', proposal_type: 'place', status: 'proposed' })
    writeProposal(root, 'npcs', 'maret', { title: 'Maret', proposal_type: 'npc', status: 'proposed' })
  })

  afterAll(() => rmSync(root, { recursive: true, force: true }))

  const proposalsRoot = () => resolve(root, 'corpus/proposals')

  it('matches by exact filename slug', () => {
    const r = resolveProposalForPromotion('promote astrid-half-stone', proposalsRoot())
    expect(r.kind).toBe('match')
    if (r.kind === 'match') expect(r.match.slug).toBe('astrid-half-stone')
  })

  it('matches by title (the natural name a user types)', () => {
    const r = resolveProposalForPromotion('promote Astrid Half-Stone', proposalsRoot())
    expect(r.kind).toBe('match')
    if (r.kind === 'match') expect(r.match.slug).toBe('astrid-half-stone')
  })

  it('matches by partial name', () => {
    const r = resolveProposalForPromotion('promote keldvik', proposalsRoot())
    expect(r.kind).toBe('match')
    if (r.kind === 'match') expect(r.match.proposalType).toBe('place')
  })

  it('returns none with an available list when nothing matches', () => {
    const r = resolveProposalForPromotion('promote nonexistent-thing', proposalsRoot())
    expect(r.kind).toBe('none')
    if (r.kind === 'none') {
      expect(r.available).toHaveLength(3)
      const text = renderNoMatch(r)
      expect(text).toContain('astrid-half-stone')
      expect(text).toContain('keldvik')
    }
  })

  it('returns none with a "generate one first" hint when no proposals exist', () => {
    const empty = mkdtempSync(join(tmpdir(), 'promote-empty-'))
    try {
      const r = resolveProposalForPromotion('promote anything', resolve(empty, 'corpus/proposals'))
      expect(r.kind).toBe('none')
      if (r.kind === 'none') expect(renderNoMatch(r)).toMatch(/Generate one first/i)
    } finally {
      rmSync(empty, { recursive: true, force: true })
    }
  })
})

describe('blocked rendering', () => {
  it('surfaces the failure detail and the exact override phrase', () => {
    const match = { path: '/x/astrid.proposed.md', slug: 'astrid-half-stone', title: 'Astrid', proposalType: 'npc', status: 'proposed' }
    const text = renderBlocked(match, 'Validation failed (2 hard failures)\nFAIL: invented faction ref')
    expect(text).toContain('FAIL: invented faction ref')
    expect(text).toContain('force promote astrid-half-stone')
  })
})
