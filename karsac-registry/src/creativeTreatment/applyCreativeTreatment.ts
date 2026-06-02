import type { ProposalType } from '../proposals/proposalTypes.js'
import {
  creativeTreatmentEnabled,
  getCreativeModel,
  getCreativeGenerationSettings,
  getCreativeRetryGenerationSettings,
} from '../modelSettings.js'
import { callCreativeTreatmentModel } from './creativeModel.js'
import { getCreativeTreatmentContract } from './treatmentContracts.js'
import { buildCreativeTreatmentMessages, type LockedConstraints } from './treatmentPrompts.js'
import { creativeTreatmentQualityCheck, validateCreativeTreatment } from './treatmentValidator.js'

export interface ApplyCreativeTreatmentInput {
  proposalType: ProposalType
  draftMarkdown: string
  sourcePrompt: string
  lockedConstraints: LockedConstraints
  corpusContext?: string
  model?: string
  force?: boolean
}

export interface ApplyCreativeTreatmentResult {
  treatedMarkdown: string
  treatmentModel: string
  treatmentApplied: boolean
  notes: string[]
}

interface ParsedSections {
  preface: string
  order: string[]
  sections: Map<string, string>
}

const ADVERSARY_REQUIRED_SECTION_HEADINGS = [
  '## Design Intent',
  '## Mechanical Base',
  '## Adaptation Summary',
  '## Doctrine',
  '## Doctrine Under Pressure',
  '## Behavioural Stages',
  '## Tactical Notes',
  '## Doctrine-Expressive Mechanics',
  '## Stat Block',
  '## Tactics',
  '## Social / Investigation Use',
  '## Player-Safe Description',
  '## DM-Only Notes',
  '## Corpus Frontmatter',
]

function parseTopLevelSections(markdown: string): ParsedSections {
  const headingMatches = [...markdown.matchAll(/^##\s+[^\n]+$/gm)]
  if (headingMatches.length === 0) {
    return { preface: markdown.trim(), order: [], sections: new Map() }
  }

  const firstIndex = headingMatches[0].index ?? 0
  const preface = markdown.slice(0, firstIndex).trim()
  const order: string[] = []
  const sections = new Map<string, string>()

  for (let i = 0; i < headingMatches.length; i++) {
    const heading = headingMatches[i][0].trim()
    const start = headingMatches[i].index ?? 0
    const end = i + 1 < headingMatches.length ? (headingMatches[i + 1].index ?? markdown.length) : markdown.length
    const block = markdown.slice(start, end).trim()
    order.push(heading)
    sections.set(heading, block)
  }

  return { preface, order, sections }
}

function renderMarkdownFromSections(parsed: ParsedSections): string {
  const blocks = parsed.order
    .map((heading) => parsed.sections.get(heading))
    .filter((block): block is string => Boolean(block))

  const chunks = [parsed.preface, ...blocks].filter((chunk) => chunk.trim().length > 0)
  return `${chunks.join('\n\n').trim()}\n`
}

function mergeCreativeTreatmentSections(
  draftMarkdown: string,
  patchMarkdown: string,
  editableSections: string[],
): string {
  const draft = parseTopLevelSections(draftMarkdown)
  const patch = parseTopLevelSections(patchMarkdown)

  for (const heading of editableSections) {
    const patchedSection = patch.sections.get(heading)
    if (!patchedSection) continue

    if (!draft.sections.has(heading)) {
      draft.order.push(heading)
    }
    draft.sections.set(heading, patchedSection)
  }

  return renderMarkdownFromSections(draft)
}

function getExistingRequiredSectionsForProposal(
  proposalType: ProposalType,
  markdown: string,
): string[] {
  const headings = parseTopLevelSections(markdown).order

  if (proposalType === 'adversary') {
    const required = ADVERSARY_REQUIRED_SECTION_HEADINGS.filter((heading) => headings.includes(heading))
    if (headings.includes('## Variant Options')) required.push('## Variant Options')
    return required
  }

  return []
}

function compareRequiredSectionsBeforeAfter(
  proposalType: ProposalType,
  beforeMarkdown: string,
  afterMarkdown: string,
): string[] {
  const beforeRequired = getExistingRequiredSectionsForProposal(proposalType, beforeMarkdown)
  if (beforeRequired.length === 0) return []

  const afterHeadings = new Set(parseTopLevelSections(afterMarkdown).order)
  return beforeRequired
    .filter((heading) => !afterHeadings.has(heading))
    .map((heading) => `Creative treatment removed required section: ${heading}`)
}

export function extractPrimaryHeading(markdown: string): string | null {
  return markdown.match(/^#\s+[^:]+:\s*(.+)$/im)?.[1]?.trim() ?? null
}

export function extractMechanicalBaseReference(markdown: string): string | null {
  const section = markdown.match(/##\s+Mechanical\s+Base\s*\n([\s\S]*?)(?=\n##\s|\s*$)/i)?.[1] ?? ''
  return section.match(/\bBase:\s*([^\n]+)/i)?.[1]?.trim() ?? null
}

export async function applyCreativeTreatment(
  input: ApplyCreativeTreatmentInput,
): Promise<ApplyCreativeTreatmentResult> {
  const enabled = input.force || creativeTreatmentEnabled()
  const treatmentModel = input.model?.trim() || getCreativeModel()
  const contract = getCreativeTreatmentContract(input.proposalType)

  if (!enabled || !contract) {
    return {
      treatedMarkdown: input.draftMarkdown,
      treatmentModel,
      treatmentApplied: false,
      notes: [enabled ? 'No creative treatment contract for this proposal type.' : 'Creative treatment disabled.'],
    }
  }

  const messages = buildCreativeTreatmentMessages({
    proposalType: input.proposalType,
    draftMarkdown: input.draftMarkdown,
    sourcePrompt: input.sourcePrompt,
    lockedConstraints: input.lockedConstraints,
    corpusContext: input.corpusContext,
  })
  const attemptSettings = [
    { label: 'primary', settings: getCreativeGenerationSettings() },
    { label: 'retry', settings: getCreativeRetryGenerationSettings() },
  ]
  const originalTitle = extractPrimaryHeading(input.draftMarkdown)
  const originalBase = extractMechanicalBaseReference(input.draftMarkdown)
  let qualityRetried = false
  let lastModel = treatmentModel
  let lastQualityIssues: string[] = []

  for (let attemptIndex = 0; attemptIndex < attemptSettings.length; attemptIndex++) {
    const { label, settings } = attemptSettings[attemptIndex]
    const { text, model } = await callCreativeTreatmentModel(messages, treatmentModel, settings)
    lastModel = model
    const treatedMarkdown = mergeCreativeTreatmentSections(input.draftMarkdown, text.trim(), contract.editableSections)
    const notes: string[] = []

    const treatedTitle = extractPrimaryHeading(treatedMarkdown)
    if (originalTitle && treatedTitle && originalTitle !== treatedTitle) {
      return {
        treatedMarkdown: input.draftMarkdown,
        treatmentModel: model,
        treatmentApplied: false,
        notes: ['Creative treatment skipped: revised output changed the proposal title.'],
      }
    }

    const treatedBase = extractMechanicalBaseReference(treatedMarkdown)
    if (originalBase && treatedBase && originalBase !== treatedBase) {
      return {
        treatedMarkdown: input.draftMarkdown,
        treatmentModel: model,
        treatmentApplied: false,
        notes: ['Creative treatment skipped: revised output changed the mechanical base reference.'],
      }
    }

    const removedRequiredSections = compareRequiredSectionsBeforeAfter(
      input.proposalType,
      input.draftMarkdown,
      treatedMarkdown,
    )
    if (removedRequiredSections.length > 0) {
      return {
        treatedMarkdown: input.draftMarkdown,
        treatmentModel: model,
        treatmentApplied: false,
        notes: removedRequiredSections.map((issue) => `FAIL: ${issue}`),
      }
    }

    const treatmentValidation = validateCreativeTreatment(input.proposalType, treatedMarkdown)
    const qualityValidation = creativeTreatmentQualityCheck(input.proposalType, treatedMarkdown)
    notes.push(...treatmentValidation.issues, ...qualityValidation.issues)

    if (!qualityValidation.valid) {
      lastQualityIssues = qualityValidation.issues
      if (attemptIndex === 0) {
        qualityRetried = true
        continue
      }
      return {
        treatedMarkdown: input.draftMarkdown,
        treatmentModel: model,
        treatmentApplied: false,
        notes: [
          'Creative treatment failed quality gate and fallback used.',
          ...lastQualityIssues,
        ],
      }
    }

    if (qualityRetried || label === 'retry') {
      notes.unshift('Creative treatment failed quality gate and was retried.')
    }

    return {
      treatedMarkdown,
      treatmentModel: model,
      treatmentApplied: true,
      notes,
    }
  }

  return {
    treatedMarkdown: input.draftMarkdown,
    treatmentModel: lastModel,
    treatmentApplied: false,
    notes: [
      'Creative treatment failed quality gate and fallback used.',
      ...lastQualityIssues,
    ],
  }
}

export {
  compareRequiredSectionsBeforeAfter,
  mergeCreativeTreatmentSections,
  parseTopLevelSections,
}
