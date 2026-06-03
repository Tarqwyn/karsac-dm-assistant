import { existsSync, readFileSync } from 'fs'
import matter from 'gray-matter'
import { REGISTRY_ROOT } from '../paths.js'
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
  return load().proposal_types?.[type]?.required_sections ?? []
}

export function getProposalSuggestedSections(type: ProposalType): string[] {
  return load().proposal_types?.[type]?.suggested_sections ?? []
}

export function getRequiredStatBlockFields(type: ProposalType): string[] {
  return load().proposal_types?.[type]?.required_stat_block_fields ?? []
}

export function getCreativeTreatmentContractFromData(type: ProposalType): CreativeTreatmentContract | null {
  const ct = load().proposal_types?.[type]?.creative_treatment
  if (!ct) return null
  return {
    requiredSections: ct.required_sections,
    editableSections: ct.editable_sections,
    instruction: ct.instruction.trimEnd(),
    extraInstruction: ct.extra_instruction?.trimEnd(),
  }
}

export function getDesignRequiredHeadings(): string[] {
  return load().design_required_headings ?? []
}

export function getResponseContractHeadings(profile: string): string[] {
  return load().response_contracts?.[profile]?.required_headings ?? []
}

export function clearProposalContractsCacheForTests(): void {
  cached = null
}
