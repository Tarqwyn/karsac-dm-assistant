import { readFileSync, existsSync } from 'fs'
import { execSync } from 'child_process'
import { relative, resolve } from 'path'
import {
  buildAdversaryDesignMessages,
  buildEncounterDesignMessages,
  buildChapterOutlineMessages,
  buildPlaceMessages,
  buildNpcDesignMessages,
} from '../resolver.js'
import {
  loadScoredAdversaries, loadScoredPatterns, getNpcBaseSummaries,
} from '../encounter-design.js'
import {
  detectRequestedBase, loadBaseFile, loadContextAdversaries,
  validateAdversaryOutput, repairAdversaryOutput, repairFactionMetadata,
  extractProposalConstraints,
} from '../adversary-design.js'
import {
  PROJECT_ROOT, STATE_ROOT, ADVERSARY_CORPUS_ROOT, ENCOUNTER_PATTERNS_ROOT, PROPOSALS_ROOT,
} from '../paths.js'
import { summariseProposal } from '../proposals/proposalSummary.js'
import { writeProposal } from '../proposals/proposalWriter.js'
import {
  detectProposalExecutionPlan,
  profileForExplicitType,
} from '../proposals/proposalRouting.js'
import { validateProposalContent } from '../proposals/proposalValidator.js'
import type { ProposalType, ProposalFrontmatter } from '../proposals/proposalTypes.js'
import { PROMOTE_TARGETS } from '../proposals/proposalTypes.js'
import { slugify } from '../proposals/slugify.js'
import { getGatewayBuildInfo } from '../buildInfo.js'
import { applyCreativeTreatment } from '../creativeTreatment/applyCreativeTreatment.js'
import { validateCreativeTreatment } from '../creativeTreatment/treatmentValidator.js'
import { creativeTreatmentEnabled, getDraftGenerationSettings, getDraftModel } from '../modelSettings.js'

const OLLAMA_HOST = process.env.OLLAMA_HOST ?? 'http://localhost:11434'
const DEFAULT_MODEL = getDraftModel()
const DRAFT_SETTINGS = getDraftGenerationSettings()

// ── WSL fallback ──────────────────────────────────────────────────────────────

function wslWindowsHost(): string | null {
  try {
    if (!existsSync('/proc/version')) return null
    const ver = readFileSync('/proc/version', 'utf-8')
    if (!ver.toLowerCase().includes('microsoft')) return null
    const out = execSync('ip route show default 2>/dev/null', { encoding: 'utf-8' })
    const m = out.match(/default via ([\d.]+)/)
    return m ? m[1] : null
  } catch {
    return null
  }
}

// ── Ollama call ───────────────────────────────────────────────────────────────

async function callOllama(
  messages: Array<{ role: string; content: string }>,
  opts: { silent?: boolean; model?: string; temperature?: number; topP?: number } = {},
): Promise<string> {
  const model = opts.model ?? DEFAULT_MODEL
  const ollamaOptions = (opts.temperature !== undefined || opts.topP !== undefined)
    ? { temperature: opts.temperature ?? 0.4, top_p: opts.topP ?? 0.85 }
    : undefined

  const primaryUrl = `${OLLAMA_HOST}/api/chat`
  const body = JSON.stringify({
    model,
    stream: true,
    messages,
    ...(ollamaOptions ? { options: ollamaOptions } : {}),
  })
  const reqInit: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  }

  let response: Response | undefined
  let activeUrl = primaryUrl

  try {
    response = await fetch(primaryUrl, reqInit)
  } catch {
    const winIp = wslWindowsHost()
    if (winIp && OLLAMA_HOST.includes('localhost')) {
      const fallbackUrl = primaryUrl.replace('localhost', winIp)
      process.stderr.write(`  localhost unreachable — retrying via Windows host (${winIp})...\n`)
      try {
        response = await fetch(fallbackUrl, { ...reqInit })
        activeUrl = fallbackUrl
        process.stderr.write(`  Connected. Set OLLAMA_HOST=http://${winIp}:11434 to skip this retry.\n\n`)
      } catch { /* fall through */ }
    }
  }

  if (!response) {
    const winIp = wslWindowsHost()
    console.error(`\nCannot reach Ollama at ${OLLAMA_HOST}.`)
    if (winIp) {
      console.error(`Running in WSL — set OLLAMA_HOST=http://${winIp}:11434`)
    }
    process.exit(1)
  }

  if (!response.ok) {
    const respBody = await response.text()
    console.error(`\nOllama returned HTTP ${response.status}: ${respBody}`)
    process.exit(1)
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let chunk = ''
  let fullText = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    chunk += decoder.decode(value, { stream: true })
    const lines = chunk.split('\n')
    chunk = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const parsed = JSON.parse(line) as { message?: { content?: string }; done?: boolean }
        if (parsed.message?.content) {
          if (!opts.silent) process.stdout.write(parsed.message.content)
          fullText += parsed.message.content
        }
      } catch { /* skip */ }
    }
  }

  if (!opts.silent) process.stdout.write('\n')
  return fullText
}

// ── State context loader ──────────────────────────────────────────────────────

function readStateFile(relPath: string): Record<string, unknown> | null {
  const p = resolve(STATE_ROOT, relPath)
  if (!existsSync(p)) return null
  try { return JSON.parse(readFileSync(p, { encoding: 'utf-8' })) as Record<string, unknown> }
  catch { return null }
}

function loadChapterOutlineContext() {
  return {
    campaignState:   readStateFile('campaign-state.json'),
    partyState:      readStateFile('party-state.json'),
    worldThreads:    readStateFile('world-threads.json'),
    playerKnowledge: readStateFile('player-knowledge.json'),
    npcsState:       readStateFile('npcs-state.json'),
    sessionFacts:    readStateFile('session-facts/session-2.json'),
  }
}

// ── Title extraction from model output ───────────────────────────────────────

function extractTitle(output: string, proposalType: ProposalType, fallback: string): string {
  if (proposalType === 'chapter-outline') {
    const m = output.match(/^#\s+Chapter Outline:\s*(.+)$/m)
    if (m) return m[1].trim()
  }
  if (proposalType === 'adversary') {
    const m = output.match(/^#\s+Adversary:\s*(.+)$/m)
    if (m) return m[1].trim()
  }
  if (proposalType === 'encounter') {
    const m = output.match(/^#\s+Encounter:\s*(.+)$/m)
    if (m) return m[1].trim()
  }
  if (proposalType === 'npc') {
    const m = output.match(/^#\s+NPC:\s*(.+)$/m)
    if (m) return m[1].trim()
  }
  if (proposalType === 'place') {
    const m = output.match(/^#\s+Place:\s*(.+)$/m)
    if (m) return m[1].trim()
  }
  return fallback.slice(0, 60)
}

// ── Args parsing ──────────────────────────────────────────────────────────────

function parseArgs(): {
  prompt: string
  proposalType: ProposalType | null
  titleOverride: string | null
  doctrineReview: boolean | null
} {
  const args = process.argv.slice(2)
  const filtered: string[] = []
  let proposalType: ProposalType | null = null
  let titleOverride: string | null = null
  let doctrineReview: boolean | null = null

  const validTypes: ProposalType[] = [
    'adversary', 'encounter', 'chapter-outline', 'session-outline',
    'scene', 'npc', 'place', 'item', 'clue', 'handout', 'state-update',
  ]

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--type' && i + 1 < args.length) {
      const t = args[++i] as ProposalType
      if (!validTypes.includes(t)) {
        console.error(`Unknown proposal type: "${t}". Valid: ${validTypes.join(', ')}`)
        process.exit(1)
      }
      proposalType = t
    } else if (args[i] === '--title' && i + 1 < args.length) {
      titleOverride = args[++i]
    } else if (args[i] === '--doctrine-review') {
      doctrineReview = true
    } else if (args[i] === '--no-doctrine-review') {
      doctrineReview = false
    } else if (args[i] === '--save' || args[i] === '--no-save') {
      // always save in propose mode — ignore
    } else {
      filtered.push(args[i])
    }
  }

  return { prompt: filtered.join(' ').trim(), proposalType, titleOverride, doctrineReview }
}

function isWarningIssue(issue: string): boolean {
  return issue.startsWith('WARN:')
}

function mergeValidationIssues(adversaryViolations: string[], contentIssues: string[]): {
  allIssues: string[]
  status: 'pass' | 'warning' | 'fail'
} {
  const allIssues = [...new Set([...adversaryViolations, ...contentIssues])]
  const hasFail = allIssues.some((issue) => !isWarningIssue(issue))
  const hasWarn = allIssues.some((issue) => isWarningIssue(issue))

  return {
    allIssues,
    status: hasFail ? 'fail' : hasWarn ? 'warning' : 'pass',
  }
}

function proposalSupportsCreativeTreatment(proposalType: ProposalType): boolean {
  return [
    'adversary',
    'place',
    'encounter',
    'scene',
    'npc',
    'item',
    'chapter-outline',
  ].includes(proposalType)
}

function creativeTreatmentForcedForProposal(
  proposalType: ProposalType,
  doctrineReviewFlag: boolean | null,
): boolean {
  return proposalType === 'adversary' && doctrineReviewFlag === true
}

function validateAndRepairAdversaryProposal(input: {
  outputText: string
  prompt: string
  requestedBase: string | null
  baseContent: string | null
}): {
  outputText: string
  validation: ReturnType<typeof validateAdversaryOutput>
  constraints: ReturnType<typeof extractProposalConstraints>
  autoRepaired: boolean
  repairCount: number
} {
  const constraints = extractProposalConstraints(input.prompt, input.requestedBase)
  let outputText = input.outputText

  if (constraints.lockedFaction) {
    outputText = repairFactionMetadata(outputText, constraints)
  }

  const validation = validateAdversaryOutput(
    outputText,
    input.requestedBase,
    input.baseContent,
    input.prompt,
    constraints,
  )

  let finalValidation = validation
  let autoRepaired = false
  let repairCount = 0

  if (!validation.valid) {
    const repaired = repairAdversaryOutput(outputText, validation, input.baseContent, constraints)
    const revalidation = validateAdversaryOutput(
      repaired,
      input.requestedBase,
      input.baseContent,
      input.prompt,
      constraints,
    )

    if (revalidation.violations.length < validation.violations.length) {
      outputText = repaired
      finalValidation = revalidation
      autoRepaired = true
      repairCount = validation.violations.length - revalidation.violations.length
    }
  }

  return {
    outputText,
    validation: finalValidation,
    constraints,
    autoRepaired,
    repairCount,
  }
}

function buildAdversaryCreativeContext(input: {
  prompt: string
  lockedFaction: string | null
  forbiddenFactions: string[]
  relatedAdversaries: ReturnType<typeof loadContextAdversaries>
  firstPassIssues: string[]
}): string {
  const lines = [
    `Original prompt: ${input.prompt}`,
    `Locked faction: ${input.lockedFaction ?? '(none)'}`,
    `Forbidden factions: ${input.forbiddenFactions.join(', ') || '(none)'}`,
  ]

  if (input.relatedAdversaries.length > 0) {
    lines.push('Relevant adversary examples:')
    for (const adversary of input.relatedAdversaries.slice(0, 3)) {
      lines.push(`- ${adversary.id}: ${adversary.summary}`)
      if (adversary.tactics.length > 0) lines.push(`  tactics: ${adversary.tactics.slice(0, 3).join(' | ')}`)
      if (adversary.dmOnly.length > 0) lines.push(`  dm-only: ${adversary.dmOnly.slice(0, 2).join(' | ')}`)
    }
  }

  if (input.firstPassIssues.length > 0) {
    lines.push('First-pass deterministic validation:')
    for (const issue of input.firstPassIssues) lines.push(`- ${issue}`)
  }

  return lines.join('\n')
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { prompt, proposalType: explicitType, titleOverride, doctrineReview: doctrineReviewFlag } = parseArgs()

  if (!prompt) {
    console.error('Usage: npm run karsac:propose -- [--type <type>] [--title "<title>"] [--doctrine-review] "<prompt>"')
    process.exit(1)
  }

  // ── Route resolution ────────────────────────────────────────────────────────
  // Two-stage: (1) context route for state/retrieval; (2) proposal-type route
  // for the actual artefact. We display them separately so "Route: state" does
  // not appear as the primary route when the proposal is for a place or other
  // non-state type.

  let proposalType: ProposalType
  let routeProfile: string   // proposal profile (place-design, adversary-design, …)

  if (explicitType) {
    proposalType = explicitType
    routeProfile = profileForExplicitType(explicitType)
    process.stderr.write(`\nProposal type: ${proposalType} (explicit --type)\n`)
    process.stderr.write(`Proposal profile: ${routeProfile}\n`)
  } else {
    const plan = detectProposalExecutionPlan(prompt)
    proposalType = plan.proposalType
    routeProfile = plan.proposalProfile
    const contextProfile = plan.contextProfile
    const proposalOverridesContext = routeProfile !== contextProfile
    if (proposalOverridesContext) {
      process.stderr.write(`\nContext route: ${plan.contextProfile} — ${plan.routeReason}\n`)
    } else {
      process.stderr.write(`\nRoute: ${plan.contextProfile} — ${plan.routeReason}\n`)
    }

    const placeMatched = plan.placeMatchedTerms
    const adversaryMatched = plan.adversaryMatchedTerms
    process.stderr.write(`Proposal type: ${proposalType}`)
    if (placeMatched.length > 0)     process.stderr.write(` — matched place terms: ${placeMatched.join(', ')}`)
    if (adversaryMatched.length > 0) process.stderr.write(` — matched adversary terms: ${adversaryMatched.join(', ')}`)
    process.stderr.write('\n')
    if (proposalOverridesContext) {
      process.stderr.write(`Proposal profile: ${routeProfile}\n`)
    }
  }

  // routeProfile used in frontmatter
  const frontmatterRouteProfile = proposalType === 'place' ? 'place-design'
    : proposalType === 'adversary'  ? 'adversary-design'
    : proposalType === 'encounter'  ? 'encounter-design'
    : routeProfile

  // Build messages and call model
  let messages: Array<{ role: string; content: string }>
  let model = DEFAULT_MODEL
  let temperature = DRAFT_SETTINGS.temperature
  let topP = DRAFT_SETTINGS.topP
  let adversaryCtx: {
    requestedBase: string | null
    baseFile: ReturnType<typeof loadBaseFile>
    relatedAdversaries: ReturnType<typeof loadContextAdversaries>
  } | null = null

  if (proposalType === 'adversary') {
    // Extract pre-generation constraints BEFORE building the prompt
    const requestedBase = detectRequestedBase(prompt)
    const constraints = extractProposalConstraints(prompt, requestedBase)

    // Log the locked constraints so the DM can see what was extracted
    if (constraints.lockedFaction) {
      process.stderr.write(`  Locked faction: ${constraints.lockedFaction}\n`)
      if (constraints.forbiddenFactions.length > 0) {
        process.stderr.write(`  Forbidden factions: ${constraints.forbiddenFactions.join(', ')}\n`)
      }
    }
    if (constraints.preferredBase) {
      process.stderr.write(`  Preferred base: ${constraints.preferredBase}\n`)
    }
    if (constraints.variantOptionsRequired) {
      const r = constraints.modularChoiceRule
      process.stderr.write(`  Variant options required: traits×${r?.traits ?? 2}, actions×${r?.actions ?? 1}, reactions×${r?.reactions ?? 1}\n`)
    }

    const ctx = {
      requestedBase: requestedBase ?? constraints.preferredBase,
      baseFile: null as any,
      relatedAdversaries: loadContextAdversaries(ADVERSARY_CORPUS_ROOT, prompt),
      stateData: {
        campaignState: readStateFile('campaign-state.json'),
        worldThreads: readStateFile('world-threads.json'),
        npcsState: readStateFile('npcs-state.json'),
      },
    }
    const baseToLoad = ctx.requestedBase ?? constraints.preferredBase
    if (baseToLoad) {
      ctx.baseFile = loadBaseFile(baseToLoad, resolve(STATE_ROOT, '../../corpus/collections'))
      if (ctx.baseFile) process.stderr.write(`  Base file loaded: ${ctx.baseFile.id}\n`)
    }
    adversaryCtx = {
      requestedBase: ctx.requestedBase,
      baseFile: ctx.baseFile,
      relatedAdversaries: ctx.relatedAdversaries,
    }
    messages = buildAdversaryDesignMessages(ctx, prompt, constraints)
    model = process.env.ADVERSARY_MODEL ?? DEFAULT_MODEL
    temperature = DRAFT_SETTINGS.temperature
    topP = DRAFT_SETTINGS.topP
  } else if (proposalType === 'encounter') {
    const adversaries = loadScoredAdversaries(ADVERSARY_CORPUS_ROOT, prompt, 3)
    const patterns = loadScoredPatterns(ENCOUNTER_PATTERNS_ROOT, prompt, 2)
    const allBases = [...new Set(adversaries.flatMap(a => a.mechanicalBase))]
    const npcBases = getNpcBaseSummaries(allBases)
    const ctx = {
      adversaries,
      patterns,
      npcBases,
      stateData: {
        campaignState: readStateFile('campaign-state.json'),
        partyState: readStateFile('party-state.json'),
        worldThreads: readStateFile('world-threads.json'),
        playerKnowledge: readStateFile('player-knowledge.json'),
      },
    }
    messages = buildEncounterDesignMessages(ctx, prompt)
    model = process.env.ENCOUNTER_MODEL ?? DEFAULT_MODEL
    temperature = DRAFT_SETTINGS.temperature
    topP = DRAFT_SETTINGS.topP
  } else if (proposalType === 'place') {
    const campaignState   = readStateFile('campaign-state.json')
    const worldThreads    = readStateFile('world-threads.json')
    const npcsState       = readStateFile('npcs-state.json')
    messages = buildPlaceMessages({ stateData: { campaignState, worldThreads, npcsState } }, prompt)
    model = process.env.PLACE_MODEL ?? DEFAULT_MODEL
    temperature = DRAFT_SETTINGS.temperature
    topP = DRAFT_SETTINGS.topP
  } else if (proposalType === 'npc') {
    const campaignState = readStateFile('campaign-state.json')
    const worldThreads = readStateFile('world-threads.json')
    const npcsState = readStateFile('npcs-state.json')
    messages = buildNpcDesignMessages({ stateData: { campaignState, worldThreads, npcsState } }, prompt)
    model = process.env.NPC_MODEL ?? DEFAULT_MODEL
    temperature = DRAFT_SETTINGS.temperature
    topP = DRAFT_SETTINGS.topP
  } else {
    // chapter-outline and everything else default
    const stateData = loadChapterOutlineContext()
    messages = buildChapterOutlineMessages({ stateData }, prompt)
    model = process.env.CHAPTER_MODEL ?? DEFAULT_MODEL
    temperature = DRAFT_SETTINGS.temperature
    topP = DRAFT_SETTINGS.topP
  }

  process.stderr.write(`Generating ${proposalType} proposal...\n`)
  const output = await callOllama(messages, { silent: true, model, temperature, topP })

  // Validate output
  const title = titleOverride ?? extractTitle(output, proposalType, prompt)
  const slug = slugify(title)
  const now = new Date().toISOString()

  // Deterministic validation / repair before optional creative treatment
  let finalOutput = output
  let proposalStructuralIssues: string[] = []
  let treatmentIssues: string[] = []
  let treatmentApplied = false
  const treatmentLockedConstraints = {
    proposalType,
    title,
    lockedFaction: null as string | null,
    forbiddenFactions: [] as string[],
    preferredMechanicalBase: null as string | null,
    canonicalStatus: 'provisional',
    sourcePrompt: prompt,
    promoteTarget: PROMOTE_TARGETS[proposalType] ?? '',
    routeProfile: frontmatterRouteProfile,
  }
  if (proposalType === 'adversary') {
    const requestedBase = adversaryCtx?.requestedBase ?? detectRequestedBase(prompt)
    const baseContent = adversaryCtx?.baseFile?.content ?? null
    const reviewed = validateAndRepairAdversaryProposal({
      outputText: finalOutput,
      prompt,
      requestedBase,
      baseContent,
    })

    finalOutput = reviewed.outputText
    proposalStructuralIssues = reviewed.validation.violations
    treatmentLockedConstraints.lockedFaction = reviewed.constraints.lockedFaction
    treatmentLockedConstraints.forbiddenFactions = reviewed.constraints.forbiddenFactions
    treatmentLockedConstraints.preferredMechanicalBase = reviewed.constraints.preferredBase

    if (reviewed.constraints.lockedFaction) {
      process.stderr.write(`  [faction metadata injected: ${reviewed.constraints.lockedFaction}]\n`)
    }
    if (reviewed.autoRepaired) {
      process.stderr.write(`[auto-repaired: ${reviewed.repairCount} issue(s) fixed]\n`)
    }
  }

  const creativeTreatmentShouldRun =
    proposalSupportsCreativeTreatment(proposalType) &&
    (creativeTreatmentEnabled() || creativeTreatmentForcedForProposal(proposalType, doctrineReviewFlag))

  if (creativeTreatmentShouldRun) {
    const creativeModel = process.env.KARSAC_TREATMENT_MODEL?.trim()
      || process.env.KARSAC_CREATIVE_MODEL?.trim()
      || process.env.KARSAC_DRAFT_MODEL?.trim()
      || DEFAULT_MODEL
    process.stderr.write(`Applying creative treatment with ${creativeModel}...\n`)

    const creativeResult = await applyCreativeTreatment({
      proposalType,
      draftMarkdown: finalOutput,
      sourcePrompt: prompt,
      model: creativeModel,
      force: creativeTreatmentForcedForProposal(proposalType, doctrineReviewFlag),
      corpusContext: proposalType === 'adversary'
        ? buildAdversaryCreativeContext({
          prompt,
          lockedFaction: treatmentLockedConstraints.lockedFaction,
          forbiddenFactions: treatmentLockedConstraints.forbiddenFactions,
          relatedAdversaries: adversaryCtx?.relatedAdversaries ?? [],
          firstPassIssues: proposalStructuralIssues,
        })
        : undefined,
      lockedConstraints: treatmentLockedConstraints,
    })

    for (const note of creativeResult.notes) {
      process.stderr.write(`${note}\n`)
    }

    if (creativeResult.treatmentApplied) {
      finalOutput = creativeResult.treatedMarkdown
      treatmentApplied = true
      process.stderr.write(`Creative treatment completed with ${creativeResult.treatmentModel}.\n`)
    }

    treatmentIssues = creativeResult.notes.filter((note) => note.startsWith('FAIL:') || note.startsWith('WARN:'))

    if (proposalType === 'adversary') {
      const requestedBase = adversaryCtx?.requestedBase ?? detectRequestedBase(prompt)
      const baseContent = adversaryCtx?.baseFile?.content ?? null
      const reviewedAfterTreatment = validateAndRepairAdversaryProposal({
        outputText: finalOutput,
        prompt,
        requestedBase,
        baseContent,
      })

      finalOutput = reviewedAfterTreatment.outputText
      proposalStructuralIssues = reviewedAfterTreatment.validation.violations
      if (reviewedAfterTreatment.autoRepaired) {
        process.stderr.write(`[auto-repaired after creative treatment: ${reviewedAfterTreatment.repairCount} issue(s) fixed]\n`)
      }
    }
  }

  if (proposalType === 'adversary' && proposalStructuralIssues.length > 0) {
    process.stderr.write(`\n⚠  Adversary structural issues (${proposalStructuralIssues.length}):\n`)
    for (const issue of proposalStructuralIssues) process.stderr.write(`   · ${issue}\n`)
    process.stderr.write(`   These are recorded in the proposal validation field.\n`)
  }

  const promoteTarget = PROMOTE_TARGETS[proposalType] ?? ''
  const buildInfo = getGatewayBuildInfo()
  const relatedFactions =
    proposalType === 'adversary' && treatmentLockedConstraints.lockedFaction
      ? [treatmentLockedConstraints.lockedFaction]
      : []
  const frontmatter: ProposalFrontmatter = {
    id: `proposals/${slug}`,
    proposal_type: proposalType,
    title,
    status: 'proposed',
    canonical: 'provisional',
    visibility: 'dm-only',
    created_at: now,
    gateway_build: buildInfo.buildId,
    source_prompt: prompt,
    route_profile: frontmatterRouteProfile,
    validation: { status: 'pass', issues: [] },
    related: { chapters: [], sessions: [], factions: relatedFactions, places: [], npcs: [], items: [] },
    promote_target: promoteTarget ?? '',
    summary: title,
  }

  // Merge adversary structural violations + content validation into frontmatter
  process.stderr.write('Validating proposal...\n')
  const contentValidation = validateProposalContent(
    frontmatter as unknown as Record<string, unknown>,
    finalOutput,
    proposalType,
  )
  const creativeValidation = treatmentApplied
    ? validateCreativeTreatment(proposalType, finalOutput)
    : { issues: [] as string[] }
  const { allIssues, status: mergedStatus } = mergeValidationIssues(
    [...proposalStructuralIssues, ...treatmentIssues, ...creativeValidation.issues],
    contentValidation.issues,
  )

  frontmatter.validation = {
    status: mergedStatus,
    issues: allIssues,
  }

  // Write proposal
  const writeResult = writeProposal(
    PROPOSALS_ROOT,
    proposalType,
    title,
    frontmatter,
    finalOutput,
  )

  const finalStatus = frontmatter.validation.status   // merged status (adversary + content)
  const relativePath = relative(PROJECT_ROOT, writeResult.path)

  if (finalStatus === 'fail') {
    process.stderr.write(`\nProposal written with validation failures: ${relativePath}\n`)
    process.stderr.write(`Do not promote until the issues below are fixed.\n`)
  } else {
    process.stderr.write(`\nProposal written: ${relativePath}\n`)
  }
  process.stderr.write(`Slug: ${writeResult.slug}\n`)
  if (writeResult.existed) process.stderr.write(`(slug suffix added to avoid collision)\n`)
  process.stderr.write(`Validation: ${finalStatus}\n`)
  if (allIssues.length > 0) {
    for (const issue of allIssues) {
      process.stderr.write(`  ${issue.slice(0, 120)}\n`)
    }
  }
  process.stderr.write(`Summary: ${frontmatter.summary}\n`)
  process.stderr.write('Summarising proposal...\n')
  const proposalSummary = await summariseProposal({
    proposalPath: writeResult.path,
    mode: 'rich',
    includeValidationDetails: 'collapsible',
    creativePolish: treatmentApplied,
  })
  process.stderr.write(`Summary mode: ${proposalSummary.summaryMode ?? 'rich'}\n`)
  process.stderr.write(`Summary renderer: ${proposalSummary.renderer ?? proposalType}\n`)
  process.stderr.write(`Summary sections found: ${(proposalSummary.sectionsFound ?? []).join(', ') || '(none)'}\n`)
  process.stderr.write(`Human markdown length: ${proposalSummary.humanMarkdown.length}\n`)
  if (proposalType === 'adversary' && proposalSummary.humanMarkdown.length < 1000) {
    process.stderr.write('WARN: Rich summary appears too short; renderer may have fallen back.\n')
  }
  process.stdout.write(`${proposalSummary.humanMarkdown}\n`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
