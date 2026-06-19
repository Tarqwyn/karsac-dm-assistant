import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'
import Ajv2020 from 'ajv/dist/2020.js'
import { extractChapterOutlineStructure } from '../src/proposals/chapterOutlineStructure.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '../..')
const SCHEMAS_ROOT = join(PROJECT_ROOT, 'schemas', 'design')

function loadJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, 'utf8'))
}

function addSchemasRecursively(ajv: Ajv2020, dirPath: string): void {
  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = join(dirPath, entry.name)
    if (entry.isDirectory()) {
      addSchemasRecursively(ajv, fullPath)
      continue
    }
    if (!entry.name.endsWith('.json')) continue
    ajv.addSchema(loadJson(fullPath))
  }
}

function getValidator(schemaFile: string) {
  const ajv = new Ajv2020({ allErrors: true, strict: true })
  addSchemasRecursively(ajv, SCHEMAS_ROOT)
  const schemaPath = join(SCHEMAS_ROOT, schemaFile)
  const schema = loadJson(schemaPath) as { $id: string }
  const validate = ajv.getSchema(schema.$id)
  if (!validate) throw new Error(`Schema not registered: ${schemaFile}`)
  return validate
}

describe('chapter outline structure extraction', () => {
  it('parses markdown into a schema-shaped outline object', () => {
    const body = `# Chapter Outline: The Weight of Witness

## Chapter Purpose
To move the party north.

## Starting State
- The party is in Törweg.

## Player Knowledge
- Mathr is the name.
- Valweg is the destination.

## Core Pressure
The route is controlled.

## Starting Emotional State
Unease.

## Central Pressure
The truth must reach Beorn.

## Repeated Motif
Hidden eyes.

## Midpoint Turn
The ferryman's toll reveals the route is watched.

## End State
The party is on the threshold of Valweg.

## What This Chapter Changes
- Jarl Beorn is now on the board.

## Scene Spine
### Scene 1 — Departure / Warning
- Purpose: Get them moving.
- Location: Törweg harbour.
- Pressure: Quiet scrutiny.
- Choices: Leave, delay, ask Brynja.
- Clues: Brynja's note.
- Failure: Delay and scrutiny.
- Exit State: Northbound.

### Scene 2 — Road Pressure
- Purpose: Show route control.
- Location: Ferry.
- Pressure: Costly passage.
- Choices: Pay, negotiate, detour.
- Clues: The toll.
- Failure: Delay.
- Exit State: Route watched.

### Scene 3 — Valweg Threshold
- Purpose: Put them at the gate.
- Location: Valweg roadblock.
- Pressure: Official legitimacy.
- Choices: Enter, bluff, reroute.
- Clues: Mathr's seal.
- Failure: Detained.
- Exit State: Valweg in reach.
`

    const outline = extractChapterOutlineStructure(body, 'chapter-3', 'The Weight of Witness')
    expect(outline.sceneSpine).toHaveLength(3)
    expect(outline.sceneSpine[0].name).toBe('Departure / Warning')
    expect(outline.sceneSpine[0].choices).toContain('Leave, delay, ask Brynja.')
    expect(outline.sceneSpine[2].exitState).toBe('Valweg in reach.')

    const validate = getValidator('campaign-structure-chapter-outline.json')
    expect(validate(outline)).toBe(true)
  })
})
