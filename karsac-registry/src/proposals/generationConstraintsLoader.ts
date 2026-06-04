import { existsSync, readFileSync } from 'fs'
import matter from 'gray-matter'
import { REGISTRY_ROOT } from '../paths.js'
import { guardArray } from '../loaderUtils.js'

const CONSTRAINTS_PATH = `${REGISTRY_ROOT}/generation-constraints.yaml`

interface ConstraintSection {
  header?: string[]
}

interface CorpusAnchorSection {
  base?: string[]
  canonical_reference_only?: string[]
  stub?: string[]
  stub_place?: string[]
  stub_close?: string[]
  bounded?: string[]
  snippets_header?: string
}

interface GenerationConstraintsFile {
  adversary?: ConstraintSection
  encounter?: ConstraintSection
  npc?: ConstraintSection
  place?: ConstraintSection
  corpus_anchor?: CorpusAnchorSection
}

let cached: GenerationConstraintsFile | null = null

function load(): GenerationConstraintsFile {
  if (cached) return cached
  if (!existsSync(CONSTRAINTS_PATH)) {
    cached = {}
    return cached
  }
  const raw = readFileSync(CONSTRAINTS_PATH, 'utf-8')
  cached = matter(`---\n${raw}\n---`).data as GenerationConstraintsFile
  return cached
}

export function getAdversaryConstraintHeader(): string[] {
  return guardArray<string>(load().adversary?.header, 'adversary.header')
}

export function getEncounterConstraintLines(): string[] {
  return guardArray<string>(load().encounter?.header, 'encounter.header')
}

export function getNpcConstraintLines(): string[] {
  return guardArray<string>(load().npc?.header, 'npc.header')
}

export function getPlaceConstraintLines(): string[] {
  return guardArray<string>(load().place?.header, 'place.header')
}

export function getCorpusAnchorBaseLines(entityType: string): string[] {
  return guardArray<string>(load().corpus_anchor?.base, 'corpus_anchor.base')
    .map((line) => line.replace('{entity_type}', entityType))
}

export function getCorpusAnchorCanonicalReferenceOnlyLines(): string[] {
  return guardArray<string>(load().corpus_anchor?.canonical_reference_only, 'corpus_anchor.canonical_reference_only')
}

export function getCorpusAnchorStubLines(): string[] {
  return guardArray<string>(load().corpus_anchor?.stub, 'corpus_anchor.stub')
}

export function getCorpusAnchorStubPlaceLines(): string[] {
  return guardArray<string>(load().corpus_anchor?.stub_place, 'corpus_anchor.stub_place')
}

export function getCorpusAnchorStubCloseLines(): string[] {
  return guardArray<string>(load().corpus_anchor?.stub_close, 'corpus_anchor.stub_close')
}

export function getCorpusAnchorBoundedLines(): string[] {
  return guardArray<string>(load().corpus_anchor?.bounded, 'corpus_anchor.bounded')
}

export function getCorpusAnchorSnippetsHeader(): string {
  return load().corpus_anchor?.snippets_header ?? 'Corpus reference passages:'
}

export function clearGenerationConstraintsCacheForTests(): void {
  cached = null
}
