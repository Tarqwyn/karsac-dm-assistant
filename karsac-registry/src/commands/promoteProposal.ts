import { resolve, isAbsolute } from 'path'
import { fileURLToPath } from 'url'
import { promoteProposal } from '../proposals/proposalPromoter.js'

// Project root: karsac-dm-assistant/ (four levels up from src/commands/<file>.ts)
const __filename = fileURLToPath(import.meta.url)
const PROJECT_ROOT = resolve(__filename, '../../../..')

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2).filter(a => a !== '--')
  const force = rawArgs.includes('--force')
  const overwrite = rawArgs.includes('--overwrite')
  const positional = rawArgs.filter(a => !a.startsWith('--'))
  const proposalPath = positional[0]

  if (!proposalPath) {
    console.error('Usage: npm run karsac:promote-proposal -- <path-to-proposal.proposed.md> [--force] [--overwrite]')
    console.error('')
    console.error('  --force      Promote even if validation has hard failures (requires manual review)')
    console.error('  --overwrite  Overwrite the target if it already exists in the corpus')
    process.exit(1)
  }

  // Resolve relative paths against project root (not karsac-registry/ CWD)
  const absPath = isAbsolute(proposalPath) ? proposalPath : resolve(PROJECT_ROOT, proposalPath)
  console.log(`Promoting: ${absPath}`)
  if (force) console.warn(`⚠  --force: validation failures will not block promotion`)

  const result = await promoteProposal(absPath, PROJECT_ROOT, overwrite, force)

  if (!result.success) {
    console.error(`\nPromotion failed: ${result.error}`)
    process.exit(1)
  }

  if (result.forcedPastValidation) {
    console.warn(`\n⚠  Promoted with validation failures:`)
    for (const issue of result.validationIssues.filter(i => i.startsWith('FAIL:'))) {
      console.warn(`   ${issue}`)
    }
    console.warn(`   Review and fix these before marking canonical.\n`)
  } else if (result.validationIssues.some(i => i.startsWith('WARN:'))) {
    console.log(`\nWarnings (non-blocking):`)
    for (const issue of result.validationIssues.filter(i => i.startsWith('WARN:'))) {
      console.log(`   ${issue}`)
    }
  }

  console.log(`\nPromotion successful!`)
  console.log(`Source:  ${result.sourcePath}`)
  console.log(`Target:  ${result.targetPath}`)
  if (result.indexRebuilt) console.log(`Index:   rebuilt — entity is now searchable`)
  console.log(`\nNote: The promoted file retains canonical: provisional`)
  console.log(`Run your canon review process before marking it as canonical.`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
