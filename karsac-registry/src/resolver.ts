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
