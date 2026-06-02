import { readdirSync, statSync } from 'fs'
import { resolve, join } from 'path'
import matter from 'gray-matter'
import { readFileSync } from 'fs'
import { PROPOSALS_ROOT } from '../paths.js'
import { validateProposalFile } from '../proposals/proposalValidator.js'

function scanProposals(dir: string): string[] {
  const results: string[] = []
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      const stat = statSync(full)
      if (stat.isDirectory()) {
        results.push(...scanProposals(full))
      } else if (entry.endsWith('.proposed.md')) {
        results.push(full)
      }
    }
  } catch { /* skip unreadable dirs */ }
  return results
}

async function main(): Promise<void> {
  const files = scanProposals(PROPOSALS_ROOT)

  if (files.length === 0) {
    console.log('No proposal files found.')
    process.exit(0)
  }

  const rows: Array<{ type: string; title: string; status: string; validation: string; created: string; path: string }> = []

  for (const filePath of files) {
    let type = '?'
    let title = '?'
    let status = '?'
    let created = '?'
    try {
      const raw = readFileSync(filePath, { encoding: 'utf-8' })
      const { data } = matter(raw)
      type = data.proposal_type ?? '?'
      title = data.title ?? '?'
      status = data.status ?? '?'
      created = data.created_at ? (data.created_at as string).slice(0, 10) : '?'
    } catch { /* skip */ }

    const validation = validateProposalFile(filePath)
    rows.push({ type, title, status, validation: validation.status, created, path: filePath })
  }

  const COL = (s: string, w: number) => s.slice(0, w).padEnd(w)

  console.log(
    COL('TYPE', 16) + ' ' +
    COL('TITLE', 40) + ' ' +
    COL('STATUS', 10) + ' ' +
    COL('VALID', 8) + ' ' +
    COL('CREATED', 11) + ' ' +
    'PATH'
  )
  console.log('─'.repeat(140))

  for (const r of rows) {
    console.log(
      COL(r.type, 16) + ' ' +
      COL(r.title, 40) + ' ' +
      COL(r.status, 10) + ' ' +
      COL(r.validation, 8) + ' ' +
      COL(r.created, 11) + ' ' +
      r.path
    )
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
