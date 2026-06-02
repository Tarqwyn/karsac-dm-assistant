export interface ProposalSummary {
  title: string
  proposalType: string
  status: string
  canonical: string
  validationStatus: 'pass' | 'warning' | 'fail'
  validationIssues: string[]
  sourcePrompt: string
  routeProfile: string
  promoteTarget: string
  proposalPath: string
  summary: string
  highlights: string[]
  nextActions: string[]
  humanMarkdown: string
  summaryMode?: 'rich' | 'compact'
  renderer?: string
  sectionsFound?: string[]
  usedFallback?: boolean
}
