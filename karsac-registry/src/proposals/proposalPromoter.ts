import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, relative, join, basename, dirname } from 'path'
import matter from 'gray-matter'
import { validateProposalFile } from './proposalValidator.js'
import { PROPOSAL_FOLDERS } from './proposalTypes.js'
import type { ProposalType } from './proposalTypes.js'

export interface PromoteResult {
  sourcePath: string
  targetPath: string
  success: boolean
  error?: string
}

export function promoteProposal(
  proposalPath: string,
  projectRoot: string,
  overwrite = false,
): PromoteResult {
  const result: PromoteResult = {
    sourcePath: proposalPath,
    targetPath: '',
    success: false,
  }

  // 1. Read and parse
  let raw: string
  try {
    raw = readFileSync(proposalPath, { encoding: 'utf-8' })
  } catch (e) {
    result.error = `Cannot read proposal file: ${e}`
    return result
  }

  let fm: Record<string, unknown>
  let body: string
  try {
    const parsed = matter(raw)
    fm = parsed.data as Record<string, unknown>
    body = parsed.content
  } catch (e) {
    result.error = `Cannot parse frontmatter: ${e}`
    return result
  }

  // 2. Validate
  const validation = validateProposalFile(proposalPath)
  if (!validation.valid) {
    result.error = `Validation failed:\n${validation.issues.join('\n')}`
    return result
  }

  // 3. Refuse state-update promotions
  if (fm.proposal_type === 'state-update') {
    result.error = 'state-update proposals cannot be directly promoted. Use a dedicated state-update command to apply state changes.'
    return result
  }

  // 4. Determine target path
  const promoteTarget = fm.promote_target as string | undefined
  if (!promoteTarget) {
    result.error = 'frontmatter.promote_target is missing or empty'
    return result
  }

  const filename = basename(proposalPath)
  const promotedFilename = filename.replace(/\.proposed\.md$/, '.md')
  const targetPath = resolve(projectRoot, promoteTarget, promotedFilename)
  result.targetPath = targetPath

  // 5. Check overwrite
  if (existsSync(targetPath) && !overwrite) {
    result.error = `Target already exists: ${targetPath}. Use overwrite=true to overwrite.`
    return result
  }

  // 6. Create target directory
  mkdirSync(dirname(targetPath), { recursive: true })

  // 7. Build promoted frontmatter
  const relativeSource = relative(projectRoot, proposalPath)
  const promotedFm: Record<string, unknown> = {
    ...fm,
    status: 'promoted',
    canonical: 'provisional',
    promoted_from: relativeSource,
    promoted_at: new Date().toISOString(),
  }

  // Rebuild file content using gray-matter stringify
  const promotedContent = matter.stringify(body, promotedFm)
  writeFileSync(targetPath, promotedContent, { encoding: 'utf-8' })

  // 8. Update original in-place: mark as promoted
  const updatedFm: Record<string, unknown> = {
    ...fm,
    status: 'promoted',
    promoted_at: new Date().toISOString(),
  }
  const updatedSource = matter.stringify(body, updatedFm)
  writeFileSync(proposalPath, updatedSource, { encoding: 'utf-8' })

  result.success = true
  return result
}
