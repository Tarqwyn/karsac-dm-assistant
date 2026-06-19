import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, relative, join, basename, dirname } from 'path'
import matter from 'gray-matter'
import { validateProposalFile } from './proposalValidator.js'
import { buildIndex } from '../build-index.js'
import type { ProposalType } from './proposalTypes.js'
import { validateDesignObject } from '../designSchemaValidator.js'
import { buildChapterSeedFromOutline } from '../state/chapterSeedFromOutline.js'

export interface PromoteResult {
  sourcePath: string
  targetPath: string
  success: boolean
  indexRebuilt: boolean
  forcedPastValidation: boolean
  validationIssues: string[]
  error?: string
}

export async function promoteProposal(
  proposalPath: string,
  projectRoot: string,
  overwrite = false,
  force = false,
): Promise<PromoteResult> {
  const result: PromoteResult = {
    sourcePath: proposalPath,
    targetPath: '',
    success: false,
    indexRebuilt: false,
    forcedPastValidation: false,
    validationIssues: [],
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
  result.validationIssues = validation.issues
  if (!validation.valid) {
    if (!force) {
      result.error = `Validation failed (${validation.issues.filter(i => i.startsWith('FAIL:')).length} hard failure(s)).\nRun with --force to promote anyway after manual review.\n\n${validation.issues.join('\n')}`
      return result
    }
    result.forcedPastValidation = true
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

  if (fm.proposal_type === 'chapter-outline' && fm.structured_outline) {
    const outlineValidation = validateDesignObject('campaign-structure-chapter-outline.json', fm.structured_outline)
    if (!outlineValidation.valid) {
      result.error = `Invalid structured outline in frontmatter: ${outlineValidation.issues.join('; ')}`
      return result
    }

    const relatedChapterIds = Array.isArray((fm.related as Record<string, unknown>)?.chapters)
      ? ((fm.related as Record<string, unknown>).chapters as unknown[])
      : []
    const chapterId = String(
      relatedChapterIds.find((value) => typeof value === 'string' && value.trim())
      ?? (fm.structured_outline as Record<string, unknown>).id
      ?? '',
    ).trim()
    if (chapterId) {
      const seed = buildChapterSeedFromOutline(
        fm.structured_outline as any,
        (fm.related as Record<string, unknown>) as any,
        projectRoot,
      )
      const seedPath = resolve(projectRoot, 'corpus', 'state', 'chapters', chapterId, 'seed.json')
      mkdirSync(dirname(seedPath), { recursive: true })
      writeFileSync(seedPath, `${JSON.stringify(seed, null, 2)}\n`, { encoding: 'utf-8' })
    }
  }

  // 9. Rebuild entity index so the promoted entity is immediately findable
  await buildIndex()
  result.indexRebuilt = true

  result.success = true
  return result
}
