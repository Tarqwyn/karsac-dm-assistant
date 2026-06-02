import { resolve, isAbsolute } from 'path'
import { fileURLToPath } from 'url'
import { promoteProposal } from '../proposals/proposalPromoter.js'

// Project root: karsac-dm-assistant/ (four levels up from src/commands/<file>.ts)
const __filename = fileURLToPath(import.meta.url)
const PROJECT_ROOT = resolve(__filename, '../../../..')

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter(a => a !== '--')
  const proposalPath = args[0]

  if (!proposalPath) {
    console.error('Usage: npm run karsac:promote-proposal -- <path-to-proposal.proposed.md>')
    process.exit(1)
  }

  // Resolve relative paths against project root (not karsac-registry/ CWD)
  const absPath = isAbsolute(proposalPath) ? proposalPath : resolve(PROJECT_ROOT, proposalPath)
  console.log(`Promoting: ${absPath}`)

  const result = promoteProposal(absPath, PROJECT_ROOT)

  if (!result.success) {
    console.error(`\nPromotion failed: ${result.error}`)
    if (result.error?.includes('state-update')) {
      console.error('\nstate-update proposals cannot be promoted directly.')
      console.error('Use a dedicated state-update command to apply state changes after play.')
    }
    process.exit(1)
  }

  console.log(`\nPromotion successful!`)
  console.log(`Source:  ${result.sourcePath}`)
  console.log(`Target:  ${result.targetPath}`)
  console.log(`\nNote: The promoted file retains canonical: provisional`)
  console.log(`Run your canon review process before marking it as canonical.`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
