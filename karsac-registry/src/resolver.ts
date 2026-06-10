import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import type { AliasMap, EntityMap, Entity } from './types.js';
import { scoreMatches, isBestMatch } from './scorer.js';
import type { ScoredMatch, MatchReason } from './scorer.js';

export { type ScoredMatch };

// ── Result types ──────────────────────────────────────────────────────────────

export interface ResolutionResult {
  resolved: ScoredMatch[];
  /** Candidate phrases from a comparison query that could not be confidently resolved. */
  unresolved: string[];
}

// ── Related-ID normalisation ──────────────────────────────────────────────────

/** Map from the plural relation-type key stored in entity.related to its ID prefix. */
export const RELATED_PREFIX_MAP: Record<string, string> = {
  forces: 'forces/', force: 'forces/',
  concepts: 'concepts/', concept: 'concepts/',
  factions: 'factions/', faction: 'factions/',
  events: 'events/', event: 'events/',
  items: 'items/', item: 'items/',
  npcs: 'npcs/', npc: 'npcs/',
  places: 'places/', place: 'places/',
  mechanics: 'mechanics/', mechanic: 'mechanics/',
  pcs: 'pcs/', pc: 'pcs/',
  rules: 'rules/', rule: 'rules/',
};

/** Prefixes that indicate a slug is already fully qualified. */
export const KNOWN_TYPE_PREFIXES: ReadonlySet<string> = new Set([
  'places/', 'npcs/', 'items/', 'events/', 'factions/', 'concepts/',
  'forces/', 'pcs/', 'mechanics/', 'entity-cards/', 'rules/',
]);

/**
 * Normalise a related slug to a full entity ID.
 *
 * - Bare slug:          'vishara'                  → 'forces/vishara'
 * - Already prefixed:   'places/torweg'            → 'places/torweg'  (no double-prefix)
 * - Sub-location slug:  'torweg/council-archives'  → 'places/torweg/council-archives'
 *                       (slash present but no known type prefix → prepend relType prefix)
 */
export function normalizeRelatedId(relType: string, slug: string): string {
  // Already starts with a recognised type prefix — return as-is
  for (const p of KNOWN_TYPE_PREFIXES) {
    if (slug.startsWith(p)) return slug;
  }
  // Bare or sub-location slug — prepend the relation-type prefix
  const prefix = RELATED_PREFIX_MAP[relType] ?? `${relType}/`;
  return prefix + slug;
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const MAX_ENTITIES = 5;

// Words that carry no entity signal on their own
export const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
  'shall', 'can', 'have', 'has', 'had', 'me', 'you', 'he', 'she', 'it',
  'we', 'they', 'my', 'your', 'his', 'her', 'its', 'our', 'their',
  'what', 'who', 'whom', 'whose', 'which', 'that', 'this', 'these', 'those',
  'how', 'when', 'where', 'why', 'and', 'or', 'but', 'not', 'if', 'so',
  'then', 'also', 'just', 'in', 'on', 'at', 'to', 'of', 'for', 'by', 'as',
  'up', 'out', 'with', 'from', 'into', 'onto', 'upon',
  'tell', 'about', 'know', 'give', 'show', 'describe', 'explain', 'list',
  'something', 'anything', 'everything', 'there', 'here', 'compare',
  'between', 'difference', 'both', 'each', 'their',
]);

// Only these match reasons qualify as an "explicitly named" entity.
// Possessive (brynjas-hall), tag-match, and related-match are excluded from
// multi-entity detection so "Compare Brynja and The Carver" does not pull in
// Brynja's Hidden Artefact or Törweg Council.
const NAMED_REASONS: ReadonlySet<MatchReason> = new Set([
  'exact-id', 'exact-title', 'exact-title-prefix', 'id-slug',
]);

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CanonFile {
  id: string;
  title: string;
  path: string;
  content: string;
}

export interface FactPacket {
  canon: CanonFile;
  facts: string;
}

/** A structured data entry from rules-data/*.json (conditions, abilities, etc.) */
export interface StructuredEntry {
  id: string;
  name: string;
  summary: string;
  sourceDataFile: string;
  sourceRule?: string;
}

// ── Resolution ────────────────────────────────────────────────────────────────

/**
 * Resolve all explicitly-named entities from a free-text question.
 *
 * Pass 1 (strict): slide a 1–4 word window across the question. Any phrase
 * that produces a best-match with a NAMED_REASON (exact-title, prefix, id-slug)
 * contributes one entity. Possessive and tag matches are excluded.
 *
 * Pass 2 (fallback): if the strict pass finds nothing, fall back to the old
 * single-entity logic which accepts any confident best-match. This keeps
 * "Tell me about Brynja's hall" working when the user is asking about one place.
 *
 * Results are ordered by first occurrence in the question, capped at MAX_ENTITIES.
 */
export function resolveEntities(
  question: string,
  aliases: AliasMap,
  entities: EntityMap,
): ScoredMatch[] {
  const words = tokenize(question);

  // canonicalId → { match, firstWordIndex }
  const found = new Map<string, { match: ScoredMatch; firstIndex: number }>();

  for (let n = Math.min(4, words.length); n >= 1; n--) {
    for (let i = 0; i <= words.length - n; i++) {
      const phrase = words.slice(i, i + n).join(' ');
      if (n === 1 && (STOP_WORDS.has(phrase.toLowerCase()) || phrase.length < 3)) continue;

      const normalized = stripEdgePunct(phrase);
      if (!normalized) continue;

      const ids = aliases[normalized.toLowerCase()];
      if (!ids || ids.length === 0) continue;

      const ranked = scoreMatches(normalized, ids, entities);
      if (ranked.length === 0 || !isBestMatch(ranked)) continue;

      const top = ranked[0];
      if (!NAMED_REASONS.has(top.matchReason)) continue;

      // Prefer canonical file over entity-card wrapper
      const canonId = resolveCanonicalId(top.entity);

      const existing = found.get(canonId);
      if (!existing || top.score > existing.match.score) {
        found.set(canonId, { match: top, firstIndex: i });
      }
    }
  }

  if (found.size === 0) {
    // Fallback: accept any confident best-match (includes possessive, alias)
    const single = resolveSingle(question, aliases, entities);
    return single ? [single] : [];
  }

  // Order by first occurrence in the sentence, cap at MAX_ENTITIES
  return [...found.values()]
    .sort((a, b) => a.firstIndex - b.firstIndex)
    .slice(0, MAX_ENTITIES)
    .map(v => v.match);
}

// ── Rules-profile resolution ──────────────────────────────────────────────────

/**
 * Phrases that signal a table/house-rules qualifier rather than a lore entity.
 * "at the Karsac table" / "Karsac table" → "Karsac" must NOT resolve to places/karsac.
 */
const TABLE_QUALIFIER_RE =
  /\bat the karsac table\b|\bkarsac table\b|\btable rules?\b|\bhouse rules?\b/gi;

/**
 * Build a variant of the alias map that, for any bucket containing at least one
 * `type: rule` entity, retains only those rule entities. Buckets with no rule
 * entities are left unchanged so pure lore fallbacks still work.
 */
function buildRulesBiasedAliases(aliases: AliasMap, entities: EntityMap): AliasMap {
  const result: AliasMap = {};
  for (const [key, ids] of Object.entries(aliases)) {
    const ruleIds = ids.filter(id => entities[id]?.type === 'rule');
    result[key] = ruleIds.length > 0 ? ruleIds : ids;
  }
  return result;
}

/**
 * Resolve a rules-profile question.
 *
 * Two changes vs the standard resolver:
 * 1. Table-qualifier phrases ("Karsac table", "at the Karsac table", etc.) are
 *    stripped before entity scanning so "Karsac" does not resolve to places/karsac.
 * 2. The alias map is filtered to prefer `type: rule` entities in any ambiguous
 *    bucket. Lore entities are kept only where no rule entity shares the alias.
 */
export function resolveRulesQuestion(
  question: string,
  aliases: AliasMap,
  entities: EntityMap,
): ResolutionResult {
  const stripped = question.replace(TABLE_QUALIFIER_RE, '').replace(/\s{2,}/g, ' ').trim();
  const rulesAliases = buildRulesBiasedAliases(aliases, entities);
  const resolved = resolveEntities(stripped, rulesAliases, entities);
  return { resolved, unresolved: [] };
}

// ── Canon file loading ────────────────────────────────────────────────────────

export function loadCanonFile(
  entity: Entity,
  entities: EntityMap,
  collectionsRoot: string,
): CanonFile {
  // Follow entity-card → primary detail file
  let resolved = entity;
  if (entity.type === 'entity-card' && entity.primaryDetailFile) {
    const canon = entities[entity.primaryDetailFile];
    if (canon) resolved = canon;
  }

  const relPath = resolved.path.replace(/^openwebui-runtime-collections\//, '');
  const absPath = resolve(collectionsRoot, relPath);

  if (!existsSync(absPath)) {
    throw new Error(`Canon file not found on disk: ${absPath}  (entity: ${resolved.id})`);
  }

  return {
    id: resolved.id,
    title: resolved.title,
    path: resolved.path,
    content: readFileSync(absPath, { encoding: 'utf-8' }),
  };
}

// ── Prompt construction ───────────────────────────────────────────────────────

export function buildMessages(
  canons: CanonFile[],
  question: string,
): Array<{ role: string; content: string }> {
  const comparison = canons.length >= 2 && isComparisonQuestion(question);
  let system = canons.length === 1
    ? buildSingleFileSystem(canons[0])
    : buildMultiFileSystem(canons);

  if (comparison) {
    system += '\n\n' + buildComparisonContract(canons);
  }

  return [
    { role: 'system', content: system },
    { role: 'user', content: question },
  ];
}

export function isComparisonQuestion(question: string): boolean {
  return /\b(?:compare|contrast|versus|vs\.?|diff(?:erence|erent)?|how\s+(?:are|do)\b)/i.test(question);
}

function buildSingleFileSystem(canon: CanonFile): string {
  return `You are a Karsac Canon Analyst and Dungeon Master's assistant for the Karsac campaign setting.

You have been given a single canon file. Answer the user's question using ONLY the content of that file.

Rules:
- Do not infer, extrapolate, or draw on any knowledge outside the provided file.
- Do not invent names, places, events, or relationships not written in the file.
- If the file does not contain the answer, say exactly: "The canon file for ${canon.id} does not contain information about that."
- You may quote directly from the file.
- Keep your answer grounded, direct, and useful to a Dungeon Master running this scene.

Interpretation rule:
- Separate direct canon from interpretation.
- Put directly stated facts under "Direct canon facts".
- Put reasonable inferences or thematic readings under "DM interpretation".
- Put anything uncertain, absent, or not explicitly stated under "Not stated / uncertain".
- Do not present metaphorical, thematic, or inferred readings as direct canon.

CANON FILE: ${canon.id}
SOURCE: ${canon.path}
${'─'.repeat(60)}
${canon.content}
${'─'.repeat(60)}`;
}

function buildMultiFileSystem(canons: CanonFile[]): string {
  const fileList = canons.map(c => `[${c.id}]`).join('\n');
  const blocks = canons
    .map(c => `--- FILE: ${c.id} ---\n${c.content}`)
    .join('\n\n');

  return `You are a Karsac Canon Analyst and Dungeon Master's assistant for the Karsac campaign setting.

You have been given ${canons.length} canon files. Answer the user's question using ONLY the content of these files.

Rules:
- Do not merge facts between entities.
- Only state a fact under the entity whose file contains it.
- Cite file IDs (e.g. [${canons[0].id}]) for every factual claim.
- Do not infer, extrapolate, or draw on any knowledge outside the provided files.
- Do not invent names, places, events, or relationships not written in the files.
- If a file does not contain information relevant to the question, say so for that entity.

Interpretation rule:
- Separate direct canon from interpretation.
- Put directly stated facts under "Direct canon facts".
- Put reasonable inferences or thematic readings under "DM interpretation".
- Put anything uncertain, absent, or not explicitly stated under "Not stated / uncertain".
- Do not present metaphorical, thematic, or inferred readings as direct canon.

Primary Canon Files:
${fileList}

Canon Context:
${'─'.repeat(60)}
${blocks}
${'─'.repeat(60)}`;
}

function buildComparisonContract(canons: CanonFile[]): string {
  const entitySections = canons
    .map(c => `### ${c.title}\n- Only facts explicitly stated in \`${c.id}\`.\n- Cite every bullet with \`${c.id}\`.`)
    .join('\n\n');

  return `OUTPUT CONTRACT — COMPARISON MODE

You must follow this exact output structure.

Do not add an introduction.
Do not say "Okay".
Do not say "Here's a breakdown".
Do not use alternative headings.
Do not rename the headings.
Do not create thematic labels in headings.

Start your answer with exactly:

## Direct canon facts

Then use this structure:

## Direct canon facts

${entitySections}

## Differences stated by canon
- Only include differences directly supported by the supplied files.
- Cite every bullet.

## DM interpretation
- Put reasonable thematic or narrative readings here.
- Use cautious language:
  - "This suggests…"
  - "A useful DM reading is…"
  - "This may indicate…"

## Not stated / uncertain
- List anything the supplied files do not explicitly settle.

Forbidden outside \`## DM interpretation\`:
- represents
- symbolises
- embodies
- cautionary tale
- walking signal
- conduit
- manipulator
- tragic figure
- microcosm
- linchpin
- victim
- warning system
- gatekeeper
- narrative function
- emotional impact

Rules:
- Do not merge facts between entities.
- Keep facts attached to the file they came from.
- If a claim is not explicitly in the supplied file, it must go under \`## DM interpretation\` or \`## Not stated / uncertain\`.
- The answer must begin with \`## Direct canon facts\`.`;
}

export function buildProseMessages(
  canons: CanonFile[],
  question: string,
): Array<{ role: string; content: string }> {
  const fileBlocks = canons
    .map(c => `--- FILE: ${c.id} ---\n${c.content}`)
    .join('\n\n');

  const lowerQ = question.toLowerCase();
  const isBoxedText = lowerQ.includes('boxed text');
  const isDialogue = /\b(lines|dialogue|what (does|would|did) .+ say|says|npc says)\b/.test(lowerQ);
  const isPlayerFacing = lowerQ.includes('player-facing');

  const requestTypeNote = isBoxedText
    ? `\nACTIVE REQUEST TYPE: BOXED TEXT — apply boxed text rules below.\n`
    : isDialogue
    ? `\nACTIVE REQUEST TYPE: DIALOGUE — apply dialogue rules below.\n`
    : isPlayerFacing
    ? `\nACTIVE REQUEST TYPE: PLAYER-FACING — treat as player mode regardless of other settings.\n`
    : '';

  const system = `You are Karsac Prose Drafter.

You write controlled prose for the Karsac D&D setting using only the supplied canon context.
${requestTypeNote}
── PROSE PROFILE GUARDRAILS ────────────────────────────────────────────────

GENERAL PROSE RULES:
- Use only the supplied canon files.
- Do not invent new named NPCs, places, factions, gods, symbols, crests, titles, offices, artefacts, ships, forces, or events.
- You may create sensory detail only if it is consistent with the supplied canon.
- Do not construct a scene sequence unless the request explicitly asks for one.
- Keep the Karsac voice sparse, weather-shaped, practical, restrained.
- Prefer concrete visible details.
- Show what players can see, hear, smell, and feel.
- Do not explain the hidden meaning of the scene unless in DM mode.

BOXED TEXT RULES:
- Maximum 180 words unless the user explicitly asks for more.
- Write directly for the table — no setup paragraph, no analysis after the text.
- End on an observable detail, not a dramatic statement.
- At most one line of ambient dialogue. Do not script NPC speech.

DIALOGUE RULES:
- If the canon file contains an exact or near-exact line for the requested situation, prefer that line over any invented version.
- Do not explain symbols, marks, crests, pins, offices, factions, or hidden meanings unless the canon line itself explains them.
- Do not expand clues into exposition. Implication is not explanation.
- For Brynja: direct, dry, low-affect. Prefer short confirmations, withheld judgement, and pointed implications. She does not elaborate unless the canon shows her elaborating.
- If asked for a specific number of lines, produce exactly that number. No heading unless the user requests one.
- In DM mode you may adjust tone to signal intent, but do not add new canon via dialogue.
- Do not use any word, phrase, title, or detail that is not in the supplied canon file or a natural minimal adaptation of it.

CANON ANCHORS — exact lines to stay close to (use only when the matching file is in context):
- Black pin / Brynja context: prefer "Did he wear a black pin?" / "Then the order came from Valweg." / "From Mathr himself. Aldric will not be questioned at council."
  Do NOT add: "Truthspeaker's mark", "crest", "not common on Valweg's men", "not worn lightly" — unless those phrases appear verbatim in the supplied canon file.

FORBIDDEN GENERIC FANTASY PHRASES:
- "mist and mystery"
- "ancient secrets"
- "eerie stillness"
- "stands sentinel"
- "air thick with"
- "looming ominously"
- "fate hangs"
- "shadow of destiny"

REQUEST-TYPE HANDLING:
1. If the request includes "boxed text" → apply boxed text rules.
2. If the request asks for "lines", "dialogue", or what an NPC says → apply dialogue rules.
3. If the request says "player-facing" → treat as player mode (strip DM material) unless the user explicitly overrides.
4. If mode = player → do not include or hint at material from ## DM-Only, ## DM Only, ## Secrets, ## Future, or ## Spoilers sections.

────────────────────────────────────────────────────────────────────────────
Canon Context:
${'─'.repeat(60)}
${fileBlocks}
${'─'.repeat(60)}`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: question },
  ];
}

export function buildDeepLoreMessages(
  canons: CanonFile[],
  question: string,
): Array<{ role: string; content: string }> {
  const fileList = canons.map(c => `[${c.id}]`).join('\n');
  const fileBlocks = canons
    .map(c => `--- FILE: ${c.id} ---\n${c.content}`)
    .join('\n\n');

  const system = `You are Karsac Deep Lore Analyst.

You are a DM-facing assistant for analysing hidden campaign truth, cosmology, forces, factions, and long-form continuity in the Karsac setting.

Rules:
- Use only the supplied canon context.
- DM-only material is allowed.
- Do not invent missing lore.
- Do not smooth over contradictions.
- If a relationship is not explicit, label it as interpretation.
- If something is unclear, put it under \`## Not stated / uncertain\`.
- Do not write prose, boxed text, or player-facing exposition.
- Separate direct canon from hidden structure and interpretation.
- Cite canon file IDs for factual claims.

OUTPUT CONTRACT — DEEP LORE MODE

You must use exactly these five headings. Do not add an introduction. Do not rename headings.

Start your answer with exactly:

## Direct canon facts

Then use this structure:

## Direct canon facts
- Facts explicitly stated in the supplied files.
- Cite every bullet with the file ID (e.g. [places/torweg]).

## Hidden structure
- Structural and causal connections between the supplied files at the DM/campaign layer.
- Only include connections supported by the supplied files.
- Do not include connections you are inferring beyond the text.

## DM interpretation
- Reasonable readings of what the canon implies.
- Use cautious language: "This suggests…", "A useful DM reading is…", "This may indicate…"
- No new facts. No invented lore.

## Not stated / uncertain
- Anything the supplied files do not explicitly settle.
- List gaps, ambiguities, and absent information.

## Useful table guidance
- Short, practical guidance for the DM at the table.
- No new canon.

Canon Files:
${fileList}

Canon Context:
${'─'.repeat(60)}
${fileBlocks}
${'─'.repeat(60)}`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: question },
  ];
}

export function buildRulesMessages(
  canons: CanonFile[],
  question: string,
  structuredEntries?: StructuredEntry[],
): Array<{ role: string; content: string }> {
  const isTableQuery = TABLE_QUALIFIER_RE.test(question);
  TABLE_QUALIFIER_RE.lastIndex = 0; // reset stateful regex

  const fileList = canons.map(c => `[${c.id}]`).join('\n');
  const fileBlocks = canons
    .map(c => `--- FILE: ${c.id} ---\n${c.content}`)
    .join('\n\n');

  const tableGuidance = isTableQuery
    ? `This query asks about the Karsac table specifically. Under "## Karsac table rule": include any Karsac overrides or house rulings from the supplied files. If no Karsac override exists in the supplied files, write exactly: "The Karsac table currently follows the base 5e rule."`
    : `Under "## Karsac table rule": include any Karsac-specific overrides from the supplied files. If none, write: "No Karsac override found in supplied files."`;

  const hasStructured = structuredEntries && structuredEntries.length > 0;
  const structuredBlock = hasStructured
    ? `Structured Data (authoritative — use exact wording from summaries below):
${'─'.repeat(60)}
${structuredEntries!.map(e =>
  `${e.id} — ${e.name} [from ${e.sourceDataFile}]\nSummary: ${e.summary}`,
).join('\n\n')}
${'─'.repeat(60)}

`
    : '';

  const structuredRule = hasStructured
    ? `- Structured data entries above are authoritative. Use their summary wording exactly for the named condition/rule effects. Do not substitute training-data wording or say the files lack the detail if it is in the structured data block.`
    : '';

  const system = `You are Karsac Rules Referee.

You answer rules questions for the Karsac campaign using the supplied structured data and rule files.

Rules:
- Use only the supplied structured data and rule files.
- Do not invent mechanics, rulings, or exceptions not present in the supplied context.
- Cite IDs for factual claims (e.g. [rules/core/grapple-and-shove]${hasStructured ? ', [condition/frightened]' : ''}).
- Separate SRD base rules from Karsac house/table rulings.
- If a rule is provisional or marked DM-call, say so explicitly.
- If the supplied context does not cover something asked, say so under \`## DM call\`.
- Do not reference lore entities (places, NPCs, factions) unless explicitly present in the supplied context.
${structuredRule ? `- ${structuredRule}` : ''}
- ${tableGuidance}

OUTPUT CONTRACT — RULES MODE

You must use exactly these six headings. Do not add an introduction. Do not rename headings.

Start your answer with exactly:

## Ruling

Then use this structure:

## Ruling
One or two sentences directly answering the question.

## Base 5e rule
The SRD/core rule as stated in the supplied context. Quote or closely paraphrase. Cite IDs.

## Karsac table rule
Any Karsac-specific override, house ruling, or table adaptation from the supplied files.
If none: "The Karsac table currently follows the base 5e rule."

## At the table
Practical guidance for running this rule. Based only on the supplied context.

## Edge cases
Known edge cases, exceptions, or interactions called out in the supplied context.
If none: "(none noted in supplied context)"

## DM call
Anything the supplied context leaves open to DM discretion, or anything not covered.

${structuredBlock}Rule Files:
${fileList}

Rule Context:
${'─'.repeat(60)}
${fileBlocks}
${'─'.repeat(60)}`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: question },
  ];
}

/**
 * Whether the question explicitly opts into provisional homebrew mechanics.
 * Only used to relax monster guardrails when no monster corpus is loaded.
 */
/** Extract party size and level from a question string. */
export function extractPartyInfo(question: string): { size: number | null; level: number | null } {
  const lq = question.toLowerCase();
  let level: number | null = null;
  let size: number | null = null;

  // "4 lvl 3", "4 level 3", "4 lv 3" — size comes before keyword+level
  const combined = lq.match(/\b(\d+)\s+(?:lvl|level|lv\.?)\s+(\d+)\b/);
  if (combined) {
    size = parseInt(combined[1], 10);
    level = parseInt(combined[2], 10);
  }

  // Standalone level reference
  if (!level) {
    const lvlMatch = lq.match(/\b(?:lvl|level)\s+(\d+)\b/);
    if (lvlMatch) level = parseInt(lvlMatch[1], 10);
  }

  // "party of 4", "4 players", "4 pcs", "4 characters" — but NOT "level 5 characters"
  // Negative lookbehind prevents matching the level number as party size.
  if (!size) {
    const sizeMatch = lq.match(/\bparty\s+(?:of\s+)?(\d+)\b|\b(\d+)\s+(?:players?|pcs?)\b|(?<!level\s)(?<!lvl\s)\b(\d+)\s+characters?\b/);
    if (sizeMatch) {
      const raw = sizeMatch[1] ?? sizeMatch[2] ?? sizeMatch[3] ?? '';
      size = raw ? parseInt(raw, 10) : null;
    }
  }

  // Written numbers ("four level 3", "four characters")
  if (!size) {
    const wordNums: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6 };
    for (const [word, num] of Object.entries(wordNums)) {
      if (new RegExp(`\\b${word}\\s+(?:lvl|level|players?|pcs?)`).test(lq)) {
        size = num; break;
      }
    }
  }

  // Clamp to sane ranges
  if (level !== null && (level < 1 || level > 20)) level = null;
  if (size !== null && (size < 1 || size > 10)) size = null;

  return { size, level };
}

function requestsProvisionalHomebrew(question: string): boolean {
  const lq = question.toLowerCase();
  return (
    lq.includes('provisional homebrew') ||
    lq.includes('homebrew stat') ||
    lq.includes('invent stats') ||
    lq.includes('make up stats') ||
    lq.includes('give me a stat block') ||
    lq.includes('give me stats') ||
    lq.includes('write me a stat block')
  );
}

import type { EncounterCompositionPlan } from './composition.js';
import { formatCompositionPromptBlock, buildCreatureScaffold } from './composition.js';
import type { EncounterBrief } from './encounter-brief.js';

// ── Non-combat monster context renderer ──────────────────────────────────────

/**
 * Render one monster's context entry for the model prompt.
 * For non-combatant creatures, strip attack actions entirely so the model
 * cannot read Multiattack/Beak/Talons and attribute them to a scout role.
 */
function renderMonsterContextEntry(
  file: CanonFile,
  compositionPlan: EncounterCompositionPlan | null,
): string {
  if (!compositionPlan) return `--- MONSTER: ${file.id} ---\n${file.content}`;

  const creature = compositionPlan.selectedOpposition.find(c => c.monsterId === file.id);
  if (!creature || creature.useAsCombatant) {
    return `--- MONSTER: ${file.id} ---\n${file.content}`;
  }

  const local = compositionPlan.allowedLocalNames.find(l => l.monsterId === creature.monsterId);
  const displayName = local
    ? `${local.localName} / ${creature.monsterName}`
    : creature.monsterName;

  return `--- MONSTER: ${file.id} (NON-COMBAT ROLE ONLY) ---
${displayName}
Source: ${creature.monsterId}
Role: ${creature.role} — non-combat atmospheric presence only.
Allowed narrative uses: watches from above, circles the road, cries warning, makes the party feel observed, draws attention to danger, departs suddenly when threatened.
Forbidden: attacks, dive-bombs, claws at characters, deals damage, joins initiative as a combatant.
Note: Combat actions (Multiattack, Beak, Talons, etc.) are intentionally omitted — this creature is not a combatant in this encounter.`;
}

export function buildDesignMessages(
  canonFiles: CanonFile[],
  rulesFiles: CanonFile[],
  question: string,
  monsterFiles: CanonFile[] = [],
  options: {
    partyInfo?: { size: number | null; level: number } | null;
    allowHomebrew?: boolean;
    noSuitableMonsters?: boolean;
    loadedMonsterNames?: string[];
    compositionPlan?: EncounterCompositionPlan | null;
    encounterBrief?: EncounterBrief | null;
  } = {},
): Array<{ role: string; content: string }> {
  const { partyInfo = null, allowHomebrew = false, noSuitableMonsters = false, loadedMonsterNames = [], compositionPlan = null, encounterBrief = null } = options;
  const hasMonsterData = monsterFiles.length > 0 && !noSuitableMonsters;
  const wantsHomebrew = allowHomebrew || (!hasMonsterData && requestsProvisionalHomebrew(question));
  // noMonsterRestricted = the strict guardrail case: no data and not an explicit homebrew request
  const noMonsterRestricted = !hasMonsterData && !wantsHomebrew;

  const canonBlock = canonFiles.length > 0
    ? `Canon & Setting Context:\n${'─'.repeat(60)}\n${canonFiles.map(c => `--- FILE: ${c.id} ---\n${c.content}`).join('\n\n')}\n${'─'.repeat(60)}`
    : `Canon & Setting Context:\n${'─'.repeat(60)}\n(No specific canon context loaded. Use general Karsac setting grounding from the question.)\n${'─'.repeat(60)}`;

  const rulesBlock = rulesFiles.length > 0
    ? `\nRules Reference:\n${'─'.repeat(60)}\n${rulesFiles.map(r => `--- RULES: ${r.id} ---\n${r.content}`).join('\n\n')}\n${'─'.repeat(60)}`
    : '';

  const monsterBlock = hasMonsterData
    ? `\nMonster Data:\n${'─'.repeat(60)}\n${monsterFiles.map(f => renderMonsterContextEntry(f, compositionPlan)).join('\n\n')}\n${'─'.repeat(60)}`
    : '';

  // ── Party context block ───────────────────────────────────────────────────
  const partyBlock = partyInfo?.level != null
    ? `PARTY CONTEXT:
  Party size: ${partyInfo.size ?? 'unknown'}
  Party level: ${partyInfo.level}
  Appropriate encounter CR range: CR ${Math.max(0, partyInfo.level - 1)}–${partyInfo.level + 1} (individual creatures)
  Do NOT select monsters whose CR wildly exceeds this band unless the encounter is explicitly
  non-combat, avoid-only, or the user has asked for an overwhelming/impossible threat.
  If no level-appropriate monster candidates are loaded, use encounter ROLES only and say:
  "No suitable level-appropriate monster candidates were found in the loaded monster corpus. Using encounter roles only."\n\n`
    : '';

  // ── Homebrew gate block ───────────────────────────────────────────────────
  const homebrewGate = (allowHomebrew || wantsHomebrew)
    ? `HOMEBREW GATE: Homebrew is permitted for this request. You may suggest reskins and stat modifications,
  but MUST label every change as "Provisional homebrew — not canon."\n\n`
    : `HOMEBREW GATE — ACTIVE (default mode):
  DO NOT write any of the following without explicit user homebrew request or --allow-homebrew:
  - "based on [monster name]" (homebrew reskin indicator)
  - Ability score changes (+N Strength, −N Constitution, etc.)
  - HP modifications (reduce HP, increase HP, etc.)
  - AC modifications
  - Invented saving throw disadvantages
  - Any stat not present verbatim in the selected monster files

  LOCAL/REGIONAL NAMES:
  - You MAY use a regional name (e.g. "Fjallvarg") ONLY as a flavour label for a LOADED monster.
  - Format: "Fjallvarg — local name for Wolf" (if Wolf is in selected monsters).
  - NOT allowed: "Fjallvarg based on Dire Wolf" if Dire Wolf was not selected.
  - NOT allowed: any stat block, ability score, HP, or AC under a regional name.
  - If no suitable monster is loaded: do NOT invent a named local creature. Use encounter roles only.\n\n`;

  // ── Monster guardrails — placed first in the prompt so the model reads them
  // before any creative instructions ──────────────────────────────────────────
  const monsterGuardrailHeader = noMonsterRestricted
    ? `══════════════════════════════════════════════════════════
NO MONSTER DATA LOADED — CREATURE GUARDRAILS ACTIVE
══════════════════════════════════════════════════════════

These rules override ALL other instructions in this prompt.

DO NOT write any of the following in your response:
- Any D&D monster name (Stone Giant, Dire Wolf, Roper, Boar, Troll, etc.)
- Named homebrew creatures (Rockhide Boar, Crag Wyrm, etc.)
- "use X stats" or "reskinned X"
- CR ratings (CR 1, CR 3 equivalent, etc.)
- AC values (AC 14, +2 AC, etc.)
- HP values, hit dice, damage dice
- Damage resistances or immunities
- Breath weapons or named special abilities
- Specific ability score values
- Exact creature counts (e.g. "2-4 giants", "6-8 goats")

Write ENCOUNTER ROLES only. Examples:
- "a displaced mountain pack predator — fast, hunting, probably hungry"
- "a wounded heavy-bodied grazer — panicked, unpredictable when cornered"
- "a frightened cliff scavenger — bold only when backed into cover"
- "a territorial nesting beast — not pursuing far from the nest"
- "something larger heard above the road, not yet seen"
- "desperate animals fleeing a worse pressure higher in the mountains"

The ## Creatures / opposition section MUST begin with this exact sentence:
"Monster metadata is not yet loaded, so these are encounter roles rather than selected stat blocks."

══════════════════════════════════════════════════════════

`
    : hasMonsterData
    ? `MONSTER DATA STATUS: Monster metadata loaded (see context below).
Use supplied monster data only. Do not supplement with invented stat blocks.\n\n`
    : `MONSTER DATA STATUS: No monster corpus loaded. User requested provisional homebrew.
Label all proposed mechanics as: "Provisional homebrew — not based on loaded monster data."\n\n`;

  // noSuitableMonsters fallback instruction
  const noSuitableBlock = noSuitableMonsters
    ? `NO SUITABLE LEVEL-APPROPRIATE MONSTERS FOUND:
  The monster corpus was searched but no candidates match this party's encounter band.
  Use ENCOUNTER ROLES only in the ## Creatures / opposition section.
  Begin that section with:
  "No suitable level-appropriate monster candidates were found in the loaded monster corpus. Using encounter roles only."\n\n`
    : '';

  // ── Composition plan block — placed after guardrails and before persona ──────
  const compositionBlock = compositionPlan
    ? formatCompositionPromptBlock(compositionPlan)
    : '';

  // ── Scaffold block — tells the model exactly what to put in ## Creatures ──────
  // This is the most powerful drift-prevention technique: the model reads
  // pre-filled creature content and is told to reproduce it verbatim.
  const scaffoldBlock = compositionPlan && compositionPlan.selectedOpposition.length > 0
    ? `══════════════════════════════════════════════════════════
MANDATORY CREATURES / OPPOSITION — SCAFFOLD
══════════════════════════════════════════════════════════

Your ## Creatures / opposition section must begin with EXACTLY the following.
Copy it verbatim. Do NOT add, remove, rename, reskin, or modify any creature.
Do NOT invent additional creatures or local names beyond those listed here.

${buildCreatureScaffold(compositionPlan)}

After this list you may add a short tactical/atmospheric paragraph (2–3 sentences).
The list itself is locked — preserve it as written.

══════════════════════════════════════════════════════════

`
    : '';

  const system = `${monsterGuardrailHeader}${compositionBlock}${scaffoldBlock}${partyBlock}${homebrewGate}${noSuitableBlock}You are Karsac Design Assistant.

You help the DM create provisional table material that fits the Karsac campaign.

You are not writing canon. You are shaping encounter material from supplied context.

GENERAL RULES:
- Use only the supplied canon and rules context.
- Do not contradict canon.
- Do not invent new canon facts.
- Label all new material provisional.
- Use D&D 5e 2014 as the rules baseline.
- Prefer grounded, weather-shaped, practical Karsac tone over generic fantasy spectacle.
- Keep hidden truths DM-facing only.
- Keep player-safe descriptions free of spoilers.
- Make the encounter serve story, pressure, pacing, or revelation — not just combat.
- If party size and level are not given, state a clear assumption before proceeding.

ENCOUNTER DESIGN PRINCIPLES:
- Challenge through terrain, goals, timing, visibility, morale, complications, and escape conditions — not only damage output.
- Include non-combat or partial-success options where useful.
- Tie creature choices to narrative logic, not random selection.

OUTPUT CONTRACT — ENCOUNTER DESIGN MODE

You must use exactly these ten headings. Do not add an introduction. Do not rename headings.
Start your answer with exactly: ## Provisional encounter concept

## Provisional encounter concept
One or two sentences summarising the encounter.

## Why it fits Karsac
How this encounter fits Karsac tone, setting, and story logic.

## Encounter setup
Location, terrain, how the encounter begins.

## Creatures / opposition
${compositionPlan && compositionPlan.selectedOpposition.length > 0
  ? `LOCKED SECTION — supplied by the deterministic composition plan.
Reproduce the scaffold from the MANDATORY CREATURES / OPPOSITION block above exactly as given.
Do not write, rewrite, expand, rename, reorder, or add creatures.
Do not introduce monster actions, attacks, or tactics here unless already present in the locked scaffold.`
  : noMonsterRestricted
  ? `MANDATORY: Begin with this exact sentence:
"Monster metadata is not yet loaded, so these are encounter roles rather than selected stat blocks."
Then list 2–4 creature ROLES using behavioural/ecological language only.
DO NOT name any monster. DO NOT assign stats, CR, HP, or AC.`
  : noSuitableMonsters
  ? `MANDATORY: Begin with:
"No suitable level-appropriate monster candidates were found in the loaded monster corpus. Using encounter roles only."
Then list 2–4 encounter ROLES. Do NOT reference any stats, CR, HP, or AC.`
  : hasMonsterData
  ? `What the party faces. Use ONLY the monster files loaded in this session.
- You may use regional/local names as flavour labels (e.g. "Fjallvarg — local name for Wolf").
- Do NOT modify any stat from the loaded files unless --allow-homebrew is active.
- Do NOT reference monsters not in the selected files.
- Cite monster file IDs where relevant.`
  : 'Creature roles or provisional homebrew concepts, clearly labelled as such.'}

## Terrain and pressure
Key terrain features, visibility, environmental hazards, cover options.

## What this reveals
What the encounter reveals about the world, a faction, or coming events.

## Running it at the table
Practical DM guidance: pacing, key decision points, how to adjust mid-encounter.

## Scaling options
How to adjust for different party sizes or levels. State any assumptions clearly.

## Player-safe description
What the players perceive. No spoilers. Suitable for read-aloud.

## Canon status
Must say exactly: Provisional table material — not canon until accepted.

${canonBlock}
${rulesBlock}${monsterBlock}`;

  // The user message is the compiled encounter brief when available.
  // The raw question is NEVER forwarded to the model as the primary instruction.
  const userMessage = encounterBrief?.briefText ?? question;

  return [
    { role: 'system', content: system },
    { role: 'user', content: userMessage },
  ];
}

// ── State profile message builder ─────────────────────────────────────────────

export interface StateContextData {
  playerKnowledge: Record<string, unknown> | null;
  campaignState:   Record<string, unknown> | null;
  partyState:      Record<string, unknown> | null;
  worldThreads:    Record<string, unknown> | null;
  npcsState:       Record<string, unknown> | null;
  itemsState:      Record<string, unknown> | null;
  sessionFacts:    Record<string, unknown> | null;
  sessionProgress: Record<string, unknown> | null;
  handouts:        Record<string, unknown> | null;
  radar:           Record<string, unknown> | null;
}

/**
 * Build the model-facing messages for a state-profile query.
 *
 * Context is split into three clearly-labeled zones so the model cannot
 * confuse available (DM-only) facts with confirmed player knowledge:
 *
 *   ZONE 1 — CONFIRMED PLAYER KNOWLEDGE  (known=true, posted=true only)
 *   ZONE 2 — AVAILABLE — DM ONLY         (available facts, unposted handouts)
 *   ZONE 3 — OPEN DM THREADS             (world threads by status, radar, NPCs)
 */
export function buildStateMessages(
  ctx: StateContextData,
  question: string,
): Array<{ role: string; content: string }> {
  const lq = question.toLowerCase();
  const DIV = '═'.repeat(62);
  const div = '─'.repeat(60);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function fmtThreadGroup(threads: unknown[], status: string): string {
    const group = (threads as any[]).filter(t => t.currentStatus === status);
    if (group.length === 0) return `  (none)`;
    return group.map(t =>
      `  - [${t.id}] ${t.name}  |  ${t.summary?.slice(0, 90) ?? ''}`
    ).join('\n');
  }

  function npcMentioned(npc: any): boolean {
    return npc.name.toLowerCase().split(/\s+/)
      .some((w: string) => w.length > 3 && lq.includes(w));
  }

  // ── Extract shared data ───────────────────────────────────────────────────────

  const cs  = (ctx.campaignState  as any) ?? {};
  const ps  = (ctx.partyState     as any) ?? {};
  const pk  = (ctx.playerKnowledge as any) ?? {};
  const wt  = (ctx.worldThreads   as any) ?? {};
  const ns  = (ctx.npcsState      as any) ?? {};
  const is_ = (ctx.itemsState     as any) ?? {};

  const knownFacts: string[]    = pk.knownFacts      ?? [];
  const postedHandouts: string[] = pk.postedHandouts ?? [];
  const notYetRevealed: string[] = pk.notYetRevealed ?? [];
  const threads: any[]          = wt.threads         ?? [];
  const npcs: any[]             = ns.npcs            ?? [];
  const items: any[]            = is_.items          ?? [];
  const chars: any[]            = ps.characters      ?? [];

  // Session data (may be null if not loaded)
  const allFacts: any[] = ctx.sessionFacts
    ? ((ctx.sessionFacts as any).facts ?? []) : [];
  const availableFacts = allFacts.filter(f => f.knowledgeStatus === 'available');
  const confirmedFacts = allFacts.filter(f => f.knowledgeStatus === 'known');
  const allHandouts: any[] = ctx.handouts
    ? ((ctx.handouts as any).handouts ?? []) : [];
  const postedHandoutDetails = allHandouts.filter(h => h.posted);
  const unpostedHandouts     = allHandouts.filter(h => !h.posted);

  // ── Campaign header (not zone-specific) ──────────────────────────────────────

  const present   = chars.filter(c => c.status === 'present');
  const potential = chars.filter(c => c.status === 'potential');
  const clockVal  = cs.clock?.value ?? 0;
  const clockTier = clockVal <= 3 ? 'Low' : clockVal <= 6 ? 'Medium' : clockVal <= 9 ? 'High' : 'Critical';

  const header = [
    `CAMPAIGN — Session ${cs.currentSession ?? '?'} / Chapter ${cs.currentChapter ?? '?'}`,
    `Clock: ${clockVal}/${cs.clock?.max ?? 16} (${clockTier})  |  Progress: step ${cs.progress?.step ?? 0} of ${cs.progress?.steps ?? '?'}`,
    `Party: ${present.map(c => c.name).join(', ') || 'none listed'}`,
    ps.partyLevel   != null ? `Level: ${ps.partyLevel}` : `Level: not confirmed in state`,
    ps.partySize    != null ? `Size: ${ps.partySize}`   : `Size: not confirmed in state`,
    potential.length > 0    ? `Potential (not yet joined): ${potential.map(c => c.name).join(', ')}` : '',
  ].filter(Boolean).join('\n');

  // ── ZONE 1: Confirmed player knowledge ───────────────────────────────────────

  const zone1Lines: string[] = [
    DIV,
    `ZONE 1 — CONFIRMED PLAYER KNOWLEDGE`,
    `(facts marked known=true; handouts with posted=true)`,
    `DO NOT attribute anything outside this zone to "the players".`,
    DIV,
  ];

  if (knownFacts.length === 0) {
    zone1Lines.push(`⚠ KNOWN FACTS: 0`);
    zone1Lines.push(`  No facts are currently marked as revealed to players.`);
    zone1Lines.push(`  State is a clean import — all session facts are still DM-only.`);
    zone1Lines.push(`  Update after live play to mark facts as known.`);
  } else {
    zone1Lines.push(`Known facts (${knownFacts.length}):`);
    for (const id of knownFacts) {
      const f = allFacts.find(f => f.id === id);
      zone1Lines.push(`  [KNOWN] [${id}] ${f?.label ?? id}`);
    }
  }

  zone1Lines.push('');
  if (postedHandouts.length === 0 && postedHandoutDetails.length === 0) {
    zone1Lines.push(`⚠ POSTED HANDOUTS: 0 — players have seen no handouts yet.`);
  } else {
    const ids = postedHandouts.length > 0 ? postedHandouts : postedHandoutDetails.map(h => h.id);
    zone1Lines.push(`Posted handouts: ${ids.join(', ')}`);
  }

  // ── ZONE 2: Available — DM only ──────────────────────────────────────────────

  const zone2Lines: string[] = [
    ``,
    DIV,
    `ZONE 2 — AVAILABLE — DM ONLY — NOT YET REVEALED TO PLAYERS`,
    `(knowledgeStatus=available; posted=false)`,
    `These facts exist in state but the players have not been told them.`,
    `Label them as "available in state but not yet revealed" in your answer.`,
    DIV,
  ];

  if (availableFacts.length > 0) {
    zone2Lines.push(`Available session facts (${availableFacts.length}) — DM-only until revealed:`);
    for (const f of availableFacts) {
      zone2Lines.push(`  [NOT YET REVEALED] [${f.id}] [${f.scene ?? '?'}] ${f.label}`);
      if (f.desc) zone2Lines.push(`    desc: ${f.desc}`);
    }
  } else if (ctx.sessionFacts) {
    zone2Lines.push(`  (no available facts — all have been revealed or none loaded)`);
  } else {
    zone2Lines.push(`  (session facts not loaded for this query)`);
  }

  zone2Lines.push('');
  if (unpostedHandouts.length > 0) {
    zone2Lines.push(`Unposted handouts (not yet seen by players):`);
    for (const h of unpostedHandouts) {
      zone2Lines.push(`  [NOT YET POSTED] [${h.id}] ${h.label} — scene: ${h.scene ?? '?'}`);
    }
  }

  // ── ZONE 3: Open DM threads ───────────────────────────────────────────────────

  const zone3Lines: string[] = [
    ``,
    DIV,
    `ZONE 3 — OPEN DM THREADS`,
    `(world threads by status, radar, NPC state, growth items)`,
    DIV,
    ``,
    `HOT — actionable now:`,
    fmtThreadGroup(threads, 'hot'),
    ``,
    `SIMMERING — active, not yet urgent:`,
    fmtThreadGroup(threads, 'simmering'),
    ``,
    `DORMANT — known but not yet surfaced:`,
    fmtThreadGroup(threads, 'dormant'),
    ``,
    `CLOSED / ABANDONED:`,
    fmtThreadGroup(threads, 'closed'),
    fmtThreadGroup(threads, 'abandoned'),
  ];

  // Radar (full entries when loaded)
  if (ctx.radar) {
    const radarItems: any[] = (ctx.radar as any).radar ?? [];
    zone3Lines.push(``, `DM RADAR — session focus:`, div);
    for (const r of radarItems) {
      zone3Lines.push(`  Thread ${r.id.toUpperCase()}: ${r.title} [${r.currentThreadStatus ?? '?'}]`);
      zone3Lines.push(`    surface: ${r.surface}`);
      zone3Lines.push(`    hook: ${r.hook}`);
    }
  }

  // NPCs — full entry for named ones, one-liner for others
  const mentionedNpcs = npcs.filter(npcMentioned);
  const restNpcs      = npcs.filter(n => !npcMentioned(n));
  if (npcs.length > 0) {
    zone3Lines.push(``, `NPC STATE:`, div);
    for (const n of mentionedNpcs) {
      zone3Lines.push(`${n.name} [${n.status}] — ${n.location}`);
      zone3Lines.push(`  knows: ${n.knows}`);
      zone3Lines.push(`  wants: ${n.wants}`);
      zone3Lines.push(`  hides: ${n.hides}`);
      if (n.threads?.length) {
        for (const t of n.threads) zone3Lines.push(`  · ${t}`);
      }
    }
    for (const n of restNpcs) {
      zone3Lines.push(`  ${n.name} [${n.status}] — ${n.location}`);
    }
  }

  // Growth items
  if (items.length > 0) {
    zone3Lines.push(``, `GROWTH ITEMS:`, div);
    for (const item of items) {
      zone3Lines.push(`  ${item.name} (${item.form}) — owner: ${item.owner} — state: ${item.state}`);
      zone3Lines.push(`    next: ${item.nextTrigger ?? '?'} → ${item.nextState ?? '?'}`);
    }
  }

  // Session progress (when loaded)
  if (ctx.sessionProgress) {
    const sp = ctx.sessionProgress as any;
    const steps: any[] = sp.steps ?? [];
    zone3Lines.push(``, `SESSION PROGRESS — ${sp.sessionId ?? 'session-2'}:`, div);
    zone3Lines.push(`Current step: ${sp.currentStep ?? 0} of ${steps.length}`);
    for (const s of steps) {
      zone3Lines.push(`  Step ${s.index}: ${s.label}${s.pauseClass === 'pause' || s.pauseClass === 'end' ? ` ← ${s.pauseLabel}` : ''}`);
    }
  }

  // ── Detect query focus — used for context ordering and compression ───────────

  const isChapterPrep  = /chapter\s*3|pick\s+up|carry\s+forward|chapter\s+prep|next\s+chapter|what\s+should\s+chapter|what\s+should\s+happen\s+next|how\s+should\s+the\s+next\s+chapter|what\s+threads\s+should\s+carry/i.test(question);
  // facts-focused: user is asking what facts are available / not yet revealed
  const isFocusedOnFacts = /\bfacts?\b.*(?:available|reveal|not\s+yet)\b|(?:available|unrevealed)\s+facts?\b|\bnot\s+yet\s+revealed\b/i.test(question);

  // ── Story arc data — computed once, used in both context block and user message ─

  // Hoisted so both the storyArcBlock (for context) and the user message can see them.
  let storyArcBlock    = '';
  let arcIsAtChapterEnd    = false;
  let arcNarrativePhase    = '';
  let arcTransitionLines: string[] = [];
  let arcRecapBullets:    string[] = [];
  let arcEndStepRecap:    string[] = [];   // what the final chapter step says will happen
  let arcRemainingLabels: string[] = [];

  if (isChapterPrep) {
    const sp = ctx.sessionProgress as any ?? null;
    const sessionSteps: any[] = sp?.steps ?? [];
    const currentStep: number = cs.progress?.step ?? sp?.currentStep ?? 0;
    const totalSteps = sessionSteps.length;
    const chapter = cs.currentChapter ?? '?';
    const session = cs.currentSession ?? '?';

    const currentStepData = sessionSteps[currentStep];
    const lastStepData    = sessionSteps[totalSteps - 1];
    arcIsAtChapterEnd     = currentStepData?.pauseClass === 'end';
    const isAtStrongPause = currentStepData?.pauseClass === 'pause';
    const remainingSteps  = sessionSteps.slice(currentStep + 1);
    arcRemainingLabels    = remainingSteps.map((s: any) => s.label);
    arcEndStepRecap       = lastStepData?.recap ?? [];

    // Narrative phase
    if (totalSteps === 0 || currentStep === 0) {
      arcNarrativePhase = 'session opening / prelude — chapter has not yet begun in earnest';
    } else if (arcIsAtChapterEnd) {
      arcNarrativePhase = 'chapter conclusion — ready for transition';
    } else if (currentStep < Math.floor(totalSteps / 2)) {
      arcNarrativePhase = 'early chapter — setup and orientation phase';
    } else if (isAtStrongPause) {
      arcNarrativePhase = `mid-chapter investigation phase — at a strong pause point (${currentStepData?.pauseLabel ?? ''})`;
    } else {
      arcNarrativePhase = 'mid-to-late chapter — development and escalation phase';
    }

    // Arc transition note (multi-line for context block readability)
    if (arcIsAtChapterEnd) {
      arcTransitionLines = [
        `Chapter ${chapter} is complete. Chapter ${Number(chapter) + 1} planning is immediate.`,
      ];
    } else {
      const remaining = arcRemainingLabels.join(' → ');
      arcTransitionLines = [
        `Chapter ${chapter} is NOT yet complete.`,
        `Remaining steps: ${remaining || 'none listed'}.`,
        `Chapter ${Number(chapter) + 1} planning = CARRY-FORWARD planning. Finish Chapter ${chapter} first.`,
      ];
    }

    // Recap from last completed pause point
    const lastPauseStep = sessionSteps.slice(0, currentStep + 1)
      .filter((s: any) => s.pauseClass === 'pause' || s.pauseClass === 'end')
      .pop();
    arcRecapBullets = lastPauseStep?.recap ?? currentStepData?.recap ?? [];

    // Build the context block version of the arc data
    const hotThreads      = threads.filter(t => t.currentStatus === 'hot');
    const simmerThreads   = threads.filter(t => t.currentStatus === 'simmering');
    const arcLines = [
      `${'═'.repeat(62)}`,
      `STORY ARC POSITION (deterministic — for model orientation)`,
      `${'═'.repeat(62)}`,
      `Chapter: ${chapter}  |  Session: ${session}  |  Step: ${currentStep} of ${totalSteps - 1}`,
      `Current step label: ${currentStepData?.label ?? 'unknown'}`,
      `Narrative phase: ${arcNarrativePhase}`,
      ``,
      ...arcTransitionLines,
    ];
    if (arcRecapBullets.length > 0) {
      arcLines.push(``, `What has been established (last pause recap):`);
      for (const b of arcRecapBullets) arcLines.push(`  · ${b}`);
    }
    if (arcEndStepRecap.length > 0) {
      arcLines.push(``, `What Chapter ${chapter} is building toward (end-step recap):`);
      for (const b of arcEndStepRecap) arcLines.push(`  · ${b}`);
    }
    if (hotThreads.length > 0) {
      arcLines.push(``, `HOT narrative pressure (carry into next chapter):`);
      for (const t of hotThreads) arcLines.push(`  · [${t.id}] ${t.name}`);
    }
    if (simmerThreads.length > 0) {
      arcLines.push(``, `SIMMERING (available to surface):`);
      for (const t of simmerThreads) arcLines.push(`  · [${t.id}] ${t.name}`);
    }
    storyArcBlock = arcLines.join('\n');
  }

  // For facts-focused queries, compress Zone 3 NPC block (just name/status) to reduce context noise
  const zone3LinesForFacts: string[] = [
    ``,
    DIV,
    `ZONE 3 — OPEN DM THREADS (compressed — NPC detail omitted for facts query)`,
    DIV,
    ``,
    `HOT — actionable now:`,
    fmtThreadGroup(threads, 'hot'),
    ``,
    `SIMMERING — active, not yet urgent:`,
    fmtThreadGroup(threads, 'simmering'),
    ``,
    `NPC STATUS (summary only):`,
    ...npcs.map(n => `  ${n.name} [${n.status}]`),
  ];

  // ── Assemble full context block ───────────────────────────────────────────────
  // Chapter-prep: arc block first, then zones.
  // Facts-focused: Zone 2 first (model reads it before NPC noise).
  // Default: Zone 1 → Zone 2 → Zone 3.

  const contextBlock = isChapterPrep
    ? [ storyArcBlock, '',
        header, '',
        ...zone1Lines,
        ...zone2Lines,
        ...zone3Lines,
      ].join('\n')
    : isFocusedOnFacts
    ? [ header, '',
        ...zone2Lines,
        ...zone1Lines,
        ...zone3LinesForFacts,
      ].join('\n')
    : [ header, '',
        ...zone1Lines,
        ...zone2Lines,
        ...zone3Lines,
      ].join('\n');

  // ── Output format: detect Chapter 3 / chapter-prep questions ─────────────────

  const outputFormat = isChapterPrep
    ? `CHAPTER PLANNING RULES:
- Begin with ## Story arc position. Do not skip it. Do not move it.
- Read the STORY ARC POSITION block in the state data and report it accurately.
- If the chapter is NOT complete, say so clearly before making any recommendations.
- Separate "complete Chapter N" tasks from "carry into Chapter N+1" planning.
- Do not invent scenes or NPCs not present in the state data.

## Story arc position
(Report from the STORY ARC POSITION block: current chapter/session/step, narrative phase,
whether Chapter 2 is complete or still in progress, what has been established, what pressure is hot.)

## Current table state
(One or two sentences on where things actually stand right now — chapter, step, phase.)

## Confirmed player knowledge
(ZONE 1 only. If empty, say so clearly and do not list available facts here.)

## Available but not yet revealed
(ZONE 2 facts — label each as "available in state but not yet revealed to players".)

## Open threads to carry forward
(ZONE 3 threads by currentStatus — hot, simmering, dormant. Use the thread IDs and names from state.)

## Strong Chapter 3 candidates
(Threads or available facts most ready to surface. Label DM-only items. Do not invent new ones.)

## Suggested opening pressure
(One or two concrete entry points grounded in state — do not invent scenes or facts.)

## State gaps / needs update
(Null party level/size, missing confirmed knowledge, entityRef gaps, items needing manual update.)`
    : `## Current state
## Player knowledge
(ZONE 1 only — do not attribute available facts to players.)
## Open threads
## Not yet revealed
(ZONE 2 — label as DM-only / not yet revealed.)
## Useful DM notes
## Gaps / needs update`;

  // ── System message ─────────────────────────────────────────────────────────────

  const system = `You are Karsac State Analyst.

You report on table-progress state for the DM — what has happened at this table, what the party currently knows, and which threads are active.

KNOWLEDGE BOUNDARY — READ BEFORE ANSWERING:

The state context below is divided into three zones. You MUST respect this boundary:

ZONE 1 — CONFIRMED PLAYER KNOWLEDGE:
  Only facts marked known=true and handouts with posted=true.
  These are the ONLY things the players know.
  If Zone 1 is empty, the players know nothing yet.

ZONE 2 — AVAILABLE — DM ONLY — NOT YET REVEALED:
  Facts with knowledgeStatus=available and unposted handouts.
  Players have NOT been told these. Do NOT say "the players know" about anything in Zone 2.
  You MAY suggest Zone 2 facts as Chapter 3 candidates, but you MUST label them:
  "available in state but not yet revealed to players."

ZONE 3 — OPEN DM THREADS:
  World threads, radar, NPC state, growth items.
  These describe what the DM is tracking — not what the players know.

FORBIDDEN PHRASES (never write these unless Zone 1 contains evidence):
  - "the players know that..."
  - "the party knows that..."
  - "the party has discovered..."
  - "the party has learned..."
  - "it has been revealed that..." (unless a Zone 1 fact says so)
  - treating any Zone 2 fact as confirmed player knowledge

REQUIRED PHRASES when referencing Zone 2:
  - "available in state but not yet revealed to players"
  - "DM-only until surfaced at the table"
  - "not yet disclosed to players"

OTHER RULES:
  - If knownFacts is 0, write "Players have no confirmed knowledge yet" and do not speculate.
  - If partyLevel or partySize is null, state it has not been confirmed.
  - Use currentStatus for thread status, not defaultStatus.
  - YOUR ANSWER MUST ONLY REFERENCE FACTS, NPCS, LOCATIONS, AND ITEMS NAMED IN THE STATE DATA BELOW.
  - Do NOT invent new facts, scenes, NPCs, or events not present in the state data.
  - If a fact is not listed in ZONE 2, it does not exist in this state — do not mention it.
  - Do not draw on D&D or campaign knowledge beyond what is explicitly in the state data below.
  - For chapter-planning questions: read the STORY ARC POSITION block first and report it accurately.
  - If the current chapter is NOT complete, use conditional language throughout:
      · Use "candidate", "likely", "if [outcome], then" — not "should", "will", "the chapter opens with".
      · Do NOT produce a single definitive opening scene.
      · Tie every recommendation to a specific story arc condition or thread state.
  - If knownFacts=0 or facts are only "available", keep all recommendations conditional.
  - Tie recommendations to the story arc (what Chapter N is building toward) — not only to hot threads.
  - Do not recommend a fixed opening scene unless the state indicates the previous chapter is complete.

OUTPUT FORMAT:
${outputFormat}

STATE DATA:
${div}
${contextBlock}`;

  // ── For chapter-prep: build the arc section text deterministically ──────────
  // We include it in the user message as a pre-written first section so the
  // model cannot omit or reorder it. The model continues from ## Current table state.

  if (isChapterPrep && storyArcBlock) {
    const arcSectionText = buildArcSectionMarkdown(
      cs, threads,
      arcNarrativePhase, arcIsAtChapterEnd,
      arcTransitionLines, arcRecapBullets,
      arcEndStepRecap, arcRemainingLabels,
    );

    // When the current chapter is incomplete, produce conditional carry-forward
    // planning — not a definitive Chapter 3 opening.
    const chapterUserMessage = arcIsAtChapterEnd
      ? `Answer this chapter planning question:
"${question}"

Use EXACTLY the following headings IN THIS ORDER:

${arcSectionText}

## Likely arc transition
[What the story is moving into. Grounded in the end-step recap and hot threads. 1–3 sentences.]

## Current table state
[Where things stand right now: chapter complete, key resolved threads, what carries over.]

## Confirmed player knowledge
[ZONE 1 only. If empty, write "Players have no confirmed knowledge yet."]

## Open threads to carry forward
[ZONE 3 threads by currentStatus. Use thread IDs and names from state.]

## Strong Chapter 3 candidates
[Threads or Zone 2 facts most ready to surface next chapter. Label DM-only items. Do not invent.]

## Suggested opening pressure
[One or two concrete entry points grounded in state.]

## State gaps / needs update
[Null party level/size, missing confirmed knowledge, entityRef gaps.]`

      : `Answer this chapter planning question:
"${question}"

IMPORTANT: The current chapter is NOT complete. Use conditional language throughout.
Use "candidate", "likely", "if [outcome], then", "may" — not "should", "will", "the chapter opens with".

Use EXACTLY the following headings IN THIS ORDER:

${arcSectionText}

## Likely arc transition
[What the story is building toward as Chapter ${cs.currentChapter ?? 2} concludes.
Derive from: the end-step recap in the arc block, hot threads, simmering threads.
Use conditional language — the transition is not decided yet.]

## Chapter ${Number(cs.currentChapter ?? 2) + 1} outcomes that will shape Chapter ${Number(cs.currentChapter ?? 2) + 1}
[What Chapter ${cs.currentChapter ?? 2} needs to resolve before Chapter ${Number(cs.currentChapter ?? 2) + 1} begins.
List each as a binary outcome or open question: "If X happens...", "Whether Y resolves...".
Draw from: remaining step labels, hot threads, end-step recap.
Do not invent outcomes not grounded in state data.]

## Conditional Chapter ${Number(cs.currentChapter ?? 2) + 1} openings
[2–3 opening scenarios, each conditional on a different Chapter ${cs.currentChapter ?? 2} outcome.
Format: "If [Chapter ${cs.currentChapter ?? 2} outcome], Chapter ${Number(cs.currentChapter ?? 2) + 1} opens with [candidate entry point]."
Do NOT produce a single definitive opening.
Label any scenario that uses Zone 2 facts as "DM-only — not yet revealed to players."]

## Threads likely to survive regardless
[Threads that will carry forward irrespective of how Chapter ${cs.currentChapter ?? 2} resolves.
Use thread IDs and names from ZONE 3. Explain briefly why each survives any outcome.]

## State gaps / needs update
[Null party level/size, facts not yet marked revealed, entityRef gaps, items needing manual update.]`;

    return [
      { role: 'system', content: system },
      { role: 'user',   content: chapterUserMessage },
    ];
  }

  return [
    { role: 'system', content: system },
    { role: 'user',   content: question },
  ];
}

/**
 * Build the pre-generated ## Story arc position section for the chapter-prep
 * user message. Uses pre-computed arc values (not the raw arcBlock string)
 * to avoid fragile regex extraction.
 */
function buildArcSectionMarkdown(
  cs: any,
  threads: any[],
  narrativePhase: string,
  isAtChapterEnd: boolean,
  transitionLines: string[],
  recapBullets: string[],
  endStepRecap: string[],
  remainingLabels: string[],
): string {
  const chapter = cs.currentChapter ?? '?';
  const session = cs.currentSession ?? '?';
  const step    = cs.progress?.step ?? 0;
  const hotThreads    = threads.filter(t => t.currentStatus === 'hot');
  const simmerThreads = threads.filter(t => t.currentStatus === 'simmering');

  const lines: string[] = [
    `## Story arc position`,
    ``,
    `**Chapter:** ${chapter}  |  **Session:** ${session}  |  **Progress step:** ${step}`,
    `**Narrative phase:** ${narrativePhase}`,
    ``,
    ...transitionLines,
  ];

  if (!isAtChapterEnd && remainingLabels.length > 0) {
    lines.push(`**Remaining Chapter ${chapter} steps:** ${remainingLabels.join(' → ')}`);
  }

  lines.push('');

  if (recapBullets.length > 0) {
    lines.push(`**Established so far:**`);
    for (const b of recapBullets) lines.push(`- ${b}`);
    lines.push('');
  }

  if (endStepRecap.length > 0) {
    lines.push(`**Chapter ${chapter} is building toward:**`);
    for (const b of endStepRecap) lines.push(`- ${b}`);
    lines.push('');
  }

  if (hotThreads.length > 0) {
    lines.push(`**Hot threads (active pressure):** ${hotThreads.map(t => t.name).join('; ')}`);
  }
  if (simmerThreads.length > 0) {
    lines.push(`**Simmering threads (available to surface):** ${simmerThreads.map(t => t.name).join('; ')}`);
  }

  // Collapse consecutive blank lines
  return lines
    .filter((l, i, a) => !(l === '' && (a[i - 1] === '' || i === 0)))
    .join('\n');
}

// ── Encounter-design profile message builder ──────────────────────────────────

import type { ScoredAdversary, ScoredPattern } from './encounter-design.js'

export interface EncounterDesignCtx {
  adversaries: ScoredAdversary[]
  patterns: ScoredPattern[]
  npcBases: Record<string, string>
  stateData: {
    campaignState: Record<string, unknown> | null
    partyState: Record<string, unknown> | null
    worldThreads: Record<string, unknown> | null
    playerKnowledge: Record<string, unknown> | null
  }
}

export function buildEncounterDesignMessages(
  ctx: EncounterDesignCtx,
  question: string,
): Array<{ role: string; content: string }> {
  const div = '─'.repeat(60)

  // ── Campaign state summary ─────────────────────────────────────────────────
  const cs = (ctx.stateData.campaignState as any) ?? {}
  const ps = (ctx.stateData.partyState as any) ?? {}
  const wt = (ctx.stateData.worldThreads as any) ?? {}
  const pk = (ctx.stateData.playerKnowledge as any) ?? {}

  const stateSummaryLines: string[] = []
  if (cs.currentSession) stateSummaryLines.push(`Session: ${cs.currentSession}  Chapter: ${cs.currentChapter ?? '?'}`)
  if (ps.partyLevel) stateSummaryLines.push(`Party level: ${ps.partyLevel}  Size: ${ps.partySize ?? '?'}`)
  if (cs.clock?.value != null) stateSummaryLines.push(`Clock: ${cs.clock.value}/${cs.clock.max ?? 16}`)
  const hotThreads: any[] = (wt.threads ?? []).filter((t: any) => t.currentStatus === 'hot')
  if (hotThreads.length > 0) stateSummaryLines.push(`Hot threads: ${hotThreads.map((t: any) => t.name).join(', ')}`)
  const knownFacts: string[] = pk.knownFacts ?? []
  stateSummaryLines.push(`Confirmed player knowledge: ${knownFacts.length} facts`)

  const stateSummary = stateSummaryLines.length > 0
    ? stateSummaryLines.join('\n')
    : '(no campaign state loaded)'

  // ── Adversary context block ───────────────────────────────────────────────
  const adversaryLines: string[] = []
  for (const adv of ctx.adversaries) {
    adversaryLines.push(`### ${adv.id}`)
    adversaryLines.push(`Summary: ${adv.summary}`)
    adversaryLines.push(`Opposition type: ${adv.oppositionType.join(', ')}`)
    adversaryLines.push(`Encounter roles: ${adv.encounterRoles.join(', ')}`)
    adversaryLines.push(`Campaign use: ${adv.campaignUse.join(', ')}`)
    adversaryLines.push(`Mechanical base: ${adv.mechanicalBase.join(', ')}`)
    adversaryLines.push(`Can know: ${adv.canKnow.join(' | ')}`)
    adversaryLines.push(`Must not know: ${adv.mustNotKnow.join(' | ')}`)
    adversaryLines.push(`Tactics: ${adv.tactics.join(' | ')}`)
    if (adv.escalation.low) adversaryLines.push(`Escalation low: ${adv.escalation.low}`)
    if (adv.escalation.medium) adversaryLines.push(`Escalation medium: ${adv.escalation.medium}`)
    if (adv.escalation.high) adversaryLines.push(`Escalation high: ${adv.escalation.high}`)
    adversaryLines.push(`Player-safe reveal: ${adv.playerSafeReveal.join(' | ')}`)
    adversaryLines.push(`DM only: ${adv.dmOnly.join(' | ')}`)
    adversaryLines.push(``)
    adversaryLines.push(adv.content.trim())
    adversaryLines.push(``)
    adversaryLines.push(div)
  }

  // ── Pattern context block ─────────────────────────────────────────────────
  const patternLines: string[] = []
  for (const pat of ctx.patterns) {
    patternLines.push(`### ${pat.id}`)
    patternLines.push(`Summary: ${pat.summary}`)
    patternLines.push(``)
    patternLines.push(pat.content.trim())
    patternLines.push(``)
    patternLines.push(div)
  }

  // ── NPC bases block ───────────────────────────────────────────────────────
  const npcBaseLines: string[] = []
  for (const [ref, summary] of Object.entries(ctx.npcBases)) {
    npcBaseLines.push(`${ref}: ${summary}`)
  }

  // ── System message ────────────────────────────────────────────────────────
  const system = `You are Karsac Non-Monster Encounter Designer.

DESIGN PRINCIPLE:
Select encounter PURPOSE first. Then adversary. Then mechanical bases. Generate combat tactics as FALLBACK only.

OUTPUT CONTRACT:
You must produce exactly these 13 sections in this exact order. Do not rename, skip, or reorder them.

1. ## Encounter: [brief scene name]
2. ## Encounter Type
3. ## Campaign Purpose
4. ## Cast
5. ## Opening Beat
6. ## What the Opposition Wants
7. ## What the Players Can Notice
8. ## Pressure Ladder
9. ## Checks and Mechanics
10. ## Player Choices
11. ## Outcomes
12. ## Combat Fallback
13. ## State Updates
14. ## Follow-up Hooks

PLAYER-SAFE CLUE RULE:
If the adversary has player_safe_reveal entries, the encounter MUST use at least one of them directly in ## What the Players Can Notice.
Do not replace core clues with weaker invented alternatives.
The player_safe_reveal entries are canonical clue designs — use them as written or very closely.

DM-ONLY RULE:
dm_only and must_not_know entries inform the scene and DM notes only.
They MUST NOT appear in read-aloud text, ## What the Players Can Notice, ## Opening Beat (player-facing portion), or ## Player Choices.
If you need to state a DM-only fact, place it in ## Campaign Purpose or ## Cast (DM-facing sections only).

NPC BASE RULE — READ CAREFULLY:
If the user specifies NPC types (e.g. "a noble, two guards, and a spy") or the adversary specifies mechanical_base, use those EXACT bases with EXACT quantities.
DO NOT merge two bases into a single NPC (e.g. NEVER "Noble, Spy - modified" — that is one NPC with two bases, which is WRONG).
DO NOT upgrade: guard → veteran, noble → veteran, spy → assassin — unless the user explicitly asks.
DO NOT invent modified stat blocks or assign extra AC/HP/attacks beyond the standard base.
Each NPC gets ONE mechanical base. List them separately.
CORRECT:   "Lead official — Noble base | Two escorts — Guard base | Informant — Spy base"
INCORRECT: "Lead official — Noble/Spy modified | Captain — Veteran (Guard upgrade)"
If you reference a mechanical base, cite it as: "uses the loaded SRD 5.1 [base name] base".

KARSAC FACTION RULE:
- If Mathr is the relevant faction, name the faction as Mathr. Do NOT convert Mathr pressure into Vane pressure.
- Use Vane ONLY where the retrieved corpus explicitly names Vane as relevant to this specific scene.
- The Mathr sigil (crown-over-wave token) and the Vane house mark are DISTINCT symbols. They cannot be used interchangeably.
- False customs authority and dock documents point to the MATHR seal, not a Vane house mark.
- Do not invent Karsac NPC surnames, family names, house names, or personal names not present in the adversary corpus or canon. Use role placeholders ("the lead official", "the escort pair", "the senior officer") if specific names are not given.
- Do not invent payment thresholds, toll rates, or Vane-specific administrative details not present in corpus.

FACTION INVENTION RULE:
DO NOT invent named noble houses (e.g. "House Valerius"), invented family control structures, or invented payment thresholds.
If no faction is named in the query or retrieved adversaries, use neutral role language: "a corrupt official", "an unnamed patron", "a local power", "a minor official's backer".
If you need a placeholder NPC name, use role-based labels: "the lead official", "the senior inspector", "the escort pair" — NOT house-based invented names.
KARSAC STYLE RULE:
Use only period-appropriate physical items. Prefer: seals, ledgers, wax marks, cargo tallies, warrant papers, dock tokens, folded authority documents, witness marks, hand signals, watchers in taverns, copied manifests.
DO NOT invent: scanners, tracking devices, modern files, surveillance technology, forensic devices, or magical tracking beyond what the corpus explicitly describes.

ENCOUNTER DESIGN CONTEXT
${div}

CAMPAIGN STATE:
${stateSummary}

SELECTED ADVERSARIES:
${adversaryLines.length > 0 ? adversaryLines.join('\n') : '(none matched)'}

ENCOUNTER PATTERNS:
${patternLines.length > 0 ? patternLines.join('\n') : '(none matched)'}

NPC MECHANICAL BASES:
${npcBaseLines.length > 0 ? npcBaseLines.join('\n') : '(none referenced)'}
${div}`

  // ── Build player-safe clue injection from top adversary ─────────────────
  const topAdversaryClues = ctx.adversaries[0]?.playerSafeReveal ?? []
  const clueBlock = topAdversaryClues.length > 0
    ? `REQUIRED — include at least one of these player_safe_reveal clues directly:\n` +
      topAdversaryClues.map(c => `  • "${c}"`).join('\n') + `\n` +
      `Do not replace these with weaker invented alternatives.`
    : `Include player-observable clues grounded in the scene context.`

  // ── Detect explicit NPC base specification in the query ────────────────────
  const hasExplicitNpcBases = /\b(?:a |one |two |three |four )?\b(?:noble|guard|spy|scout|veteran|bandit|thug|commoner|priest|mage|acolyte)\b/i.test(question)
  const npcBaseConstraint = hasExplicitNpcBases
    ? `\nIMPORTANT: The user specified explicit NPC bases in the query. Use EXACTLY those bases with EXACTLY those quantities. Do NOT merge, modify, or upgrade them. Each NPC gets ONE base only.\n`
    : ''

  // ── User message ──────────────────────────────────────────────────────────
  const user = `Design this encounter:
"${question}"
${npcBaseConstraint}
Use EXACTLY these headings IN THIS ORDER. Do not rename, skip, or reorder them.

# Encounter: [write a brief scene name — 2-5 words]

## Encounter Type
[e.g. social obstruction, information extraction, procedural delay, faction pressure]

## Campaign Purpose
[Why does this encounter exist in the story? What pressure, clue, choice or consequence does it create?]

## Cast
[List the NPCs. For each: role, Karsac adversary source if used, D&D mechanical base (ONE per NPC), what they want, what they know, what they must not know.
If the user specified NPC types, use those EXACT bases. Do not merge bases. Do not invent house names — use role labels.]

## Opening Beat
[A short DM-facing scene description to open the encounter — 2-4 sentences.]

## What the Opposition Wants
[The actual objective: delay, extract information, separate the party, create a legal pretext, etc.]

## What the Players Can Notice
[${clueBlock}
Add DC values: DC 10 obvious / DC 12 useful / DC 15 deep suspicion / DC 18+ operational detail.]

## Pressure Ladder
Low: [routine pressure]
Medium: [more specific/invasive]
High: [risk of detention, exposure, combat, or public confrontation]

## Checks and Mechanics
[List likely checks (Insight, Investigation, Perception, Persuasion, Deception, Intimidation, Sleight of Hand, Stealth, History, etc). For each: what does success / partial success / failure mean?]

## Player Choices
[At least 3 meaningful approaches: comply, challenge, bribe, split group, distraction, follow, expose, etc.]

## Outcomes
[Clear success, partial success, costly success, failure, fail-forward consequence. The encounter should move the story forward even on failure.]

## Combat Fallback
[Only if violence is plausible. Use generic NPC bases. Make clear combat is not the intended centre.]

## State Updates
[Suggested campaign state changes after the scene.]

## Follow-up Hooks
[2-4 consequences or next scenes.]`

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}

// ── Adversary design message builder ─────────────────────────────────────────

import type { AdversaryDesignContext, AdversaryProposalConstraints } from './adversary-design.js'
import { formatConstraintBlock } from './adversary-design.js'

export type { AdversaryDesignContext }

/**
 * Build the model-facing messages for an adversary-design query.
 *
 * The system message includes the base stat block, Karsac adversary corpus
 * context, balance rules, and style guardrails. The user message is a
 * template with all section headings pre-filled for first-pass compliance.
 */
export function buildAdversaryDesignMessages(
  ctx: AdversaryDesignContext,
  question: string,
  constraints?: AdversaryProposalConstraints,
): Array<{ role: string; content: string }> {
  // Build locked constraint block — injected at the top of the system message.
  // When constraints are present, they override all model defaults.
  const constraintBlock = constraints ? formatConstraintBlock(constraints) : ''
  const div = '─'.repeat(60)

  // ── Campaign state summary ──────────────────────────────────────────────────
  const cs = (ctx.stateData.campaignState as any) ?? {}
  const wt = (ctx.stateData.worldThreads  as any) ?? {}
  const ns = (ctx.stateData.npcsState     as any) ?? {}
  const stateLines: string[] = []
  if (cs.currentSession) stateLines.push(`Session ${cs.currentSession} / Chapter ${cs.currentChapter ?? '?'}`)
  const hotThreads: any[] = (wt.threads ?? []).filter((t: any) => t.currentStatus === 'hot')
  if (hotThreads.length > 0) stateLines.push(`Hot threads: ${hotThreads.map((t: any) => t.name).join(', ')}`)
  const npcs: any[] = (ns.npcs ?? []).filter((n: any) => {
    const lq = question.toLowerCase()
    return n.name.toLowerCase().split(/\s+/).some((w: string) => w.length > 4 && lq.includes(w))
  }).slice(0, 3)
  for (const npc of npcs) stateLines.push(`NPC in state: ${npc.name} [${npc.status}] — ${npc.location}`)

  const stateSummary = stateLines.length > 0 ? stateLines.join('\n') : '(no campaign state loaded)'

  // ── Base stat block context ─────────────────────────────────────────────────
  const baseBlock = ctx.baseFile
    ? `MECHANICAL BASE LOADED: ${ctx.baseFile.id}\n${div}\n${ctx.baseFile.content}\n${div}`
    : '(No base file loaded — choose the most appropriate SRD base and explain the choice.)'

  // ── Karsac adversary corpus context ────────────────────────────────────────
  const advLines: string[] = []
  for (const adv of ctx.relatedAdversaries) {
    advLines.push(`### ${adv.id} — ${adv.summary}`)
    advLines.push(`Tactics: ${adv.tactics.slice(0, 3).join(' | ')}`)
    advLines.push(`Player-safe reveal: ${adv.playerSafeReveal.slice(0, 2).join(' | ')}`)
    advLines.push(`DM only: ${adv.dmOnly.slice(0, 2).join(' | ')}`)
    advLines.push(div)
  }
  const advBlock = advLines.length > 0
    ? `KARSAC ADVERSARY CONTEXT:\n${advLines.join('\n')}`
    : '(No matching Karsac adversary corpus context loaded.)'

  const doctrineFidelityBlock = ctx.relatedAdversaries.length > 0
    ? `DOCTRINE FIDELITY RULE — BINDING (adversary corpus is loaded):
The tactics, can_know, and must_not_know fields in KARSAC ADVERSARY CONTEXT are BINDING DOCTRINE.
- Tactics = operational doctrine. Reproduce it faithfully. DO NOT substitute, invert, or replace it.
- If ANY tactic entry mentions "delay", "information over combat", "not a body count", "social obstruction", "leave a route to compliance", or "compliance" as a goal: the adversary is DELAY-PRIMARY / SOCIAL-PRIMARY. You MUST NOT label or design it as "combat-led" or "combat-primary". Combat is a fallback only.
- If tactics say "mission completion over engagement" or "observe before striking": combat is SECONDARY. The adversary delays, observes, and retreats rather than fighting to kill.
- If tactics say "strike quality not slaughter": lethal-capable but disciplined — NOT a non-lethal ideology, NOT a social bureaucrat.
- must_not_know = absolute restrictions. Do NOT portray this adversary as possessing that knowledge anywhere in the proposal.
- can_know = the ceiling of this adversary's knowledge. Do NOT exceed it.
- The proposal's can_know and must_not_know sections MUST match the corpus entries above.

ADVERSARY IDENTITY RULE — BINDING (named adversary group in prompt):
If the user prompt names a specific Karsac adversary group (e.g. "Shadow Walker", "Mathr road agent") AND that group appears in KARSAC ADVERSARY CONTEXT above:
- The generated adversary MUST be a variant, member, or operational arm of that named group.
- Do NOT create an unrelated new adversary type (e.g. a generic "dockworker" or "toll inspector") and assign it the named group's corpus. The adversary's faction, operational signature, and core tactics MUST match the named group.
- Surface cover (dockworker disguise, road warden guise) is flavour only — the underlying adversary is still a member of the named group with that group's doctrine intact.

`
    : ''

  // ── System message ──────────────────────────────────────────────────────────
  const system = `${constraintBlock}You are Karsac Adversary Designer.

You create and adapt D&D 5e 2014 adversaries from prose descriptions.
Creativity is allowed in identity, prose, theme, tactics, and custom abilities.
Mechanical output must be precise, runnable at the table, and traceable to the chosen base.

CORE RULE:
- Start from the user's requested base (or choose from the AVAILABLE BASES list below).
- Clearly state what changed from the base and why.
- Mark all homebrew as provisional.

AVAILABLE BASES RULE (item 2):
You may ONLY cite a base that was loaded in MECHANICAL BASE LOADED above.
Do NOT cite: "Cult Fanatic (MM p. 223)", "Rogue (Thief)", "Ranger", "Paladin", "Barbarian", or any character-class-based or Book-page reference.
These are NOT SRD NPC stat blocks. The valid SRD NPC/monster names are:
spy | noble | guard | bandit | bandit captain | thug | scout | veteran | mage | priest | acolyte | assassin | archmage | commoner
If no base is loaded, choose the closest available SRD NPC base and explain why.
The Mechanical Base section MUST cite the loaded path: e.g. "Base: monsters/srd-2014/spy".

FACTION PRESERVATION RULE:
If the user prompt says "part of the Shadow Walkers faction" or names any specific faction:
- That exact faction MUST appear in ## DM-Only Notes as the adversary's faction affiliation.
- That exact faction slug MUST appear in related.factions in the Corpus Frontmatter.
- Do NOT substitute Mathr, Yngondi, Vishara or another faction — even if related. Shadow Walkers ≠ Mathr.
- Comparing to a faction ("not as dangerous as Shadow Walkers") is NOT sufficient. The adversary must BELONG to that faction.
- WRONG: "acting as eyes and ears for Mathr" when prompt said Shadow Walkers.
- RIGHT: "Veilwards are Shadow Walker faction operatives, adapted for urban infiltration."
  DM-Only Notes: "This adversary is a Shadow Walker variant. Related factions: shadow-walkers."

KARSAC COMMUNICATION PROPS RULE:
Do NOT use: encrypted device, communications device, device (for information-passing), tracker, scanner.
Use instead: coded tally, waxed cipher strip, knotted cord, marked bone sliver, folded harbour chit, salt-marked message, whispered order, runner, hand signal, copied manifest.

ADAPTATION CONSISTENCY RULE:
Your ## Adaptation Summary MUST match your ## Stat Block exactly.
- "Kept from base:" must only list things that LITERALLY APPEAR in the base stat block loaded above AND in your generated stat block.
- DO NOT list tool proficiencies (Disguise Kit, Thieves' Tools, Poisoner's Kit) as "Kept" unless they are explicitly in the base stat block. They are typically not listed in SRD NPCs.
- DO NOT list "Expertise" as "Kept" unless the base stat block has an Expertise trait. The Spy base has Sneak Attack, not Expertise.
- Skill proficiencies listed in the Skills line (e.g. "Stealth +4") count as "Kept" — write them as "Stealth proficiency" not "Stealth +4".
- If you removed a base trait/action, you MUST list it under "Removed:". If you kept Sneak Attack, it must appear in Traits.
- For SOCIAL-LED adversaries: prefer removing Multiattack and Sneak Attack, listing both under "Removed:".
- Contradictions between "Kept" and the stat block are a validation failure.
- "Kept: Spy-like social/stealth role" is a label, not a trait — acceptable shorthand for the role description, but do not list specific abilities this way.

BALANCE RULES:
- Do not inflate AC, HP, attack bonus AND damage all at once. Adjust one or two, not all.
- Prefer one signature ability over several complicated ones.
- Save DCs: weak NPC DC 10–12 | competent agent DC 13–14 | elite DC 15–16 | boss DC 17+ (justify).
- No legendary resistance/actions/lair actions unless explicitly a boss.
- If social-led, keep combat output modest. Social-led adversaries do NOT fight to the death.
  They escape, call guards, destroy papers, deny everything, or create a public scene.
- If combat-led, keep social abilities from dominating.
- Mark CR as provisional if custom abilities significantly change the base.
- Note "Mechanical risk:" if the adaptation may be stronger than the base.

ALLY COMMAND RULE (item 3):
Commands given to ALLIED creatures do NOT require saving throws.
An ally obeys without rolling. Use this pattern instead:
  Command. (Bonus Action) Korrigan chooses one allied creature within 30 ft. that can hear him.
  That creature can use its reaction to move up to half its speed or make one weapon attack.
NEVER write: "a bandit must succeed on a Wisdom saving throw or follow the command."
Save DCs apply only to enemies or unwilling creatures.

SENSES AND LANGUAGES RULE:
Only add darkvision, unusual languages, resistances, immunities, or special senses if:
- the base already has them, OR
- the user explicitly asked for them, OR
- you explain in ## Adaptation Summary (under "Added:") exactly why they were added.
Otherwise, use only what the base provides.
EXAMPLES OF WHAT TO AVOID:
- Base is Noble/Human NPC → do NOT add Darkvision 60 ft. (humans have no darkvision).
- Base is Spy/Noble/Guard → do NOT add Undercommon, Thieves' Cant or rare languages unless explained.
If you see the base stat block above does not have darkvision → you MUST NOT add it.

ABILITY NAME CONSISTENCY RULE:
Every ability's text MUST use the CURRENT adversary's own name (or "this creature" / "this NPC").
NEVER use the name of a different adversary or a character from a previous generation.
WRONG: "Salt-Witness has 'Whispered Orders. Korrigan chooses...'" (Korrigan is a different adversary)
RIGHT: "Whispered Orders. The Salt-Witness chooses one creature within 30 feet..."
Review your ability text before writing it. Use only this adversary's name.

ACTION ECONOMY CONSISTENCY RULE:
If an ability IS a bonus action, place it ONLY under ## Bonus Actions (never under ## Actions).
If you write "(Bonus Action)" in the ability description, it MUST be under Bonus Actions.
WRONG: Under ## Actions: "Misinformation. (Bonus Action) The agent..."
RIGHT: Under ## Bonus Actions: "Misinformation. The agent..."
The rule: the section heading (Actions vs Bonus Actions) and the ability text MUST agree.

SOCIAL ABILITY MECHANICS RULE:
For social or procedural abilities used OUTSIDE initiative, use scene consequences — not round-based delays.
WRONG: "delayed for 1d4 rounds"
RIGHT scene consequences:
- "loses 10–30 minutes navigating re-inspection"
- "must answer one additional question before being cleared"
- "the opposition gains one useful piece of information about the party's plans"
- "pressure ladder advances by one step"
Every social or special ability must use ONE mechanic model, not two:
  Option A (saving throw): "DC 14 Wisdom saving throw or [effect]."
  Option B (contested check): "Make a Charisma (Intimidation) check contested by Wisdom (Insight). On a success, [effect]."
DO NOT mix a save DC and a contested check in the same ability unless the effects are clearly distinct.

BOSS FIGHT RULE:
If the user says "not a boss fight", "social threat", "not for combat", or similar:
Do NOT include boss scaling that summons allies, adds combat escalation, or creates legendary abilities.
For ## Scaling Options prefer:
- Stronger social version (broader influence, harder to expose, better positioned)
- Harder-to-detect version
- Wider network version
Label any combat escalation option explicitly as OPTIONAL and mark it as NOT DEFAULT.

HP FORMULA RULE:
If CON modifier is positive, the HP formula MUST include the CON bonus.
Example: 6d8, CON 12 (+1) → HP 33 (6d8 + 6), NOT 27 (6d8).
Example: 6d8, CON 10 (+0) → HP 27 (6d8) is correct.
Bonus = number of dice × CON modifier.

DAMAGE FORMULA RULE:
The stated average damage must match the dice formula.
Average of XdY + Z = floor(X × (Y+1) / 2) + Z.
WRONG: "Hit: 3 (1d6 + 2)" — average of 1d6+2 is 5–6, not 3.
RIGHT: "Hit: 5 (1d6 + 2)" or "Hit: 6 (1d6 + 3)".
Check every attack's stated average before outputting.

SKILLS RULE:
D&D 5e 2014 does NOT have a Diplomacy skill. Use Persuasion.
Valid social skills: Deception, Insight, Intimidation, Performance, Persuasion.
Do not list Diplomacy, Bluff, Sense Motive, or skills from other game systems.

NO ABSOLUTE SOCIAL COMPULSION RULE:
Do NOT write: "Failure means the party must comply."
This removes player agency and creates a mandatory outcome.
Use instead: "On a failure, the target treats the authority as legitimate and the pressure ladder escalates if they refuse." or "On a failure, the target has disadvantage on its next social check against this adversary."
Effects should constrain options, not eliminate them.

SOCIAL-LED DURABILITY RULE:
If the user says "social threat", "not a boss fight", "physically weak", or similar:
- HP should be modest (close to base, +20% maximum)
- No passive fear auras as default
- No broad charm effects as default
- No summoning allies as default
Prefer a single, well-designed social ability over multiple combat-heavy features.

SIGNATURE ABILITY RULE:
If you add a signature social or procedural ability, it MUST have a scene-facing effect.
NOT acceptable: "The NPC makes a DC 12 Intelligence check to identify inconsistencies." (self-check — no scene effect)
ACCEPTABLE effects:
- The party is delayed (a specific cost: "loses 10–20 minutes", "pressure ladder escalates by one step")
- NPC learns one useful detail about the party (specify what: cargo, names, destination)
- Target has disadvantage on its next Persuasion, Deception, or Investigation check in this scene
- The party must answer one additional specific question before being cleared
- One party member is separated for further questioning (scene consequence, not a free move)
The ability MUST answer: "What changes in the scene as a result of this ability?"

SOCIAL-LED MULTIATTACK RULE:
If the user says "more useful in social pressure than combat", "social threat", "social-led", or similar:
- Remove Multiattack (list it under "Removed:" in Adaptation Summary)
- Replace with a single attack action (one weapon, base attack bonus, standard damage)
- If Multiattack is kept despite a social brief, add this note in Tactics:
  "This adversary can survive a brief fight but will disengage rather than press an attack."
- Do not give a social-led adversary Multiattack AND a passive fear aura AND social abilities — choose one direction.

PASSIVE AURA RULE:
Do NOT give social adversaries always-on passive presence/fear auras as a default.
For grounded, non-supernatural social adversaries, use once-per-scene active abilities instead.
WRONG: "Intimidating Presence. All creatures within 30 ft. have disadvantage on attack rolls."
RIGHT: "Demand Tribute. Once per scene, the adversary makes a Charisma (Intimidation) check contested by Wisdom (Insight). On success, the target has disadvantage on its next social check against this adversary."

KARSAC STYLE GUARDRAILS:
Prefer: seals, ledgers, copied manifests, harbour ledgers, sealed arrival lists, port records, wax marks, authority papers, cargo tallies, warrants, tally sticks, old authority, weather, oath language, iron/salt/bone/ash/wet wool/old stone, whispered orders, formal violence, social pressure before steel.
Avoid unless requested: scanners, tracking devices, databases, modern files, modern surveillance, generic fantasy guilds, anime powers, superhero abilities, spell names unless spellcasting is actually used.
NEVER write: "access to a database", "surveillance system", or any modern technology phrase.
Replace with: "copied manifests", "harbour ledgers", "sealed arrival lists", "Mathr reports".

NAMED ENTITY RULE (item 8):
Do NOT invent named houses, towns, factions, gods, or additional NPCs (captains, contacts, agents) unless:
- the user asked for them, OR
- they exist in the loaded corpus, OR
- you label them: "Provisional name: <name>".
If Mathr is the relevant faction, use Mathr. Do not invent Vane control unless corpus names it.
Use: "an unnamed Mathr handler" rather than inventing a specific named NPC.
Do not reference named NPCs from the campaign (like "Captain Cumbria") unless explicitly in state.

PLAYER-SAFE vs DM-ONLY:
- Player-safe reveals: observable details, behavioural tells, document weirdness, physical tells.
- DM-only: true faction, hidden agenda, what they know, what they must not know.

VALIDATION RULE:
Output fails if:
- No mechanical base is named, or the base is not in the loaded corpus.
- No full stat block is produced, or it lacks AC, HP, speed, ability scores, actions, CR.
- "Kept from base" in Adaptation Summary lists traits that do not appear in the stat block.
- A user-requested base is ignored or silently substituted.
- A custom ability is vague or not mechanically runnable.
- A social-led adversary "fights to the death" without an escape/de-escalation note.
- An ally ability uses a saving throw (allies obey without rolling).
- Darkvision or unusual senses appear when the base has none and no explanation is given.
- An ability under ## Actions says "(Bonus Action)" — bonus action abilities go under ## Bonus Actions only.
- Ability text uses a different adversary's name (stale name from a previous design).
- A social ability uses "1d4 rounds" or similar initiative-round delay for a non-combat scene.
- A modern tech phrase ("database", "surveillance") is used.
- A faction/place/NPC is invented without "Provisional name:".
- User said "not a boss fight" but boss scaling includes non-optional combat escalation.
- HP formula omits CON modifier bonus when CON is > 10.
- Damage average does not match its dice formula (±1 tolerance).
- "Diplomacy" used as a skill (not a 5e skill; use Persuasion).
- Social ability uses absolute compulsion ("the party must comply").
- Social-led adversary has always-on passive fear/presence aura as default.
- Social-led adversary has HP 45+ when user said "not a boss fight" or "social threat".

ADVERSARY DESIGN CONTEXT
${div}
CAMPAIGN STATE:
${stateSummary}

${baseBlock}

${advBlock}

${doctrineFidelityBlock}`

  // ── Variant / modular detection ───────────────────────────────────────────
  // If the prompt asks for modular options (choose X out of Y, never identical,
  // DM can choose, variants), add a ## Variant Options section to the template.
  const isVariantAdversary =
    /\bvariant\b|\bmodular\b|\bdm\s+can\s+choo?s\b|\bx\s+out\s+of\s+y\b|\bnever\s+identical\b|\bchoose\s+\d+\b|\boptional\s+(?:traits?|actions?|reactions?)\b/i
      .test(question)

  const variantOptionsSection = isVariantAdversary ? `
## Variant Options
This adversary has modular components so no two instances are identical. The DM selects from the lists below.

**Choose 2 traits from:**
[List 4–6 optional traits. Each must be a complete mechanic, not just a name.
Example: **Local Knowledge.** The adversary has advantage on Intelligence checks related to local customs, trade routes, civic offices, and known public figures in the settlement.]

**Choose 1 signature action from:**
[List 3–4 optional signature actions with attack bonus, range, damage, and any rider effect or save DC.
Example: **False Lead.** One creature the adversary can speak to within 30 feet must succeed on a DC 13 Wisdom (Insight) check or pursue a planted false lead until the end of its next turn.]

**Choose 1 reaction from:**
[List 2–3 optional reactions. Each should change how the adversary survives or responds to being exposed.
Example: **Evasive Manoeuvre.** When a creature misses the adversary with an attack, the adversary can move up to half its speed without provoking opportunity attacks.]

Note: The Stat Block above shows BASE traits/actions only. Variant options are listed here and applied at the DM's discretion. Not all instances carry the same options.
` : ''

  // ── User message — pre-filled section template ─────────────────────────────
  // When constraints specify a preferred base, lock it in the user message template.
  const baseLine = ctx.baseFile
    ? `Base: ${ctx.baseFile.id} — ${ctx.baseFile.name}`
    : constraints?.preferredBase
      ? `Base: npc-bases/srd-2014/${constraints.preferredBase} — REQUIRED by prompt constraints`
      : `Base: [choose the closest SRD NPC or monster base and state why]`

  const user = `Design this adversary:
"${question}"

Use EXACTLY these headings IN THIS ORDER. Do not rename, skip, or reorder them.

# Adversary: [write a name — may be evocative]

## Design Intent
[Role in play, threat level, use case. Is this combat-led, social-led, magical, factional, or hybrid?]

## Mechanical Base
${baseLine}
Reason: [why this base fits the concept]

## Adaptation Summary
- Kept from base: [list ONLY what actually appears in your stat block below]
- Changed from base: [what you modified — be specific]
- Added: [new traits/actions not in the base]
- Removed: [base traits/actions you deliberately dropped — list them here if they are NOT in your stat block]
- Mechanical risk: [note if adaptation is stronger than base]

## Stat Block

**[Adversary Name]**
*[Size], [creature type], [alignment if useful]*

**Armour Class** [value and armour type]
**Hit Points** [value (dice formula)]
**Speed** [value]

| STR | DEX | CON | INT | WIS | CHA |
|-----|-----|-----|-----|-----|-----|
| [score (+mod)] | ... | ... | ... | ... | ... |

**Saving Throws** [if any]
**Skills** [skill list with bonuses]
**Damage Resistances** [if any]
**Condition Immunities** [if any]
**Senses** [passive Perception N, other senses]
**Languages** [languages. Avoid forbidden-faction tongues unless corpus-backed. Prefer Common, faction signs, one local trade tongue.]
**Challenge** [CR] ([XP]) · Proficiency Bonus +[N]

### Traits
[Custom traits — short and mechanically precise]

### Actions
[All actions: name, attack bonus, range, target, damage, damage type, rider effects, save DCs]

### Bonus Actions
[If any]

### Reactions
[If any]
${variantOptionsSection}
## Tactics
[Opening move, target priority, preferred range, terrain use, escape behaviour, morale, response when exposed.
If social-led: escape/deny/create scene instinct before any fighting. Do not say "fights to the death" for social-led adversaries.]

## Doctrine Under Pressure
[What the adversary does on round one if attacked, how it avoids being pinned down, what it prioritises preserving, when it retreats, what it does if escape is impossible, and what it will not do even under pressure.
The mechanics in the stat block must make this behaviour plausible against a combat-optimised party.]

## Social / Investigation Use
[Deception pattern, what they ask, what they notice, what checks expose them, what they reveal accidentally.
Use Karsac-appropriate props: ledgers, cargo lists, sealed manifests, harbour records, waxed cipher strips, knotted cords, marked bone tallies, dead-drop marks, folded harbour chits — not databases, encrypted pendants, or modern devices.]

## Player-Safe Description
[What players observe. No hidden truth. 2–4 sentences, suitable for read-aloud or paraphrase.]

## DM-Only Notes
[Hidden agenda, faction connection, limitations, what they know, what they must not know]

## Scaling Options
- Weaker version:
- Stronger version:
- Non-combat version:
- Boss version (if appropriate):

## Corpus Frontmatter
[Only include this section if the user asked to save or generate a corpus entry. Otherwise omit it.
If included, use EXACTLY this YAML schema:]

\`\`\`yaml
---
id: adversaries/<slug>
type: adversary
visibility: dm-only
canonical: provisional
ruleset: dnd-5e-2014
tags: [adversary, <role-tag>, <faction-tag>, <region-tag>, chapter-X]
opposition_type: [<e.g. social-obstacle, faction-agent, deceiver, combatant>]
encounter_roles: [<e.g. interrogator, blocker, social-pressure, combatant>]
campaign_use: [<e.g. social-obstruction, information-extraction, dock-pressure, chapter-3>]
mechanical_base:
  - npc-bases/srd-2014/<base>
mechanical_status: homebrew-adaptation
homebrew_adjustments:
  status: provisional
  notes: "<one sentence: what changed from base and why>"
can_know:
  - <what this adversary knows — list each as a bullet>
must_not_know:
  - <what this adversary must NOT know — cosmological secrets, Vishara's purpose, etc.>
tactics:
  - <tactical behaviour bullet 1>
  - <tactical behaviour bullet 2>
escalation:
  low: "<low-pressure behaviour>"
  medium: "<medium-pressure behaviour>"
  high: "<high-pressure behaviour — when combat/detention/exposure becomes possible>"
player_safe_reveal:
  - "<what players can observe — without DM-only truth>"
  - "<another observable detail>"
dm_only:
  - "<DM-only truth about this adversary>"
  - "<what they are really doing>"
related:
  factions: []
  places: []
summary: "<One sentence: what this adversary is and does>"
---
\`\`\``

  return [
    { role: 'system', content: system },
    { role: 'user',   content: user },
  ]
}

export function buildDeepLoreExtractionMessages(
  canon: CanonFile,
): Array<{ role: string; content: string }> {
  return [
    {
      role: 'system',
      content: `You are Karsac Direct Fact Extractor.

Extract only direct canon facts from the supplied file.

Rules:
- Use only the supplied file.
- Do not infer.
- Do not interpret.
- Do not synthesise across files.
- Do not explain hidden structure.
- Do not invent motives, causes, roles, relationships, ages, durations, or cosmic meaning.
- If a fact is not explicitly stated in the file, omit it.
- Prefer exact wording or close factual paraphrase.
- Cite every bullet with the canon file ID.
- Return 5–10 high-confidence facts only.
- If the file contains DM-only facts, include them, but do not interpret them.

Canon File:
[${canon.id}]

Canon Context:
\`\`\`markdown
${canon.content}
\`\`\``,
    },
    {
      role: 'user',
      content: `Extract the facts from [${canon.id}] as instructed.

Return exactly:

Extracted facts: ${canon.id}
...`,
    },
  ];
}

export function buildDeepLoreFromFactsMessages(
  packets: FactPacket[],
  question: string,
): Array<{ role: string; content: string }> {
  const packetBlocks = packets
    .map(p => `--- FACTS: ${p.canon.id} ---\n${p.facts.trim()}`)
    .join('\n\n');

  const system = `You are Karsac Deep Lore Analyst.

You are analysing hidden campaign truth using only the extracted fact packets below.

Rules:
- Use only the extracted fact packets.
- Do not return to the original Markdown files.
- Do not add new facts.
- Do not invent missing lore.
- Direct canon facts must be copied or closely paraphrased from the extracted facts only.
- Cross-file synthesis belongs under \`## Hidden structure\`.
- Thematic or uncertain readings belong under \`## DM interpretation\`.
- Gaps belong under \`## Not stated / uncertain\`.
- Cite canon file IDs for factual claims.
- Do not write prose, boxed text, or player-facing exposition.

OUTPUT CONTRACT — DEEP LORE MODE

You must use exactly these five headings. Do not add an introduction. Do not rename headings.

Start your answer with exactly:

## Direct canon facts

Then use this structure:

## Direct canon facts
- Only facts explicitly present in the extracted fact packets.
- No synthesis. No causal claims unless directly stated in a fact packet.
- Do not use "therefore", "this means", "is the purpose of", or "ultimate goal" unless directly stated.
- Cite every bullet with the file ID.

## Hidden structure
- Supported cross-file connections only.
- This is where relationship mapping belongs.
- Only include connections that are supported by two or more fact packets.

## DM interpretation
- Reasonable readings and campaign implications.
- Use cautious language: "This suggests…", "A useful DM reading is…", "This may indicate…"
- No new facts. No invented lore.

## Not stated / uncertain
- Anything not settled by the fact packets.
- List gaps, ambiguities, and absent information.

## Useful table guidance
- Short, practical guidance for the DM at the table.
- No new canon.

Extracted Fact Packets:
${'─'.repeat(60)}
${packetBlocks}
${'─'.repeat(60)}`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: question },
  ];
}

export function buildExtractionMessages(
  canon: CanonFile,
): Array<{ role: string; content: string }> {
  return [
    {
      role: 'system',
      content: `You are Karsac Canon Extractor.

Extract only direct canon facts from the supplied file.

Rules:
- Use only the supplied file.
- Do not infer.
- Do not interpret.
- Do not summarise thematically.
- Do not invent ages, roles, durations, motives, relationships, or traits.
- If a fact is not explicitly stated in the file, omit it.
- Prefer exact wording or close factual paraphrase.
- Cite every bullet with the canon file ID.
- Return 5–8 high-confidence facts only.
- Do not include DM interpretation.
- Do not include facts from related entities unless this file explicitly states them.

Canon File:
[${canon.id}]

Canon Context:
\`\`\`markdown
${canon.content}
\`\`\``,
    },
    {
      role: 'user',
      content: `Extract the facts from [${canon.id}] as instructed.`,
    },
  ];
}

export function buildComparisonFromFactsMessages(
  packets: FactPacket[],
  question: string,
): Array<{ role: string; content: string }> {
  const packetBlocks = packets
    .map(p => `--- FACTS: ${p.canon.id} ---\n${p.facts.trim()}`)
    .join('\n\n');

  const system =
    `You are a Karsac Canon Analyst and Dungeon Master's assistant for the Karsac campaign setting.

The following fact packets were independently extracted from ${packets.length} canon files.
Answer the user's comparison question using ONLY the facts in these packets.

Rules:
- Do not merge facts between entities.
- Only state a fact under the entity whose packet contains it.
- Cite every bullet with the file ID shown in the packet header.
- Do not invent, infer, or extrapolate any fact not present in the packets.
- Do not draw on any knowledge outside these packets.
- If a packet contains no relevant facts for the question, say so for that entity.

Interpretation rule:
- Put directly stated facts under "Direct canon facts".
- Put reasonable inferences or thematic readings under "DM interpretation".
- Put anything uncertain or absent from the packets under "Not stated / uncertain".
- Do not present metaphorical, thematic, or inferred readings as direct canon.

EXTRACTED FACT PACKETS
${'─'.repeat(60)}
${packetBlocks}
${'─'.repeat(60)}

` + buildComparisonContract(packets.map(p => p.canon));

  return [
    { role: 'system', content: system },
    { role: 'user', content: question },
  ];
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text.trim().split(/\s+/);
}

function stripEdgePunct(phrase: string): string {
  return phrase.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').trim();
}

function resolveCanonicalId(entity: Entity): string {
  if (entity.type === 'entity-card' && entity.primaryDetailFile) {
    return entity.primaryDetailFile;
  }
  return entity.id;
}

/**
 * Original single-entity resolver — accepts any confident best-match, including
 * possessive and alias matches. Used as fallback when strict multi-entity pass
 * finds nothing.
 */
function resolveSingle(
  question: string,
  aliases: AliasMap,
  entities: EntityMap,
): ScoredMatch | null {
  const words = tokenize(question);
  let best: ScoredMatch | null = null;

  for (let n = Math.min(4, words.length); n >= 1; n--) {
    for (let i = 0; i <= words.length - n; i++) {
      const phrase = words.slice(i, i + n).join(' ');
      if (n === 1 && (STOP_WORDS.has(phrase.toLowerCase()) || phrase.length < 3)) continue;

      const normalized = stripEdgePunct(phrase);
      if (!normalized) continue;

      const ids = aliases[normalized.toLowerCase()];
      if (!ids || ids.length === 0) continue;

      const ranked = scoreMatches(normalized, ids, entities);
      if (ranked.length === 0) continue;

      const top = ranked[0];
      const confident = isBestMatch(ranked);

      const better =
        !best ||
        (confident && !isBestMatch([best])) ||
        (confident === isBestMatch([best]) && top.score > best.score);

      if (better) best = top;
    }
  }

  return best;
}

// ── Comparison-query resolution ───────────────────────────────────────────────

/**
 * Returns true when the question is an explicit comparison request:
 * starts with compare/contrast/difference-between, or uses versus/vs.
 * Plain "and" alone is not treated as a comparison trigger so that
 * "Tell me about Brynja and her hall" keeps its single-entity behaviour.
 */
function isComparisonQuery(question: string): boolean {
  const q = question.toLowerCase().trim();
  if (/^(?:compare|contrast|comparing|contrasting)\s+/.test(q)) return true;
  if (/^(?:the\s+)?differences?\s+between\s+/.test(q)) return true;
  if (/^what(?:'s|\s+is)\s+the\s+differences?\s+between\s+/.test(q)) return true;
  if (/\bversus\b|\bvs\.?\b/.test(q)) return true;
  return false;
}

/**
 * Split a comparison question into candidate entity phrases.
 *
 * "Compare Brynja and The Carver"            → ["Brynja", "The Carver"]
 * "Compare Brynja, Aldric Vane, and The Carver" → ["Brynja", "Aldric Vane", "The Carver"]
 * "Compare Brynja and Brynja's Ledger"       → ["Brynja", "Brynja's Ledger"]
 * "Tell me about Brynja"                     → null  (not a comparison)
 *
 * Returns null when the question is not a comparison query or when splitting
 * yields fewer than two non-empty phrases.
 */
function splitComparisonPhrases(question: string): string[] | null {
  if (!isComparisonQuery(question)) return null;

  let text = question.trim();

  // Strip leading comparison command
  text = text.replace(/^(?:compare|contrast|comparing|contrasting)\s+/i, '');
  text = text.replace(/^(?:the\s+)?differences?\s+between\s+/i, '');
  text = text.replace(/^what(?:'s|\s+is)\s+the\s+differences?\s+between\s+/i, '');

  // Normalise connectors to a single pipe separator.
  // Longer/more specific patterns must come first.
  text = text
    .replace(/\s*,\s*and\s+/gi, '|')   // ", and " (Oxford comma)
    .replace(/\s+versus\s+/gi, '|')
    .replace(/\s+vs\.?\s+/gi, '|')
    .replace(/\s+and\s+/gi, '|')
    .replace(/\s*,\s*/g, '|');

  const phrases = text.split('|').map(p => p.trim()).filter(p => p.length > 0);
  return phrases.length >= 2 ? phrases : null;
}

/**
 * Find candidate entity IDs for a phrase via prefix scan of the alias map.
 * Used when the exact alias key doesn't exist but a parenthetical suffix does:
 * "brynja's ledger" → "brynja's ledger (cargo record)" → items/brynjas-ledger
 */
function aliasPrefix(lower: string, aliases: AliasMap): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const [key, vals] of Object.entries(aliases)) {
    if (
      key.startsWith(lower + ' ') ||
      key.startsWith(lower + '(') ||
      key.startsWith(lower + ',')
    ) {
      for (const id of vals) {
        if (!seen.has(id)) { seen.add(id); ids.push(id); }
      }
    }
  }
  return ids;
}

/**
 * Resolve a single explicit entity phrase (already extracted from a comparison
 * query). Tries exact alias lookup first, then prefix scan for possessive/
 * parenthetical titles. Requires a confident best-match to avoid false hits.
 */
function resolvePhrase(
  phrase: string,
  aliases: AliasMap,
  entities: EntityMap,
): ScoredMatch | null {
  const normalized = stripEdgePunct(phrase.trim());
  if (!normalized) return null;

  const lower = normalized.toLowerCase();

  let ids: string[] = aliases[lower] ?? [];
  if (ids.length === 0 && lower.length >= 3) {
    ids = aliasPrefix(lower, aliases);
  }
  if (ids.length === 0) return null;

  const ranked = scoreMatches(normalized, ids, entities);
  if (ranked.length === 0) return null;
  if (!isBestMatch(ranked)) return null;

  return ranked[0];
}

/**
 * Top-level resolver for ask.ts.
 *
 * - Comparison queries (compare/versus/etc.): split into explicit candidate
 *   phrases, resolve each independently. Any phrase that fails to resolve
 *   goes into `unresolved`. The caller should halt before calling Ollama if
 *   `unresolved` is non-empty.
 *
 * - All other queries: delegate to the existing resolveEntities sliding-window
 *   logic and return with an empty `unresolved` list.
 */
export function resolveQuestion(
  question: string,
  aliases: AliasMap,
  entities: EntityMap,
): ResolutionResult {
  const phrases = splitComparisonPhrases(question);

  if (phrases === null) {
    return { resolved: resolveEntities(question, aliases, entities), unresolved: [] };
  }

  const resolved: ScoredMatch[] = [];
  const unresolved: string[] = [];
  const seenCanonIds = new Set<string>();

  for (const phrase of phrases) {
    const match = resolvePhrase(phrase, aliases, entities);
    if (!match) {
      unresolved.push(phrase);
      continue;
    }

    const canonId = resolveCanonicalId(match.entity);
    if (seenCanonIds.has(canonId)) continue;
    seenCanonIds.add(canonId);
    resolved.push(match);
  }

  return { resolved, unresolved };
}

// ── Chapter Outline message builder ──────────────────────────────────────────

export interface ChapterOutlineCtx {
  stateData: {
    campaignState: Record<string, unknown> | null
    partyState: Record<string, unknown> | null
    worldThreads: Record<string, unknown> | null
    playerKnowledge: Record<string, unknown> | null
    npcsState: Record<string, unknown> | null
    sessionFacts: Record<string, unknown> | null
  }
}

// ── Place proposal message builder ───────────────────────────────────────────

export interface PlaceCtx {
  stateData: {
    campaignState: Record<string, unknown> | null
    worldThreads:  Record<string, unknown> | null
    npcsState:     Record<string, unknown> | null
  }
}

/**
 * Build messages for a place design proposal.
 * Generates a grounded setting document (districts, landmarks, factions, NPCs, rumours).
 * NOT a chapter outline — use this when the user describes a location, not a timeline.
 */
export function buildPlaceMessages(
  ctx: PlaceCtx,
  question: string,
): Array<{ role: string; content: string }> {
  const div = '─'.repeat(60)

  // Campaign state context
  const cs = (ctx.stateData.campaignState as any) ?? {}
  const wt = (ctx.stateData.worldThreads  as any) ?? {}
  const ns = (ctx.stateData.npcsState     as any) ?? {}
  const hotThreads: any[] = (wt.threads ?? []).filter((t: any) => t.currentStatus === 'hot')
  const stateLines: string[] = []
  if (cs.currentSession) stateLines.push(`Session ${cs.currentSession} / Chapter ${cs.currentChapter ?? '?'}`)
  if (hotThreads.length > 0) stateLines.push(`Hot threads: ${hotThreads.map((t: any) => t.name).join(', ')}`)
  const stateSummary = stateLines.length > 0 ? stateLines.join('\n') : '(no campaign state loaded)'

  const system = `You are Karsac Place Designer.

You create provisional place documents: grounded, Karsac-consistent locations with districts, landmarks, factions, key NPCs, rumours, and campaign use notes.

PLACE DESIGN RULES:
- This is a SETTING DOCUMENT, not a chapter outline or encounter. Do not generate scene spines, pressure timelines, or chapter structures.
- All content is provisional — mark anything invented as "Provisional:" if it goes beyond the campaign corpus.
- Ground the place in Karsac's tone: old, weather-shaped, factionally complex, practically dangerous.
- Do not invent named gods, cosmic forces, or artefacts unless the user asks for them.
- If the place has a named faction already in corpus (e.g. Mathr, Beorn, Vishara-influence), reference it rather than inventing a new one.
- Keep population, distances, and geography internally consistent with the prompt.
- Each key NPC entry must include: name (or placeholder), role, what they want, what they know.
- Rumours should be a mix of true (DM-confirmed), partially true, and false — label each as [TRUE], [PARTIAL], or [FALSE].
- GROUNDING RULE: Separate what the USER specified (established facts) from what the assistant invented (provisional additions). Never present invented faction connections as confirmed unless the user requested them or the corpus supports them.
- Use "Provisional:" prefix for any invented detail not grounded in the user's prompt or the campaign corpus.

CAMPAIGN STATE:
${div}
${stateSummary}
${div}`

  const user = `Generate a place proposal for:
"${question}"

Use EXACTLY these headings IN THIS ORDER. Do not rename, skip, or reorder them.

# Place: [place name]

## Overview
[Location, size, population, geographic setting — 2-3 sentences. Ground it in what the prompt specified.]

## Geography and Layout
[Physical description: terrain, approach routes, natural features, weather character. How does it feel to arrive here?]

## Key Districts
[2-5 districts or neighbourhoods. For each: name, character, what happens there, who controls it.]

## Notable Landmarks
[3-6 specific landmarks: docks, markets, gates, inns, archive, guild-house, etc. Each with a brief DM note.]

## Factions and Power Structures
[Who holds power? Who contests it? For each faction: name, goal, what they will do if ignored, any Karsac faction links.]

## Key NPCs
[4-8 NPCs. For each: name (or provisional placeholder), role, what they want, what they know, what they hide.]

## Rumours
[6-10 rumours. Label each: [TRUE], [PARTIAL], or [FALSE]. Mix mundane, factional, and cosmological.]

## Atmosphere and Tone
[Sensory: what does it smell like, sound like, feel like? What's the social texture? What's the mood?]

## Chapter 3 Uses
[How might this place be used in Chapter 3 or upcoming sessions? Be specific: investigation hooks, faction pressure, transit points, safe houses, archive access, etc.]

## DM Notes
[Anything the DM should know that players should not. Hidden agendas, who is Vishara-influenced, what is not as it seems.]

## Established Proposal Facts
[Restate ONLY facts the user provided in their prompt: name, size, location, population, distance from known places, any specific details they named.
Do NOT add invented facts here. This section is the ground truth the user gave you.]

## Provisional Additions
[Clearly label everything the assistant invented that was NOT in the user's prompt.
Use "Provisional:" prefix for each item. Examples:
- Provisional: The Fishmongers' Guild controls the docks.
- Provisional: A river cuts through the lower district.
These can be changed, challenged, or removed by the DM.]

## Optional Chapter Hooks
[Suggested faction links, Mathr/Vishara involvement, hidden locations, conspiracies, or campaign threads.
These are optional DM hooks — do NOT present them as firm truth unless the user requested them or the corpus explicitly supports them.
Label each as: "Optional hook (unconfirmed):" or "Optional hook (corpus-supported):" as appropriate.]`

  return [
    { role: 'system', content: system },
    { role: 'user',   content: user },
  ]
}

export interface NpcDesignCtx {
  stateData: {
    campaignState: Record<string, unknown> | null
    worldThreads: Record<string, unknown> | null
    npcsState: Record<string, unknown> | null
  }
}

export function buildNpcDesignMessages(
  ctx: NpcDesignCtx,
  question: string,
  corpusSnippets?: string[],
): Array<{ role: string; content: string }> {
  const div = '─'.repeat(60)
  const cs = (ctx.stateData.campaignState as any) ?? {}
  const wt = (ctx.stateData.worldThreads as any) ?? {}
  const ns = (ctx.stateData.npcsState as any) ?? {}
  const stateLines: string[] = []
  if (cs.currentSession) stateLines.push(`Session ${cs.currentSession} / Chapter ${cs.currentChapter ?? '?'}`)
  const hotThreads: any[] = (wt.threads ?? []).filter((t: any) => t.currentStatus === 'hot')
  if (hotThreads.length > 0) stateLines.push(`Hot threads: ${hotThreads.map((t: any) => t.name).join(', ')}`)
  const activeNpcs: any[] = (ns.npcs ?? []).slice(0, 6)
  if (activeNpcs.length > 0) stateLines.push(`Active NPCs: ${activeNpcs.map((npc: any) => npc.name).join(', ')}`)
  const stateSummary = stateLines.length > 0 ? stateLines.join('\n') : '(no campaign state loaded)'

  const corpusBlock = corpusSnippets && corpusSnippets.length > 0
    ? `\nCORPUS ANCHOR FIDELITY — ACTIVE
${div}
This NPC is named in existing corpus. The passages below are AUTHORITATIVE canon.
You MUST conform to them. Violations are generation failures.

PROHIBITED (regardless of what seems narratively useful):
- Do NOT reduce documented authority (personal, legendary, direct command) to ceremonial or figurehead status.
- Do NOT add knowledge this NPC does not possess according to corpus (e.g. if corpus says they do NOT know what something is, they must not know).
- Do NOT invent loyalties, pacts, coercions, or constraints that contradict stated motivations.
- Do NOT contradict any characterization, relationship, or fact stated in the passages below.

Authoritative corpus passages:
${corpusSnippets.map(s => `  ${s}`).join('\n')}
${div}`
    : ''

  const system = `You are Karsac NPC Designer.

You create provisional NPC proposal documents for Karsac. They should be specific, usable at the table, and separated cleanly into player-safe and DM-only information.

NPC DESIGN RULES:
- If the user asks for a new NPC, the output must stay an NPC proposal. Do not switch to a place, encounter, or chapter outline because of context words like road, harbour, fjord, town, or coast.
- Place, road, region, faction, and chapter references are context for the NPC, not evidence to change proposal type.
- Keep all material provisional unless grounded in provided campaign context.
- can_know means facts this NPC can genuinely know.
- must_not_know means hidden truths or upper-layer facts this NPC should not know.
- Lines to Inhabit must be short, speakable lines the DM can use at the table.
- Dramatic Utility must explain what pressure, help, or complication this NPC adds in play.
- player_safe must contain only what players can observe or plausibly infer.
- dm_only must contain the hidden truth, pressure, loyalties, or constraints.
- Return Markdown using the exact headings below and in the same order.
${corpusBlock}
CAMPAIGN STATE:
${div}
${stateSummary}
${div}`

  const user = `Generate an NPC proposal for:
"${question}"

Use EXACTLY these headings IN THIS ORDER. Do not rename, skip, or reorder them.

# NPC: [NPC name]

## Role
[Who this NPC is and what function they serve.]

## Physical Bearing
[What they look like in motion and what stands out at a glance.]

## What They Want
[What they want right now, what they want if the situation escalates, and what they are trying to protect.]

## What They Hide
[Secret loyalties, fears, compromises, leverage, contradictions, or concealed intent.]

## can_know
- [Fact this NPC can know]
- [Fact this NPC can know]

## must_not_know
- [Fact this NPC must not know]
- [Fact this NPC must not know]

## Lines to Inhabit
- "[Short line the DM can speak.]"
- "[Another short line.]"
- "[A third short line.]"

## Dramatic Utility
[How this NPC functions in scenes, what sort of pressure or help they create, and what they complicate.]

## player_safe
[What players can observe or reliably infer without exposing hidden truth.]

## dm_only
[The hidden truth, limits, faction ties, and what this NPC does under pressure.]

## Corpus Frontmatter
\`\`\`yaml
---
id: npcs/<slug>
type: npc
visibility: dm-only
canonical: provisional
tags: [npc, provisional]
can_know:
  - <fact>
must_not_know:
  - <fact>
dm_only:
  - <hidden truth>
related:
  factions: []
  places: []
summary: "<One sentence: who this NPC is and why they matter>"
---
\`\`\``

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}

export function buildItemDesignMessages(
  question: string,
  corpusSnippets?: string[],
): Array<{ role: string; content: string }> {
  const div = '─'.repeat(60)

  const corpusBlock = corpusSnippets && corpusSnippets.length > 0
    ? `\nCORPUS ANCHOR FIDELITY — ACTIVE
${div}
The following corpus passages are AUTHORITATIVE. Your proposal MUST conform to them.
DO NOT contradict any characterization, practice, or constraint stated below.
If the corpus describes a tradition as ORAL (carried in memory, spoken, not written), the item or handout MUST reflect that — do NOT create written tracking systems, tallies, or written records for an oral tradition.

Authoritative corpus passages:
${corpusSnippets.map(s => `  ${s}`).join('\n')}
${div}\n`
    : ''

  const system = `You are Karsac Item Designer.

You create provisional item, handout, and clue proposal documents for Karsac.

ITEM DESIGN RULES:
- Physical description must use ONLY details present in or directly implied by the corpus anchor text. Do not invent materials, magical properties, warmth, runes, glowing effects, or supernatural qualities unless the corpus explicitly states them.
- If the corpus says the item is bronze, it is bronze. Do not change material, size, shape, or finish.
- Narrative significance explains what the item reveals, proves, or enables in the fiction — keep it grounded.
- player_safe contains only what a player can observe by handling or examining the item.
- dm_only contains the hidden significance, what finding it proves, and when to reveal it.
- Do not invent factions, NPCs, or locations not present in the corpus anchor text.
- Keep all invented details clearly marked Provisional.
${corpusBlock}
Return Markdown using EXACTLY these headings IN THIS ORDER.`

  const user = `Generate an item proposal for:
"${question}"

Use EXACTLY these headings IN THIS ORDER. Do not rename, skip, or reorder them.

# Item: [Item name]

## Physical Description
[Exact physical properties: material, size, shape, markings. Stay strictly within what the corpus states.]

## Narrative Significance
[What this item reveals, proves, or enables. Its role in the session or chapter.]

## player_safe
[Only observable facts: what it looks like, feels like, what any player can determine by handling it.]

## dm_only
[Hidden significance: what it actually means, who made it, what finding it proves, when to use it.]

## How Players Encounter It
[One or two sentences on the circumstances of discovery.]`

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}

export function buildChapterOutlineMessages(
  ctx: ChapterOutlineCtx,
  question: string,
): Array<{ role: string; content: string }> {
  const cs = (ctx.stateData.campaignState  as any) ?? {}
  const ps = (ctx.stateData.partyState     as any) ?? {}
  const wt = (ctx.stateData.worldThreads   as any) ?? {}
  const pk = (ctx.stateData.playerKnowledge as any) ?? {}
  const ns = (ctx.stateData.npcsState      as any) ?? {}
  const sf = (ctx.stateData.sessionFacts   as any) ?? {}

  const div = '─'.repeat(60)

  // Campaign summary
  const threads: any[] = wt.threads ?? []
  const hotThreads = threads.filter((t: any) => t.currentStatus === 'hot')
  const simmeringThreads = threads.filter((t: any) => t.currentStatus === 'simmering')
  const knownFacts: string[] = pk.knownFacts ?? []
  const npcs: any[] = ns.npcs ?? []

  const campaignHeader = [
    `Session ${cs.currentSession ?? '?'} / Chapter ${cs.currentChapter ?? '?'}`,
    cs.clock ? `Clock: ${cs.clock.value}/${cs.clock.max}` : '',
    ps.partyLevel != null ? `Party level: ${ps.partyLevel}` : '',
    ps.partySize  != null ? `Party size: ${ps.partySize}` : '',
  ].filter(Boolean).join('  |  ')

  const hotBlock = hotThreads.length > 0
    ? hotThreads.map((t: any) => `  [HOT] ${t.name}: ${t.summary ?? ''}`).join('\n')
    : '  (none)'

  const simmeringBlock = simmeringThreads.length > 0
    ? simmeringThreads.map((t: any) => `  [~] ${t.name}: ${t.summary ?? ''}`).join('\n')
    : '  (none)'

  const knownBlock = knownFacts.length > 0
    ? knownFacts.map(f => `  - ${f}`).join('\n')
    : `  (knownFacts is 0 — players know nothing confirmed yet)`

  const npcBlock = npcs.length > 0
    ? npcs.slice(0, 8).map((n: any) => `  ${n.name} [${n.status ?? 'unknown'}] — ${n.location ?? '?'}`).join('\n')
    : '  (none)'

  const stateBlock = `CAMPAIGN STATE
${div}
${campaignHeader}

Hot threads:
${hotBlock}

Simmering threads:
${simmeringBlock}

Player knowledge (confirmed):
${knownBlock}

Active NPCs:
${npcBlock}
${div}`

  const system = `You are Karsac Chapter Planner. You create grounded chapter outlines from campaign state, using the current table state as your foundation.

Rules:
- Chapter outlines are proposals only. They do NOT describe what has happened — only what may happen.
- Do not write as if events have already occurred. Use language like: 'If the party...', 'The chapter opens with...', 'One possible path...'
- Do not update campaign-state.json or player-knowledge.json.
- State updates are suggestions only — to be applied after actual play.
- Draw on the CAMPAIGN STATE below for player knowledge, hot threads, active NPCs, and session progress.

${stateBlock}`

  const userMessage = `Generate a chapter outline for:
"${question}"

Use EXACTLY these headings IN THIS ORDER:

# Chapter Outline: [title]

## Chapter Purpose
[What this chapter does in the campaign. 2-3 sentences.]

## Starting State
[What is confirmed true at the start of this chapter. Draw from campaign state. Do NOT invent new facts.]

## Player Knowledge
[What players currently know based on corpus/state/player-knowledge.json. If knownFacts is 0, say so.]

## DM Truth
[What is happening behind the screen that players do not know yet.]

## Core Pressure
[The force driving the chapter forward.]

## Active Factions and NPCs
[For each relevant NPC/faction: what they want, what they know, what they will do if ignored.]

## Scene Spine
[A suggested sequence of 3–6 scenes. For each: purpose, location, pressure, likely choices, clues, failure consequence.]

## Optional Scenes
[Scenes for party drift, delay, split, or bypass.]

## Clues and Reveals
[Separate player-safe clues from deeper implications and DM-only truth.]

## Adversaries and Obstacles
[Social, procedural, factional, investigative and combat obstacles. Reference existing adversary corpus where applicable.]

## Fail-Forward Paths
[What happens if the party fails, delays, misses clues, or refuses the hook.]

## End Conditions
[Possible states at the end of the chapter. At least 3: success, partial, failure.]

## Suggested State Updates After Play
IMPORTANT: These are suggestions only. Do not apply them until the chapter has actually been played at the table.
[List suggested campaign state changes: thread status updates, revealed facts, NPC changes, etc.]`

  return [
    { role: 'system', content: system },
    { role: 'user', content: userMessage },
  ]
}
