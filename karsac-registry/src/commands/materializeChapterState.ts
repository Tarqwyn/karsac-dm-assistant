import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { STATE_ROOT } from '../paths.js'
import { resolveChapterId } from '../state/chapterSelection.js'
import {
  buildChapterBeatsSeed,
  buildChapterFacts,
  buildChapterHandouts,
  buildChapterProgress,
  buildChapterRadar,
  buildChapterScenesSeed,
  buildChapterTriggers,
} from '../state/chapterMigration.js'

type SessionProgressState = {
  currentStep: number
  steps: Array<{
    index: number
    label: string
    pauseLabel: string | null
    pauseClass: string | null
    recap: string[]
  }>
}

type SessionFactsState = {
  facts: Array<{
    id: string
    label: string
    scene: string | null
    desc: string | null
    knowledgeStatus: string
    revealed: boolean
    source: string
    importStatus: string
  }>
}

type SessionHandoutsState = {
  handouts: Array<{
    id: string
    label: string
    scene: string | null
    desc: string | null
    posted: boolean
    visibility: string
    source: string
    importStatus: string
  }>
}

type SessionRadarState = {
  radar: Array<{
    id: string
    nav: string
    worldThreadId: string
    title: string
    surface: string
    relation: string
    hook: string
    cueScenes: string[]
    cueText: string
    currentThreadStatus: string
  }>
}

type SessionTriggersState = {
  triggers: Array<{
    on: string
    id: string
    threadId: string
    setStatus: string
  }>
}

type CampaignState = {
  currentChapter?: number | null
}

type ChapterSeedData = {
  beats?: Array<Record<string, unknown>>
  scenes?: Array<Record<string, unknown>>
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T
}

function writeJson(filePath: string, data: unknown): void {
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8')
  process.stdout.write(`wrote ${filePath}\n`)
}

function chapterDir(chapterId: string): string {
  return join(STATE_ROOT, 'chapters', chapterId)
}

function readChapterSeedData(chapterId: string): ChapterSeedData | null {
  const seedPath = join(chapterDir(chapterId), 'seed.json')
  if (!existsSync(seedPath)) return null
  return readJson<ChapterSeedData>(seedPath)
}

function readArgValue(argv: string[], names: string[]): string | null {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const match = names.find((name) => arg === name || arg.startsWith(`${name}=`))
    if (!match) continue
    if (arg.startsWith(`${match}=`)) return arg.slice(match.length + 1)
    return argv[index + 1] ?? null
  }
  return null
}

function main(): void {
  const campaign = 'karsac'
  const cliChapterId = readArgValue(process.argv.slice(2), ['--chapter-id', '--chapter'])
  const campaignState = readJson<CampaignState>(join(STATE_ROOT, 'campaign-state.json'))
  const chapterId = resolveChapterId({
    chapterId: cliChapterId,
    currentChapter: campaignState.currentChapter ?? null,
  })
  const seedData = readChapterSeedData(chapterId)

  const sessionProgress = readJson<SessionProgressState>(join(STATE_ROOT, 'session-progress', 'session-2.json'))
  const sessionFacts = readJson<SessionFactsState>(join(STATE_ROOT, 'session-facts', 'session-2.json'))
  const sessionHandouts = readJson<SessionHandoutsState>(join(STATE_ROOT, 'handouts', 'session-2.json'))
  const sessionRadar = readJson<SessionRadarState>(join(STATE_ROOT, 'radar', 'session-2.json'))
  const sessionTriggers = readJson<SessionTriggersState>(join(STATE_ROOT, 'triggers', 'session-2-triggers.json'))

  const beats = buildChapterBeatsSeed({
    campaign,
    chapterId,
    source: 'chapter-state migration seed',
    seedData,
  })

  const progress = buildChapterProgress({
    campaign,
    chapterId,
    sessionProgress,
    facts: sessionFacts.facts,
    handouts: sessionHandouts.handouts,
    beats: beats.beats,
    seedData,
  })

  const facts = buildChapterFacts({
    campaign,
    chapterId,
    sessionFacts,
    seedData,
  })

  const handouts = buildChapterHandouts({
    campaign,
    chapterId,
    sessionHandouts,
    seedData,
  })

  const radar = buildChapterRadar({
    campaign,
    chapterId,
    sessionRadar,
    seedData,
  })

  const triggers = buildChapterTriggers({
    campaign,
    chapterId,
    sessionTriggers,
    seedData,
  })

  const scenes = buildChapterScenesSeed({
    campaign,
    chapterId,
    source: 'chapter-state migration seed',
    seedData,
  })

  const outDir = chapterDir(chapterId)
  writeJson(join(outDir, 'progress.json'), progress)
  writeJson(join(outDir, 'facts.json'), facts)
  writeJson(join(outDir, 'handouts.json'), handouts)
  writeJson(join(outDir, 'beats.json'), beats)
  writeJson(join(outDir, 'radar.json'), radar)
  writeJson(join(outDir, 'triggers.json'), triggers)
  writeJson(join(outDir, 'scenes.json'), scenes)
}

main()
