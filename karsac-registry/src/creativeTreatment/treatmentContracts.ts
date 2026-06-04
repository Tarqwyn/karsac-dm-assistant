import type { ProposalType } from '../proposals/proposalTypes.js'
import { getCreativeTreatmentContractFromData } from '../proposals/proposalContractsLoader.js'

export interface CreativeTreatmentContract {
  requiredSections: string[]
  editableSections: string[]
  instruction: string
  extraInstruction?: string
}

export function getCreativeTreatmentContract(proposalType: ProposalType): CreativeTreatmentContract | null {
  return getCreativeTreatmentContractFromData(proposalType) ?? null
}
