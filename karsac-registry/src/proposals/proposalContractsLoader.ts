import { existsSync, readFileSync } from 'fs'
import matter from 'gray-matter'
import { REGISTRY_ROOT } from '../paths.js'
import { guardArray } from '../loaderUtils.js'
import type { ProposalType } from './proposalTypes.js'
import type { CreativeTreatmentContract } from '../creativeTreatment/treatmentContracts.js'

const CONTRACTS_PATH = `${REGISTRY_ROOT}/proposal-contracts.yaml`

interface ProposalTypeEntry {
  folder?: string
  promote_target?: string | null
  required_sections?: string[]
  suggested_sections?: string[]
  required_stat_block_fields?: string[]
  creative_treatment?: {
    required_sections: string[]
    editable_sections: string[]
    instruction: string
    extra_instruction?: string
  }
}

interface ResponseContractEntry {
  required_headings: string[]
}

interface ProposalContractsFile {
  proposal_types?: Record<string, ProposalTypeEntry>
  design_required_headings?: string[]
  response_contracts?: Record<string, ResponseContractEntry>
}

let cached: ProposalContractsFile | null = null

function load(): ProposalContractsFile {
  if (cached) return cached
  if (!existsSync(CONTRACTS_PATH)) {
    cached = {}
    return cached
  }
  const raw = readFileSync(CONTRACTS_PATH, 'utf-8')
  cached = matter(`---\n${raw}\n---`).data as ProposalContractsFile
  return cached
}

export function getProposalFolder(type: ProposalType): string {
  return load().proposal_types?.[type]?.folder ?? type
}

export function getPromoteTarget(type: ProposalType): string | null {
  const entry = load().proposal_types?.[type]
  if (!entry) return null
  return 'promote_target' in entry ? (entry.promote_target ?? null) : null
}

export function getProposalRequiredSections(type: ProposalType): string[] {
  return guardArray<string>(load().proposal_types?.[type]?.required_sections, `${type}.required_sections`)
}

export function getProposalSuggestedSections(type: ProposalType): string[] {
  return guardArray<string>(load().proposal_types?.[type]?.suggested_sections, `${type}.suggested_sections`)
}

export function getRequiredStatBlockFields(type: ProposalType): string[] {
  return guardArray<string>(load().proposal_types?.[type]?.required_stat_block_fields, `${type}.required_stat_block_fields`)
}

export function getCreativeTreatmentContractFromData(type: ProposalType): CreativeTreatmentContract | null {
  const ct = load().proposal_types?.[type]?.creative_treatment
  if (!ct) return null
  const instruction = typeof ct.instruction === 'string' ? ct.instruction.trimEnd() : ''
  const extraInstruction = typeof ct.extra_instruction === 'string' ? ct.extra_instruction.trimEnd() : undefined
  return {
    requiredSections: guardArray<string>(ct.required_sections, `${type}.creative_treatment.required_sections`),
    editableSections: guardArray<string>(ct.editable_sections, `${type}.creative_treatment.editable_sections`),
    instruction,
    extraInstruction,
  }
}

export function getDesignRequiredHeadings(): string[] {
  return guardArray<string>(load().design_required_headings, 'design_required_headings')
}

export function getResponseContractHeadings(profile: string): string[] {
  return guardArray<string>(load().response_contracts?.[profile]?.required_headings, `response_contracts.${profile}.required_headings`)
}

export function clearProposalContractsCacheForTests(): void {
  cached = null
}
