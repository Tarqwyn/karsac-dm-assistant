import { existsSync, readFileSync, readdirSync } from 'fs'
import { join, resolve } from 'path'
import matter from 'gray-matter'
import type { ChapterOutlineStructure } from '../proposals/chapterOutlineStructure.js'
import { cleanInlineMarkdown, extractSection, firstParagraph } from '../proposals/renderers/markdownHelpers.js'

export interface ChapterSeedBeat {
  id: string
  label: string
  scene: string
  desc: string
}

export interface ChapterSeedScene {
  id: string
  label: string
  kind: string
  order: number
  meta: string
  title: string
  summary: string
  facts: string[]
  handouts: string[]
  beats: string[]
  blocks: Array<Record<string, unknown>>
  notesMd?: string | null
}

export interface ChapterSeedData {
  beats: ChapterSeedBeat[]
  scenes: ChapterSeedScene[]
}

export interface ChapterSeedRelatedEntity {
  chapters?: string[]
  scenes?: string[]
  factions?: string[]
  places?: string[]
  npcs?: string[]
  items?: string[]
  adversaries?: string[]
  threads?: string[]
  events?: string[]
}

interface PlanningSceneDocument {
  title: string
  proposalType: string
  summary: string
  related: ChapterSeedRelatedEntity
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function titleCase(text: string): string {
  return text
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function labelForRelatedId(id: string): string {
  const clean = String(id || '').trim()
  if (!clean) return ''
  const parts = clean.split('/')
  const last = parts[parts.length - 1] || clean
  return titleCase(last.replace(/[-_]+/g, ' '))
}

function normalizeLabel(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function loadPlanningSceneDocuments(projectRoot: string): PlanningSceneDocument[] {
  const scenesDir = resolve(projectRoot, 'corpus', 'planning', 'scenes')
  if (!existsSync(scenesDir)) return []

  const docs: PlanningSceneDocument[] = []
  for (const entry of readdirSync(scenesDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue
    const raw = readFileSync(join(scenesDir, entry.name), 'utf8')
    const parsed = matter(raw)
    const title = cleanInlineMarkdown(String(parsed.data?.title ?? '').trim()) || cleanInlineMarkdown(entry.name.replace(/\.md$/, ''))
    const proposalType = cleanInlineMarkdown(String(parsed.data?.proposal_type ?? '').trim())
    const purpose = firstParagraph(extractSection(parsed.content, ['Campaign Purpose', 'Chapter Purpose']))
    const opening = firstParagraph(extractSection(parsed.content, ['Opening Beat', 'Story Beat']))
    const summary = [purpose, opening].filter(Boolean).join(' ').trim()
    const relatedRaw = (parsed.data?.related && typeof parsed.data.related === 'object') ? parsed.data.related as Record<string, unknown> : {}
    const related: ChapterSeedRelatedEntity = {
      npcs: Array.isArray(relatedRaw.npcs) ? relatedRaw.npcs.map(String) : [],
      adversaries: Array.isArray(relatedRaw.adversaries) ? relatedRaw.adversaries.map(String) : [],
      items: Array.isArray(relatedRaw.items) ? relatedRaw.items.map(String) : [],
      places: Array.isArray(relatedRaw.places) ? relatedRaw.places.map(String) : [],
      factions: Array.isArray(relatedRaw.factions) ? relatedRaw.factions.map(String) : [],
      events: Array.isArray(relatedRaw.events) ? relatedRaw.events.map(String) : [],
      threads: Array.isArray(relatedRaw.threads) ? relatedRaw.threads.map(String) : [],
      scenes: Array.isArray(relatedRaw.scenes) ? relatedRaw.scenes.map(String) : [],
      chapters: Array.isArray(relatedRaw.chapters) ? relatedRaw.chapters.map(String) : [],
    }
    docs.push({ title, proposalType, summary, related })
  }
  return docs
}

function scorePlanningSceneMatch(sceneName: string, docTitle: string): number {
  const scene = normalizeLabel(sceneName)
  const doc = normalizeLabel(docTitle)
  if (!scene || !doc) return 0
  if (scene === doc) return 3
  if (doc.endsWith(scene) || scene.endsWith(doc)) return 2
  if (doc.includes(scene) || scene.includes(doc)) return 1
  return 0
}

function findPlanningSceneDocument(sceneName: string, docs: PlanningSceneDocument[]): PlanningSceneDocument | null {
  let best: PlanningSceneDocument | null = null
  let bestScore = 0
  for (const doc of docs) {
    const score = scorePlanningSceneMatch(sceneName, doc.title)
    if (score > bestScore) {
      best = doc
      bestScore = score
    }
  }
  return best
}

function relatedTargetForKind(kind: string): string {
  if (kind === 'npc') return 'cast'
  if (kind === 'adversary') return 'stats'
  return 'scene-reference'
}

function buildEntityLinkCards(doc: PlanningSceneDocument): Array<Record<string, unknown>> {
  const cards: Array<Record<string, unknown>> = []
  const pushKind = (kind: keyof ChapterSeedRelatedEntity, tone: 'high' | 'low' = 'low') => {
    for (const id of doc.related[kind] ?? []) {
      cards.push({
        label: labelForRelatedId(id),
        tone,
        targetScene: relatedTargetForKind(kind),
        bodyHtml: `<code>${escapeHtml(kind)}</code> <code>${escapeHtml(id)}</code>`,
      })
    }
  }

  pushKind('npcs', 'low')
  pushKind('adversaries', 'high')
  pushKind('items', 'low')
  pushKind('places', 'low')
  pushKind('factions', 'low')
  pushKind('events', 'low')
  pushKind('threads', 'low')
  return cards
}

function buildRelatedReferenceBlocks(
  outline: ChapterOutlineStructure,
  related: ChapterSeedRelatedEntity,
): Array<Record<string, unknown>> {
  const sceneLookup = new Map(outline.sceneSpine.map((scene, index) => [scene.id, { scene, index }]))
  const blocks: Array<Record<string, unknown>> = []

  const relatedScenes = (related.scenes ?? [])
    .map((sceneId) => {
      const match = sceneLookup.get(sceneId)
      if (!match) return null
      return {
        sceneId,
        title: match.scene.name,
        summary: `${match.scene.purpose} ${match.scene.exitState}`.trim(),
        label: `Scene ${match.index + 1}`,
      }
    })
    .filter((entry): entry is { sceneId: string; title: string; summary: string; label: string } => Boolean(entry))

  if (relatedScenes.length > 0) {
    blocks.push({
      type: 'scene-links',
      heading: 'Related Chapter Scenes',
      items: relatedScenes,
    })
  }

  const relatedCards = [
    ...((related.npcs ?? []).map((id) => ({ kind: 'npc', id }))),
    ...((related.adversaries ?? []).map((id) => ({ kind: 'adversary', id }))),
    ...((related.items ?? []).map((id) => ({ kind: 'item', id }))),
    ...((related.places ?? []).map((id) => ({ kind: 'place', id }))),
    ...((related.factions ?? []).map((id) => ({ kind: 'faction', id }))),
    ...((related.events ?? []).map((id) => ({ kind: 'event', id }))),
    ...((related.threads ?? []).map((id) => ({ kind: 'thread', id }))),
  ].map((entry) => ({
    label: labelForRelatedId(entry.id),
    tone: entry.kind === 'adversary' ? 'high' : 'low',
    bodyHtml: `<code>${escapeHtml(entry.kind)}</code> <code>${escapeHtml(entry.id)}</code>`,
  }))

  if (relatedCards.length > 0) {
    blocks.push({
      type: 'path-cards',
      heading: 'Related Entities',
      items: relatedCards,
    })
  }

  return blocks
}

export function buildChapterSeedFromOutline(
  outline: ChapterOutlineStructure,
  related: ChapterSeedRelatedEntity = {},
  projectRoot = process.cwd(),
): ChapterSeedData {
  const chapterNumber = outline.id.match(/^chapter-(\d+)/i)?.[1] ?? outline.id
  const planningSceneDocs = loadPlanningSceneDocuments(projectRoot)

  const beats: ChapterSeedBeat[] = outline.sceneSpine.map((scene) => ({
    id: `${scene.id}-beat`,
    label: scene.name,
    scene: scene.id,
    desc: `${scene.purpose} ${scene.exitState}`.trim(),
  }))

  const scenes: ChapterSeedScene[] = outline.sceneSpine.map((scene, index) => {
    const beatId = `${scene.id}-beat`
    const isFirst = index === 0
    const isLast = index === outline.sceneSpine.length - 1
    const blocks: Array<Record<string, unknown>> = [
      { type: 'heading', text: scene.name },
      {
        type: 'paragraph',
        bodyHtml: `<strong>Location:</strong> ${escapeHtml(scene.location)}<br><strong>Purpose:</strong> ${escapeHtml(scene.purpose)}<br><strong>Pressure:</strong> ${escapeHtml(scene.pressure)}`,
      },
    ]

    const supportDoc = findPlanningSceneDocument(scene.name, planningSceneDocs)
    if (supportDoc) {
      blocks.push({
        type: 'path-cards',
        heading: 'Supporting Encounter',
        items: [
          {
            label: supportDoc.title,
            tone: 'high',
            targetScene: 'scene-reference',
            bodyHtml: `<code>${escapeHtml(supportDoc.proposalType || 'scene')}</code>${supportDoc.summary ? `<br>${escapeHtml(supportDoc.summary)}` : ''}`,
          },
        ],
      })
      const entityCards = buildEntityLinkCards(supportDoc)
      if (entityCards.length > 0) {
        blocks.push({
          type: 'path-cards',
          heading: 'Linked Entities',
          items: entityCards,
        })
      }
    }

    if (scene.choices.length > 0) {
      blocks.push({
        type: 'list',
        heading: 'Choices',
        style: 'bullet',
        itemsHtml: scene.choices.map((choice) => escapeHtml(choice)),
      })
    }

    if (scene.clues.length > 0) {
      blocks.push({
        type: 'list',
        heading: 'Clues',
        style: 'bullet',
        itemsHtml: scene.clues.map((clue) => escapeHtml(clue)),
      })
    }

    blocks.push(
      {
        type: 'callout',
        variant: 'dm-only',
        label: 'Failure',
        bodyHtml: escapeHtml(scene.failure),
      },
      {
        type: 'callout',
        variant: 'conditional',
        label: 'Exit State',
        bodyHtml: escapeHtml(scene.exitState),
      },
      {
        type: 'actions',
        label: 'Track the beat',
        actions: [
          {
            kind: 'beat',
            id: beatId,
            label: scene.name,
          },
        ],
      },
    )

    return {
      id: scene.id,
      label: `${index + 1} · ${scene.name}`,
      kind: isFirst ? 'opening' : isLast ? 'closing' : 'scene',
      order: (index + 1) * 10,
      meta: `Chapter ${chapterNumber} · ${scene.location}`,
      title: scene.name,
      summary: `${scene.purpose} ${scene.exitState}`.trim(),
      facts: [],
      handouts: [],
      beats: [beatId],
      blocks,
      notesMd: scene.notes ?? null,
    }
  })

  const referenceBlocks = buildRelatedReferenceBlocks(outline, related)
    if (referenceBlocks.length > 0) {
    const referenceScene: ChapterSeedScene = {
      id: 'scene-reference',
      label: 'Reference',
      kind: 'reference',
      order: outline.sceneSpine.length * 10 + 5,
      meta: `Chapter ${chapterNumber} · Reference`,
      title: 'Reference',
      summary: 'Related proposals and entities that frame this chapter.',
      facts: [],
      handouts: [],
      beats: [],
      blocks: [
        { type: 'heading', text: 'Reference' },
        { type: 'paragraph', bodyHtml: 'Use these links to keep the chapter outline aligned with supporting proposals and chapter-level dependencies.' },
        {
          type: 'path-cards',
          heading: 'Chapter References',
          items: [
            { label: 'Full Cast', tone: 'low', targetScene: 'cast', bodyHtml: '<code>chapter</code> <code>cast</code>' },
            { label: 'Stat Blocks', tone: 'high', targetScene: 'stats', bodyHtml: '<code>chapter</code> <code>stats</code>' },
          ],
        },
        ...referenceBlocks,
      ],
      notesMd: 'Auto-generated from chapter outline related metadata.',
    }
    scenes.push(referenceScene)
  }

  return { beats, scenes }
}
