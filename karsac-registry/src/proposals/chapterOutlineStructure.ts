import { extractBulletLines, extractSection, firstParagraph, cleanInlineMarkdown } from '../proposals/renderers/markdownHelpers.js'

export interface ChapterOutlineSceneStructure {
  id: string
  name: string
  purpose: string
  location: string
  pressure: string
  choices: string[]
  clues: string[]
  failure: string
  exitState: string
  notes?: string
}

export interface ChapterOutlineStructure {
  id: string
  title: string
  chapterPurpose: string
  startingState: string
  playerKnowledge: string[]
  corePressure: string
  startingEmotionalState: string
  centralPressure: string
  repeatedMotif: string
  midpointTurn: string
  endState: string
  whatThisChapterChanges: string[]
  sceneSpine: ChapterOutlineSceneStructure[]
  suggestedStateUpdatesAfterPlay?: string[]
  themeTags?: string[]
  notes?: string
}

function parseSceneBlock(block: string, index: number): ChapterOutlineSceneStructure {
  const titleMatch = block.match(/^###\s+Scene\s+\d+\s+[—-]\s+(.+)$/m)
  const getField = (field: string): string => {
    const match = block.match(new RegExp(`-\\s*${field}:\\s*([\\s\\S]*?)(?=\\n-\\s*[A-Za-z].*?:|\\n###\\s+Scene\\s+\\d+\\s+[—-]|$)`, 'i'))
    return cleanInlineMarkdown(match?.[1]?.trim() ?? '')
  }
  const getListField = (field: string): string[] => {
    const bulletSection = extractSection(block, [field])
    const bullets = extractBulletLines(bulletSection)
    if (bullets.length > 0) return bullets
    const match = block.match(new RegExp(`(?:^|\\n)\\s*(?:[-*]\\s*)?${field}:\\s*([\\s\\S]*?)(?=\\n\\s*(?:[-*]\\s*)?[A-Za-z][\\w -]*:\\s|\\n###\\s+Scene\\s+\\d+\\s+[—-]|$)`, 'i'))
    const value = cleanInlineMarkdown(match?.[1]?.trim() ?? '')
    return value ? [value] : []
  }

  return {
    id: `scene-${index + 1}`,
    name: cleanInlineMarkdown(titleMatch?.[1] ?? `Scene ${index + 1}`),
    purpose: getField('Purpose'),
    location: getField('Location'),
    pressure: getField('Pressure'),
    choices: getListField('Choices'),
    clues: getListField('Clues'),
    failure: getField('Failure'),
    exitState: getField('Exit State'),
    notes: firstParagraph(extractSection(block, ['Notes'])) || undefined,
  }
}

export function extractChapterOutlineStructure(body: string, id: string, title: string): ChapterOutlineStructure {
  const sceneSpineSection = extractSection(body, ['Scene Spine'])
  const sceneBlocks = [...sceneSpineSection.matchAll(/###\s+Scene\s+\d+\s+[—-][\s\S]*?(?=\n###\s+Scene\s+\d+\s+[—-]|\s*$)/gi)].map((match) => match[0].trim())

  return {
    id,
    title,
    chapterPurpose: firstParagraph(extractSection(body, ['Chapter Purpose'])),
    startingState: firstParagraph(extractSection(body, ['Starting State'])),
    playerKnowledge: extractBulletLines(extractSection(body, ['Player Knowledge'])),
    corePressure: firstParagraph(extractSection(body, ['Core Pressure'])),
    startingEmotionalState: firstParagraph(extractSection(body, ['Starting Emotional State'])),
    centralPressure: firstParagraph(extractSection(body, ['Central Pressure'])),
    repeatedMotif: firstParagraph(extractSection(body, ['Repeated Motif'])),
    midpointTurn: firstParagraph(extractSection(body, ['Midpoint Turn'])),
    endState: firstParagraph(extractSection(body, ['End State'])),
    whatThisChapterChanges: extractBulletLines(extractSection(body, ['What This Chapter Changes'])),
    sceneSpine: sceneBlocks.map(parseSceneBlock),
    suggestedStateUpdatesAfterPlay: extractBulletLines(extractSection(body, ['Suggested State Updates After Play'])),
    themeTags: extractBulletLines(extractSection(body, ['Theme Tags'])),
    notes: firstParagraph(extractSection(body, ['Notes'])) || undefined,
  }
}
