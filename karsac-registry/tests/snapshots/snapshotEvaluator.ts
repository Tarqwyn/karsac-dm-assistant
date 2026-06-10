/**
 * Snapshot evaluator — classifies proposal body sentences as
 * CANON / INFERRED / INVENTED by cross-referencing against corpus files.
 *
 * Classification is heuristic, not perfect:
 *   CANON    — key phrase from this sentence appears verbatim in a corpus file
 *   INFERRED — entity names from the corpus appear but the specific claim is new
 *   INVENTED — content is novel — not in corpus, not inferable from entity names
 *
 * The absolute classification is less important than the INVENTED count delta
 * between runs (which is what the regression test catches).
 */

import { readFileSync, existsSync } from 'fs'

export type ClaimType = 'CANON' | 'INFERRED' | 'INVENTED'

export interface ClaimClassification {
  sentence: string
  type: ClaimType
  matchedIn?: string   // corpus file where a match was found
  matchedPhrase?: string
}

export interface SnapshotEvaluation {
  canonCount: number
  inferredCount: number
  inventedCount: number
  findings: ClaimClassification[]
}

export interface InventedFinding {
  sentence: string
  matchedIn?: string
}

/**
 * Extract meaningful phrases (3+ words) from a sentence for corpus matching.
 * Strips markdown formatting and common filler words.
 */
function extractPhrases(sentence: string): string[] {
  const clean = sentence
    .replace(/[*_`#\[\]()>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

  const words = clean.split(/\s+/).filter(w => w.length > 3 && !/^(and|the|that|this|with|from|have|been|will|they|their|which|when|also|into|then|than|more|some|such|each|both|over|very|just|like|most|only|same|even|after|before|about|there|those|these|other|while|where|through)$/.test(w))

  const phrases: string[] = []
  // 3-word phrases
  for (let i = 0; i < words.length - 2; i++) {
    phrases.push(`${words[i]} ${words[i+1]} ${words[i+2]}`)
  }
  // 2-word phrases (only meaningful noun-like pairs)
  for (let i = 0; i < words.length - 1; i++) {
    if (words[i].length >= 4 && words[i+1].length >= 4) {
      phrases.push(`${words[i]} ${words[i+1]}`)
    }
  }
  return phrases
}

/**
 * Load corpus file contents as a single lowercased string map.
 */
function loadCorpusTexts(corpusFiles: string[]): Record<string, string> {
  const texts: Record<string, string> = {}
  for (const f of corpusFiles) {
    if (existsSync(f)) {
      texts[f] = readFileSync(f, 'utf-8').toLowerCase()
    }
  }
  return texts
}

/**
 * Extract entity names from corpus files (titles, IDs, tags).
 * Used to detect INFERRED content.
 */
function extractEntityNames(corpusTexts: Record<string, string>): Set<string> {
  const names = new Set<string>()
  for (const text of Object.values(corpusTexts)) {
    // Extract from "title: ..." frontmatter lines
    for (const m of text.matchAll(/^title:\s+(.+)$/gm)) {
      names.add(m[1].trim().toLowerCase())
    }
    // Extract from "id: ..." lines
    for (const m of text.matchAll(/^id:\s+[\w/-]+\/(\w[\w-]+)$/gm)) {
      names.add(m[1].replace(/-/g, ' ').toLowerCase())
    }
  }
  return names
}

/**
 * Classify a single sentence against the corpus.
 */
function classifySentence(
  sentence: string,
  corpusTexts: Record<string, string>,
  entityNames: Set<string>,
): ClaimClassification {
  const phrases = extractPhrases(sentence)
  const sentLower = sentence.toLowerCase()

  // Check for CANON match — a corpus file contains one of the key phrases
  for (const [filePath, text] of Object.entries(corpusTexts)) {
    for (const phrase of phrases) {
      if (phrase.length >= 8 && text.includes(phrase)) {
        return {
          sentence,
          type: 'CANON',
          matchedIn: filePath.split('/').slice(-2).join('/'),
          matchedPhrase: phrase,
        }
      }
    }
  }

  // Check for INFERRED — entity names appear but the specific claim is new
  for (const name of entityNames) {
    if (name.length >= 4 && sentLower.includes(name)) {
      return { sentence, type: 'INFERRED' }
    }
  }

  // Nothing matched — INVENTED
  return { sentence, type: 'INVENTED' }
}

/**
 * Evaluate a proposal body against its corpus files.
 * Returns counts and individual findings.
 */
export function evaluateSnapshot(
  body: string,
  corpusFiles: string[],
): SnapshotEvaluation {
  const corpusTexts = loadCorpusTexts(corpusFiles)
  const entityNames = extractEntityNames(corpusTexts)

  // Split into sentences, filter out headings and very short lines
  const sentences = body
    .split(/[.!?\n]/)
    .map(s => s.replace(/^[#*\s-]+/, '').trim())
    .filter(s => s.length > 20 && !/^##/.test(s))

  const findings: ClaimClassification[] = sentences.map(s =>
    classifySentence(s, corpusTexts, entityNames),
  )

  return {
    canonCount: findings.filter(f => f.type === 'CANON').length,
    inferredCount: findings.filter(f => f.type === 'INFERRED').length,
    inventedCount: findings.filter(f => f.type === 'INVENTED').length,
    findings,
  }
}

export function getInventedFindings(evaluation: SnapshotEvaluation): InventedFinding[] {
  return evaluation.findings
    .filter(f => f.type === 'INVENTED')
    .map(f => ({ sentence: f.sentence, matchedIn: f.matchedIn }))
}
