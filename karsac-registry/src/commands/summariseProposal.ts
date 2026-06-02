import { existsSync } from 'fs'
import { summariseProposal, resolveProposalPathInput } from '../proposals/proposalSummary.js'

async function main(): Promise<void> {
  const proposalPathArg = process.argv.slice(2).join(' ').trim()
  if (!proposalPathArg) {
    console.error('Usage: npm run karsac:summarise-proposal -- "<proposal-path>"')
    process.exit(1)
  }

  const absolutePath = resolveProposalPathInput(proposalPathArg)

  if (!existsSync(absolutePath)) {
    console.error(`Proposal file not found: ${proposalPathArg}`)
    process.exit(1)
  }

  const summary = await summariseProposal({
    proposalPath: absolutePath,
    mode: 'rich',
    includeValidationDetails: 'collapsible',
  })
  process.stdout.write(`${summary.humanMarkdown}\n`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
