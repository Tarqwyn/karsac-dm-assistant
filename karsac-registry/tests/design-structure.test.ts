import { readFileSync, readdirSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'
import Ajv2020 from 'ajv/dist/2020.js'
import { describe, expect, it } from 'vitest'

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

function makeAjv(): Ajv2020 {
  const ajv = new Ajv2020({ allErrors: true, strict: true })
  addSchemasRecursively(ajv, SCHEMAS_ROOT)
  return ajv
}

function getValidator(schemaFile: string) {
  const ajv = makeAjv()
  const schemaPath = join(SCHEMAS_ROOT, schemaFile)
  const schema = loadJson(schemaPath) as { $id: string }
  const validate = ajv.getSchema(schema.$id)
  if (!validate) throw new Error(`Schema not registered: ${schemaFile}`)
  return validate
}

describe('design structure schemas', () => {
  it('validates a compact volume/chapter/scene graph', () => {
    const validate = getValidator('campaign-structure.json')
    const payload = {
      volumes: [
        {
          id: 'volume-1',
          title: 'The Shadow Unended',
          spine: [
            {
              id: 'volume-1-turn-1',
              label: 'The road narrows',
              purpose: 'Move the campaign into pressure and witness',
              pressure: 'Legitimacy bends around a hidden authority',
              endState: 'The party knows the trail leads north',
            },
          ],
          themeTags: ['witness', 'corruption'],
          beats: [
            {
              id: 'volume-1-beat-1',
              scope: 'volume',
              kind: 'opening',
              label: 'Volume opening',
              purpose: 'Establish the long arc',
              text: 'The campaign opens in loss and movement.',
            },
          ],
          chapters: [
            {
              id: 'chapter-3',
              title: 'The Weight of Witness',
              spine: [
                {
                  id: 'chapter-3-turn-1',
                  label: 'Leave the town',
                  purpose: 'Force the journey north',
                  pressure: 'Someone controls the route to truth',
                  endState: 'The party is on the road to Valweg',
                },
              ],
              themeTags: ['witness', 'legitimacy'],
              beats: [
                {
                  id: 'chapter-3-beat-1',
                  scope: 'chapter',
                  kind: 'travel',
                  label: 'Departure under pressure',
                  purpose: 'Get the party moving',
                  text: 'Leaving town is quiet, which is worse than being chased.',
                  themeTags: ['witness'],
                },
              ],
              scenes: [
                {
                  id: 'scene1',
                  title: 'Departure / Warning',
                  type: 'scene',
                  summary: 'The party leaves with Mathr named and no clean way back.',
                  spine: [
                    {
                      id: 'scene1-beat-1',
                      label: 'Leave Törweg',
                      purpose: 'Set the opening image',
                      pressure: 'The harbour is quiet',
                      endState: 'The party is in motion',
                    },
                  ],
                  themeTags: ['witness'],
                  beats: [
                    {
                      id: 'scene1-beat-1a',
                      scope: 'scene',
                      kind: 'opening',
                      label: 'Quiet harbour',
                      purpose: 'Show the pressure of leaving',
                      text: 'No one stops them; that is the problem.',
                    },
                  ],
                  facts: ['fact-1'],
                  handouts: ['handout-1'],
                  cast: [{ id: 'brynja', type: 'npc', label: 'Brynja' }],
                  adversaries: [{ id: 'mathr-agent', type: 'adversary', label: 'Mathr Agent' }],
                  threads: [{ id: 'thread-mathr', type: 'thread', label: 'Mathr Influence' }],
                  subscenes: [{ id: 'scene1-thread', type: 'thread', label: 'Road pressure thread' }],
                  timer: { kind: 'clock', label: 'Departure clock', limit: 3 },
                },
              ],
            },
          ],
        },
      ],
      globalEntities: {
        threads: [{ id: 'thread-mathr', type: 'thread', label: 'Mathr Influence', primarySceneId: 'scene1' }],
        npcs: [{ id: 'brynja', type: 'npc', label: 'Brynja', primarySceneId: 'scene1' }],
        adversaries: [{ id: 'mathr-agent', type: 'adversary', label: 'Mathr Agent', primarySceneId: 'scene1' }],
        playerCharacters: [{ id: 'korvann', type: 'player-character', label: 'Korvann', primarySceneId: 'scene1' }],
        items: [{ id: 'bone-disc', type: 'item', label: 'Bone Disc', primarySceneId: 'scene1' }],
        places: [{ id: 'torweg', type: 'place', label: 'Törweg', primarySceneId: 'scene1' }],
        factions: [{ id: 'mathr-household', type: 'faction', label: 'Mathr Household', primarySceneId: 'scene1' }],
        events: [{ id: 'south-dock', type: 'event', label: 'South Dock Encounter', primarySceneId: 'scene1' }],
      },
      themes: {
        themes: [
          { id: 'witness', label: 'Witness', summary: 'What it means to see and be believed.' },
          { id: 'corruption', label: 'Corruption', summary: 'Authority bent around concealment.' },
        ],
      },
    }

    expect(validate(payload)).toBe(true)
  })

  it('validates the reusable beat schema', () => {
    const validate = getValidator('campaign-structure-beat.json')
    expect(validate({
      id: 'beat-1',
      scope: 'scene',
      kind: 'clue',
      label: 'A clue lands',
      purpose: 'Give the table a concrete lead',
      text: 'The clue is spoken aloud in the wrong room.',
      themeTags: ['witness'],
    })).toBe(true)
  })

  it('validates the typed global entity schemas', () => {
    expect(getValidator('campaign-structure-thread.json')({
      id: 'thread-1',
      type: 'thread',
      label: 'Mathr Influence',
      source: 'chapter-3',
      status: 'active',
    })).toBe(true)

    expect(getValidator('campaign-structure-npc.json')({
      id: 'npc-1',
      type: 'npc',
      label: 'Brynja',
      role: 'Archivist',
      status: 'active',
      factionIds: ['mathr-household'],
    })).toBe(true)

    expect(getValidator('campaign-structure-adversary.json')({
      id: 'adv-1',
      type: 'adversary',
      label: 'Mathr Agent',
      threat: 'Quiet surveillance',
      status: 'active',
      factionIds: ['mathr-household'],
    })).toBe(true)

    expect(getValidator('campaign-structure-player-character.json')({
      id: 'pc-1',
      type: 'player-character',
      label: 'Korvann',
      playerName: 'Player One',
      partyRole: 'Investigator',
      status: 'active',
    })).toBe(true)

    expect(getValidator('campaign-structure-item.json')({
      id: 'item-1',
      type: 'item',
      label: 'Bone Disc',
      kind: 'artefact',
      status: 'relevant',
      ownerId: 'npc-1',
    })).toBe(true)

    expect(getValidator('campaign-structure-place.json')({
      id: 'place-1',
      type: 'place',
      label: 'Törweg',
      kind: 'city',
      region: 'Lösweg',
      status: 'active',
    })).toBe(true)

    expect(getValidator('campaign-structure-faction.json')({
      id: 'faction-1',
      type: 'faction',
      label: 'Mathr Household',
      kind: 'household',
      status: 'active',
      leaderId: 'npc-1',
    })).toBe(true)

    expect(getValidator('campaign-structure-event.json')({
      id: 'event-1',
      type: 'event',
      label: 'South Dock Encounter',
      when: 'chapter-3',
      status: 'planned',
      sceneIds: ['scene1'],
    })).toBe(true)
  })
})
