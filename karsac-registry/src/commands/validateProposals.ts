import { readdirSync, statSync } from 'fs'
import { resolve, join } from 'path'
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

  let passCount = 0
  let warnCount = 0
  let failCount = 0

  for (const filePath of files) {
    const result = validateProposalFile(filePath)
    const label = result.status.toUpperCase().padEnd(7)
    console.log(`[${label}] ${filePath}`)
    if (result.issues.length > 0) {
      for (const issue of result.issues) {
        console.log(`         ${issue}`)
      }
    }
    if (result.status === 'pass') passCount++
    else if (result.status === 'warning') warnCount++
    else failCount++
  }

  console.log(`\nTotal: ${files.length}  Pass: ${passCount}  Warn: ${warnCount}  Fail: ${failCount}`)

  if (failCount > 0) process.exit(1)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
