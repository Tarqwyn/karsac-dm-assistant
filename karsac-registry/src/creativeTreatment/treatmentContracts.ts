import type { ProposalType } from '../proposals/proposalTypes.js'
import { getCreativeTreatmentContractFromData } from '../proposals/proposalContractsLoader.js'

export interface CreativeTreatmentContract {
  requiredSections: string[]
  editableSections: string[]
  instruction: string
  extraInstruction?: string
}

const CONTRACTS: Partial<Record<ProposalType, CreativeTreatmentContract>> = {
  adversary: {
    requiredSections: [
      '## Doctrine',
      '## Doctrine Under Pressure',
      '## Behavioural Stages',
      '## Tactical Notes',
    ],
    editableSections: [
      '## Doctrine',
      '## Doctrine Under Pressure',
      '## Behavioural Stages',
      '## Tactical Notes',
      '## Player-Safe Description',
      '## DM-Only Notes',
    ],
    instruction: `Add or improve:
- Doctrine
- Doctrine Under Pressure
- Behavioural Stages
- Tactical Notes
- What It Will Not Do
- Player-Safe Description
- DM-Only Notes`,
    extraInstruction: `An adversary must have doctrine. It should not just be a stat block. The doctrine must explain how the adversary thinks, what it protects, when it retreats, what it refuses to do, and which mechanics express that behaviour. Ensure the mechanics support the doctrine under pressure from a combat-optimised party. Do not give the adversary a doctrine it cannot enact mechanically. You are only patching doctrine/prose sections; do not rewrite mechanical stat block sections directly.`,
  },
  place: {
    requiredSections: [
      '## Cultural Identity',
      '## Daily Life',
      '## Power Structures',
      '## Local Contradiction',
      '## What Outsiders Misunderstand',
      '## What This Place Hides',
      '## Player-Safe Arrival Description',
    ],
    editableSections: [
      '## Cultural Identity',
      '## Daily Life',
      '## Power Structures',
      '## Local Contradiction',
      '## What Outsiders Misunderstand',
      '## What This Place Hides',
      '## Player-Safe Arrival Description',
    ],
    instruction: `Add or improve:
- Cultural Identity
- Daily Life
- Power Structures
- Local Contradiction
- What Outsiders Misunderstand
- What This Place Hides
- Player-Safe Arrival Description`,
    extraInstruction: `A place must have cultural identity. It should not just be a list of districts. It must explain how people live, what the place values, who has power, what tension defines it, and what outsiders misunderstand.`,
  },
  encounter: {
    requiredSections: [
      '## Story Beat',
      '## Pressure',
      '## Player Choice',
      '## Complication',
      '## Consequence',
      '## Fail-Forward Path',
    ],
    editableSections: [
      '## Story Beat',
      '## Pressure',
      '## Player Choice',
      '## Complication',
      '## Consequence',
      '## Fail-Forward Path',
    ],
    instruction: `Add or improve:
- Story Beat
- Pressure
- Player Choice
- Complication
- Consequence
- Fail-Forward Path`,
    extraInstruction: `An encounter must be a story beat. It should not just place NPCs in a location. It must create pressure, choice, complication, and consequence.`,
  },
  scene: {
    requiredSections: [
      '## Scene Purpose',
      '## Opening Image',
      '## Dramatic Question',
      '## Escalation',
      '## Turn',
      '## Exit State',
    ],
    editableSections: [
      '## Scene Purpose',
      '## Opening Image',
      '## Dramatic Question',
      '## Escalation',
      '## Turn',
      '## Exit State',
    ],
    instruction: `Add or improve:
- Scene Purpose
- Opening Image
- Dramatic Question
- Escalation
- Turn
- Exit State`,
  },
  npc: {
    requiredSections: [
      '## Public Face',
      '## Private Want',
      '## Fear',
      '## Contradiction',
      '## Pressure Point',
      '## What They Reveal Under Stress',
    ],
    editableSections: [
      '## Public Face',
      '## Private Want',
      '## Fear',
      '## Contradiction',
      '## Pressure Point',
      '## What They Reveal Under Stress',
    ],
    instruction: `Add or improve:
- Public Face
- Private Want
- Fear
- Contradiction
- Pressure Point
- What They Reveal Under Stress`,
  },
  item: {
    requiredSections: [
      '## What It Appears To Be',
      '## What It Represents',
      '## Cost or Temptation',
      '## First Sign',
      '## Future Growth',
    ],
    editableSections: [
      '## What It Appears To Be',
      '## What It Represents',
      '## Cost or Temptation',
      '## First Sign',
      '## Future Growth',
    ],
    instruction: `Add or improve:
- What It Appears To Be
- What It Represents
- Cost or Temptation
- First Sign
- Future Growth`,
  },
  'chapter-outline': {
    requiredSections: [
      '## Starting Emotional State',
      '## Central Pressure',
      '## Repeated Motif',
      '## Midpoint Turn',
      '## End State',
      '## What This Chapter Changes',
    ],
    editableSections: [
      '## Starting Emotional State',
      '## Central Pressure',
      '## Repeated Motif',
      '## Midpoint Turn',
      '## End State',
      '## What This Chapter Changes',
    ],
    instruction: `Add or improve:
- Starting Emotional State
- Central Pressure
- Repeated Motif
- Midpoint Turn
- End State
- What This Chapter Changes`,
  },
}

export function getCreativeTreatmentContract(proposalType: ProposalType): CreativeTreatmentContract | null {
  return getCreativeTreatmentContractFromData(proposalType) ?? CONTRACTS[proposalType] ?? null
}
