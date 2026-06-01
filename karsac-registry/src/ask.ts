import { resolve } from 'path';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { routeQuestion } from './router.js';
import type { RouteResult } from './router.js';
import { execSync } from 'child_process';
import type { AliasMap, EntityMap } from './types.js';
import { INDEX_DIR, DEBUG_DIR, COLLECTIONS_ROOT, RULES_DATA_DIR, STATE_ROOT, ADVERSARY_CORPUS_ROOT, ENCOUNTER_PATTERNS_ROOT } from './paths.js';
import {
  resolveQuestion, resolveRulesQuestion, loadCanonFile,
  buildMessages, buildProseMessages, buildRulesMessages, buildDesignMessages,
  buildDeepLoreMessages, buildDeepLoreExtractionMessages, buildDeepLoreFromFactsMessages,
  buildExtractionMessages, buildComparisonFromFactsMessages,
  buildStateMessages, buildEncounterDesignMessages,
  isComparisonQuestion, normalizeRelatedId,
  type CanonFile, type FactPacket, type ScoredMatch, type StructuredEntry,
  type StateContextData, type EncounterDesignCtx,
} from './resolver.js';
import {
  loadScoredAdversaries, loadScoredPatterns, getNpcBaseSummaries,
  type ScoredAdversary, type ScoredPattern,
} from './encounter-design.js';

const OLLAMA_HOST = process.env.OLLAMA_HOST ?? 'http://localhost:11434';

// ── Profiles ──────────────────────────────────────────────────────────────────

type ProseMode = 'player' | 'dm';

interface KarsacProfile {
  name: string;
  model: string;
  temperature: number;
  topP: number;
  defaultMode: ProseMode;
}

const PROFILES: Record<string, KarsacProfile> = {
  canon: {
    name: 'canon',
    model: process.env.OLLAMA_MODEL ?? 'gemma3:12b',
    temperature: 0.1,
    topP: 0.7,
    defaultMode: 'dm',
  },
  prose: {
    name: 'prose',
    model: process.env.PROSE_MODEL ?? process.env.OLLAMA_MODEL ?? 'mistral-small:latest',
    temperature: 0.7,
    topP: 0.9,
    defaultMode: 'player',
  },
  'deep-lore': {
    name: 'deep-lore',
    model: process.env.DEEP_LORE_MODEL ?? process.env.OLLAMA_MODEL ?? 'gemma3:12b',
    temperature: 0.25,
    topP: 0.8,
    defaultMode: 'dm',
  },
  rules: {
    name: 'rules',
    model: process.env.RULES_MODEL ?? process.env.OLLAMA_MODEL ?? 'gemma3:12b',
    temperature: 0.1,
    topP: 0.7,
    defaultMode: 'dm',
  },
  design: {
    name: 'design',
    model: process.env.DESIGN_MODEL ?? process.env.OLLAMA_MODEL ?? 'gemma3:12b',
    temperature: 0.5,
    topP: 0.85,
    defaultMode: 'dm',
  },
  state: {
    name: 'state',
    model: process.env.STATE_MODEL ?? process.env.OLLAMA_MODEL ?? 'gemma3:12b',
    temperature: 0.15,
    topP: 0.7,
    defaultMode: 'dm',
  },
  'encounter-design': {
    name: 'encounter-design',
    model: process.env.ENCOUNTER_MODEL ?? process.env.OLLAMA_MODEL ?? 'gemma3:12b',
    temperature: 0.4,
    topP: 0.85,
    defaultMode: 'dm',
  },
};

function parseArgs(): {
  question: string;
  profileName: string | null;
  explicitMode: ProseMode | null;
  maxRelated: number;
  maxRelatedExplicit: boolean;
  debugRelated: boolean;
  strategy: string | null;
  savePrompt: boolean;
  allowHomebrew: boolean;
} {
  const args = process.argv.slice(2);
  const filtered: string[] = [];
  let profileName: string | null = null; // null = not explicitly provided
  let modeName: string | null = null;
  let maxRelated = DEEP_LORE_MAX_RELATED;
  let maxRelatedExplicit = false;
  let debugRelated = false;
  let strategy: string | null = null;
  let savePrompt = false;
  let allowHomebrew = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--profile' && i + 1 < args.length) {
      profileName = args[++i];
    } else if (args[i] === '--mode' && i + 1 < args.length) {
      modeName = args[++i];
    } else if (args[i] === '--max-related' && i + 1 < args.length) {
      const n = parseInt(args[++i], 10);
      if (isNaN(n) || n < 0) {
        console.error(`--max-related must be a non-negative integer.`);
        process.exit(1);
      }
      maxRelated = n;
      maxRelatedExplicit = true;
    } else if (args[i] === '--debug-related') {
      debugRelated = true;
    } else if (args[i] === '--strategy' && i + 1 < args.length) {
      strategy = args[++i];
    } else if (args[i] === '--save-prompt') {
      savePrompt = true;
    } else if (args[i] === '--allow-homebrew') {
      allowHomebrew = true;
    } else {
      filtered.push(args[i]);
    }
  }

  if (modeName && modeName !== 'player' && modeName !== 'dm') {
    console.error(`Unknown mode: "${modeName}". Use player or dm.`);
    process.exit(1);
  }

  return {
    question: filtered.join(' ').trim(),
    profileName,
    explicitMode: modeName as ProseMode | null,
    maxRelated,
    maxRelatedExplicit,
    debugRelated,
    strategy,
    savePrompt,
    allowHomebrew,
  };
}

// ── DM section filtering ──────────────────────────────────────────────────────

function isDmSectionTitle(title: string): boolean {
  return /^(DM[\s-]?Only|Secrets|Future|Spoilers)$/i.test(title.trim());
}

/** Remove DM-only sections from Markdown for player-mode context. */
function filterPlayerContent(content: string): string {
  const lines = content.split('\n');
  const out: string[] = [];
  let dmLevel = 0; // 0 = not in a DM section; >0 = the ## level of the active DM section

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.*\S)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const title = headingMatch[2];

      if (dmLevel > 0) {
        if (level <= dmLevel) {
          // Exiting the DM section; check whether the new heading is also DM-only
          if (isDmSectionTitle(title)) {
            dmLevel = level; // another DM section at same level
          } else {
            dmLevel = 0;
            out.push(line);
          }
        }
        // else: nested heading inside DM section — skip
      } else {
        if (isDmSectionTitle(title)) {
          dmLevel = level;
        } else {
          out.push(line);
        }
      }
    } else {
      if (dmLevel === 0) out.push(line);
    }
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
}

// ── Deep Lore related-file expansion ─────────────────────────────────────────

const DEEP_LORE_RELATED_PRIORITY = [
  'forces', 'concepts', 'factions', 'events', 'items', 'npcs', 'places',
] as const;
type RelationKey = typeof DEEP_LORE_RELATED_PRIORITY[number];

const DEEP_LORE_EXCLUDED_TYPES = new Set(['mechanics', 'pc', 'entity-card']);
const DEEP_LORE_MAX_RELATED = 8;
const DEEP_LORE_MAX_RELATED_MULTI = 12; // auto-raised when 3+ primary entities

interface SkippedEntry { id: string; reason: string; }

interface DeepLoreContext {
  primaryCanons: CanonFile[];
  expandedCanons: CanonFile[];
  skipped: SkippedEntry[];
  debugLines: string[];
}

function canonicalEntityId(entity: { type: string; id: string; primaryDetailFile?: string }): string {
  return entity.type === 'entity-card' && entity.primaryDetailFile
    ? entity.primaryDetailFile
    : entity.id;
}

/**
 * Choose the related-file expansion priority order based on query intent and
 * primary entity types. Checked in A→D order; first match wins.
 *
 * A. Artefact/item-heavy  → items first
 * B. Force/cosmology-heavy → forces/concepts first
 * C. NPC-heavy            → npcs first
 * D. Place-heavy          → places first
 * Default                 → forces, concepts, factions, events, items, npcs, places
 */
function getExpansionPriority(question: string, primaryMatches: ScoredMatch[]): RelationKey[] {
  const lq = question.toLowerCase();

  // A. Artefact / item-heavy
  if (/\b(artefacts?|artifacts?|objects?|items?|ledger|token|letter|disc|scroll|stone|key|ring)\b/.test(lq)) {
    return ['items', 'forces', 'concepts', 'factions', 'events', 'npcs', 'places'];
  }

  // B. Force / cosmology-heavy
  const primaryHasForce = primaryMatches.some(m => ['force', 'concept'].includes(m.entity.type));
  if (
    /\b(vishara|dhurvaq|maharuq|yantravaq|holding|thinning|cosmology|force|principle)\b/.test(lq) ||
    primaryHasForce
  ) {
    return ['forces', 'concepts', 'places', 'factions', 'events', 'npcs', 'items'];
  }

  // C. NPC-heavy
  const primaryNpcCount = primaryMatches.filter(m => m.entity.type === 'npc').length;
  if (
    /\b(who|character|npc|person|people)\b/.test(lq) ||
    lq.includes('relationship between') || lq.includes('compare') ||
    primaryNpcCount >= 2
  ) {
    return ['npcs', 'factions', 'events', 'items', 'forces', 'concepts', 'places'];
  }

  // D. Place-heavy
  const primaryHasPlace = primaryMatches.some(m => m.entity.type === 'place');
  if (
    /\b(where|place|location|city|town|harbour|dock|road|route|geography)\b/.test(lq) ||
    primaryHasPlace
  ) {
    return ['places', 'events', 'factions', 'npcs', 'items', 'forces', 'concepts'];
  }

  return [...DEEP_LORE_RELATED_PRIORITY];
}

function loadDeepLoreContext(
  matches: ScoredMatch[],
  entities: EntityMap,
  aliases: AliasMap,
  collectionsRoot: string,
  question: string,
  priority: RelationKey[],
  maxRelated: number,
  debug = false,
): DeepLoreContext {
  const primaryCanons = matches.map(m => loadCanonFile(m.entity, entities, collectionsRoot));
  const primaryIds = new Set(primaryCanons.map(c => c.id));
  const lowerQ = question.toLowerCase();
  const debugLines: string[] = [];

  // ── Debug pass: per-entity raw + normalised view ────────────────────────────
  if (debug) {
    debugLines.push(`\nRelated expansion priority:\n  ${priority.join(' > ')}\n`);
    debugLines.push(`\nMax related:\n  ${maxRelated}\n`);

    for (const match of matches) {
      const canonId = canonicalEntityId(match.entity);
      const canonEntity = entities[canonId] ?? match.entity;
      const related = canonEntity.related as Record<string, string[]>;

      debugLines.push(`\nDebug related expansion — [${canonId}]\n`);
      debugLines.push(`Raw related from entity:\n`);
      if (Object.keys(related).length === 0) {
        debugLines.push(`  (none)\n`);
      } else {
        for (const [rt, slugs] of Object.entries(related)) {
          debugLines.push(`  ${rt}: [${(slugs as string[]).join(', ')}]\n`);
        }
      }

      debugLines.push(`\nNormalised related candidates:\n`);
      let anyDebug = false;
      for (const [rt, slugs] of Object.entries(related)) {
        for (const slug of slugs as string[]) {
          anyDebug = true;
          const fullId = normalizeRelatedId(rt, slug);
          let statusStr: string;
          if (primaryIds.has(fullId)) {
            statusStr = 'already primary';
          } else {
            const relEntity = entities[fullId];
            if (!relEntity) {
              statusStr = 'missing entity';
            } else if (DEEP_LORE_EXCLUDED_TYPES.has(relEntity.type)) {
              statusStr = lowerQ.includes(relEntity.title.toLowerCase())
                ? `exists (${relEntity.type}) — included (explicit in question)`
                : `excluded: ${relEntity.type} not explicit in question`;
            } else if (!priority.includes(rt as RelationKey)) {
              statusStr = `exists (${relEntity.type}) — not in expansion priority list`;
            } else {
              statusStr = `exists (${relEntity.type})`;
            }
          }
          debugLines.push(`  - ${fullId} — ${statusStr}\n`);
        }
      }
      if (!anyDebug) debugLines.push(`  (none)\n`);
    }
  }

  // ── Expansion pass: priority-ordered, globally deduped ─────────────────────
  const processedIds = new Set<string>();
  const okCandidates: string[] = [];
  const skippedEntries: SkippedEntry[] = [];

  for (const relType of priority) {
    for (const match of matches) {
      const canonId = canonicalEntityId(match.entity);
      const canonEntity = entities[canonId] ?? match.entity;
      const slugs: string[] = (canonEntity.related as Record<string, string[]>)[relType] ?? [];

      for (const slug of slugs) {
        const fullId = normalizeRelatedId(relType, slug);
        if (processedIds.has(fullId)) continue;
        processedIds.add(fullId);

        if (primaryIds.has(fullId)) continue; // already primary — omit from skipped list

        let relEntity = entities[fullId];

        if (!relEntity) {
          // Alias fallback: try slug without leading type-prefix segment
          const slugPart = fullId.includes('/') ? fullId.substring(fullId.indexOf('/') + 1) : fullId;
          const aliasHits = aliases[slugPart.toLowerCase()];
          const resolvedId = aliasHits?.[0];
          if (resolvedId && entities[resolvedId] && !processedIds.has(resolvedId)) {
            processedIds.add(resolvedId);
            relEntity = entities[resolvedId];
          } else {
            const tried = fullId !== slugPart ? `${fullId}, ${slugPart}` : fullId;
            skippedEntries.push({ id: fullId, reason: `missing entity; tried: ${tried}` });
            continue;
          }
        }

        if (DEEP_LORE_EXCLUDED_TYPES.has(relEntity.type)) {
          if (!lowerQ.includes(relEntity.title.toLowerCase())) {
            skippedEntries.push({ id: fullId, reason: `excluded: ${relEntity.type} not explicit in question` });
            continue;
          }
        }

        okCandidates.push(relEntity.id);
      }
    }
  }

  for (const id of okCandidates.slice(maxRelated)) {
    skippedEntries.push({ id, reason: 'over max-related limit' });
  }

  const expandedCanons: CanonFile[] = [];
  for (const relId of okCandidates.slice(0, maxRelated)) {
    const relEntity = entities[relId];
    if (!relEntity) { skippedEntries.push({ id: relId, reason: 'missing entity' }); continue; }
    try {
      expandedCanons.push(loadCanonFile(relEntity, entities, collectionsRoot));
    } catch {
      skippedEntries.push({ id: relId, reason: 'file missing on disk' });
    }
  }

  return { primaryCanons, expandedCanons, skipped: skippedEntries, debugLines };
}

// ── Index loading ─────────────────────────────────────────────────────────────

function loadJSON<T>(name: string): T {
  const p = resolve(INDEX_DIR, name);
  if (!existsSync(p)) {
    console.error(`Index file not found: ${p}\nRun: npm run karsac:index`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(p, { encoding: 'utf-8' })) as T;
}

// ── Rules structured data lookup ─────────────────────────────────────────────

interface RulesDataEntry {
  id: string;
  name: string;
  summary: string;
  sourceRule?: string;
  ruleset?: string;
  tags?: string[];
}

function loadRulesDataFile<T extends RulesDataEntry>(filename: string): Record<string, T> | null {
  const p = resolve(RULES_DATA_DIR, filename);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, { encoding: 'utf-8' })) as Record<string, T>;
  } catch {
    return null;
  }
}

function detectStructuredEntries(
  question: string,
  data: Record<string, RulesDataEntry>,
  sourceDataFile: string,
): StructuredEntry[] {
  const lq = question.toLowerCase();
  const matches: StructuredEntry[] = [];
  for (const [key, entry] of Object.entries(data)) {
    if (lq.includes(key.toLowerCase()) || lq.includes(entry.name.toLowerCase())) {
      matches.push({
        id: entry.id,
        name: entry.name,
        summary: entry.summary,
        sourceDataFile,
        sourceRule: entry.sourceRule,
      });
    }
  }
  return matches;
}

// ── WSL network helper ────────────────────────────────────────────────────────

/**
 * In WSL2, Ollama runs on Windows and binds to 127.0.0.1 — not visible to the
 * WSL loopback as plain localhost. The Windows host is the default gateway.
 * Returns the host IP string (e.g. "172.18.64.1") or null if not in WSL.
 */
function wslWindowsHost(): string | null {
  try {
    if (!existsSync('/proc/version')) return null;
    const ver = readFileSync('/proc/version', 'utf-8');
    if (!ver.toLowerCase().includes('microsoft')) return null;
    // `ip route show default` → "default via 172.18.64.1 dev eth0 ..."
    const out = execSync('ip route show default 2>/dev/null', { encoding: 'utf-8' });
    const m = out.match(/default via ([\d.]+)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

async function listInstalledModels(chatUrl: string): Promise<string[]> {
  try {
    const tagsUrl = chatUrl.replace('/api/chat', '/api/tags');
    const res = await fetch(tagsUrl);
    if (!res.ok) return [];
    const json = await res.json() as { models?: Array<{ name: string }> };
    return json.models?.map(m => m.name) ?? [];
  } catch {
    return [];
  }
}

// ── Ollama call ───────────────────────────────────────────────────────────────

/**
 * Call Ollama and return the full response text.
 * - `silent: true` suppresses stdout (used for background extraction passes).
 * - `profile` injects model selection and temperature/top_p into the request.
 */
async function callOllama(
  messages: Array<{ role: string; content: string }>,
  opts: { silent?: boolean; profile?: KarsacProfile } = {},
): Promise<string> {
  const model = opts.profile?.model ?? (process.env.OLLAMA_MODEL ?? 'gemma3:12b');
  const ollamaOptions = opts.profile
    ? { temperature: opts.profile.temperature, top_p: opts.profile.topP }
    : undefined;

  const primaryUrl = `${OLLAMA_HOST}/api/chat`;
  const body = JSON.stringify({
    model,
    stream: true,
    messages,
    ...(ollamaOptions ? { options: ollamaOptions } : {}),
  });
  const reqInit: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  };

  let response: Response | undefined;
  let activeUrl = primaryUrl;

  // First attempt
  try {
    response = await fetch(primaryUrl, reqInit);
  } catch {
    // Primary failed — in WSL try the Windows host IP as a fallback
    const winIp = wslWindowsHost();
    if (winIp && OLLAMA_HOST.includes('localhost')) {
      const fallbackUrl = primaryUrl.replace('localhost', winIp);
      process.stderr.write(`  localhost unreachable — retrying via Windows host (${winIp})...\n`);
      try {
        response = await fetch(fallbackUrl, { ...reqInit });
        activeUrl = fallbackUrl;
        process.stderr.write(`  Connected. Set OLLAMA_HOST=http://${winIp}:11434 to skip this retry.\n\n`);
      } catch { /* fall through to error */ }
    }
  }

  if (!response) {
    const winIp = wslWindowsHost();
    console.error(`\nCannot reach Ollama at ${OLLAMA_HOST}.`);
    if (winIp) {
      console.error(`\nRunning in WSL — Ollama is on Windows. Options:\n`);
      console.error(`  1. Set env var for this session:`);
      console.error(`       OLLAMA_HOST=http://${winIp}:11434 npm run karsac:ask -- "..."\n`);
      console.error(`  2. Make Ollama listen on all interfaces (Windows, then restart Ollama):`);
      console.error(`       setx OLLAMA_HOST 0.0.0.0:11434`);
    } else {
      console.error('Is Ollama running? Try: ollama serve');
    }
    process.exit(1);
  }

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 404 && body.includes('model')) {
      console.error(`\nModel '${model}' not found in Ollama.`);
      const installed = await listInstalledModels(activeUrl);
      if (installed.length > 0) {
        console.error(`\nInstalled models:`);
        for (const m of installed) console.error(`  ${m}`);
        console.error(`\nRun with a different model:`);
        console.error(`  OLLAMA_MODEL=${installed[0]} npm run karsac:ask -- "..."`);
      } else {
        console.error(`Pull a model first, e.g.:  ollama pull gemma3:4b`);
      }
    } else {
      console.error(`\nOllama returned HTTP ${response.status}: ${body}`);
    }
    process.exit(1);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let chunk = '';
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunk += decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');
    chunk = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line) as { message?: { content?: string }; done?: boolean };
        if (parsed.message?.content) {
          if (!opts.silent) process.stdout.write(parsed.message.content);
          fullText += parsed.message.content;
        }
      } catch {
        // malformed NDJSON chunk — skip silently
      }
    }
  }

  if (!opts.silent) process.stdout.write('\n');
  return fullText;
}

// ── Comparison output validation ──────────────────────────────────────────────

const REQUIRED_HEADINGS = [
  '## direct canon facts',
  '## differences stated by canon',
  '## dm interpretation',
  '## not stated / uncertain',
];

function validateComparisonResponse(text: string): boolean {
  const lower = text.toLowerCase();
  if (!lower.trimStart().startsWith('## direct canon facts')) return false;
  return REQUIRED_HEADINGS.every(h => lower.includes(h));
}

function buildRepairMessages(
  originalMessages: Array<{ role: string; content: string }>,
  badResponse: string,
): Array<{ role: string; content: string }> {
  return [
    ...originalMessages,
    { role: 'assistant', content: badResponse },
    {
      role: 'user',
      content: `Your previous answer did not follow the required output contract.
Rewrite it using exactly these headings:
1. \`## Direct canon facts\`
2. \`## Differences stated by canon\`
3. \`## DM interpretation\`
4. \`## Not stated / uncertain\`

Do not add an introduction.
Do not use alternative headings.
Start with \`## Direct canon facts\`.`,
    },
  ];
}

// ── Deep Lore output validation ───────────────────────────────────────────────

const DEEP_LORE_REQUIRED_HEADINGS = [
  '## direct canon facts',
  '## hidden structure',
  '## dm interpretation',
  '## not stated / uncertain',
  '## useful table guidance',
];

function deepLoreHasRawContext(text: string): boolean {
  if (text.includes('--- FILE:')) return true;
  return /^(id|type|visibility|canonical|tags|related):/m.test(text);
}

function validateDeepLoreResponse(text: string): boolean {
  const lower = text.toLowerCase();
  if (!lower.trimStart().startsWith('## direct canon facts')) return false;
  if (!DEEP_LORE_REQUIRED_HEADINGS.every(h => lower.includes(h))) return false;
  if (deepLoreHasRawContext(text)) return false;
  return true;
}

/**
 * Build a minimal repair prompt that contains NO raw canon context.
 * The model rewrites only from the previous answer — it cannot access file content.
 */
function buildDeepLoreRepairMessages(
  question: string,
  badResponse: string,
): Array<{ role: string; content: string }> {
  return [
    {
      role: 'system',
      content: `You are repairing a Karsac Deep Lore Analyst answer.

Your previous answer did not follow the required output contract.

Rewrite the previous answer only.
Do not add new facts.
Do not inspect or output raw canon files.
Do not include YAML frontmatter.
Do not include \`--- FILE:\` blocks.
Do not focus on one source file unless the previous answer did.`,
    },
    {
      role: 'user',
      content: `Original user question:
${question}

Previous answer:
${badResponse}

Required output structure:

## Direct canon facts

## Hidden structure

## DM interpretation

## Not stated / uncertain

## Useful table guidance

Rules:
- Do not add an introduction.
- Do not rename headings.
- Move unsupported synthesis into \`## DM interpretation\`.
- Move gaps into \`## Not stated / uncertain\`.
- Preserve useful content from the previous answer.
- Do not add new claims.
- Do not output raw source context.`,
    },
  ];
}

// ── Rules output validation ───────────────────────────────────────────────────

const RULES_REQUIRED_HEADINGS = [
  '## ruling',
  '## base 5e rule',
  '## karsac table rule',
  '## at the table',
  '## edge cases',
  '## dm call',
];

function validateRulesResponse(text: string): boolean {
  const lower = text.toLowerCase();
  if (!lower.trimStart().startsWith('## ruling')) return false;
  return RULES_REQUIRED_HEADINGS.every(h => lower.includes(h));
}

function buildRulesRepairMessages(
  question: string,
  badResponse: string,
): Array<{ role: string; content: string }> {
  return [
    {
      role: 'system',
      content: `You are repairing a Karsac Rules Referee answer.

Your previous answer did not follow the required output contract.

Rewrite the previous answer only.
Do not add new rules not in the previous answer.
Do not inspect or output raw rule files.`,
    },
    {
      role: 'user',
      content: `Original question:
${question}

Previous answer:
${badResponse}

Required output structure:

## Ruling

## Base 5e rule

## Karsac table rule

## At the table

## Edge cases

## DM call

Rules:
- Do not add an introduction.
- Do not rename headings.
- Start with \`## Ruling\`.
- Move unsupported claims into \`## DM call\`.
- Preserve useful content from the previous answer.`,
    },
  ];
}

// ── Rules related-context loader ──────────────────────────────────────────────

const RULES_MAX_RELATED = 4;

function loadRulesRelatedContext(
  matches: ScoredMatch[],
  entities: EntityMap,
  collectionsRoot: string,
): CanonFile[] {
  const primaryIds = new Set(matches.map(m => m.entity.id));
  const seen = new Set<string>(primaryIds);
  const related: CanonFile[] = [];

  for (const match of matches) {
    const relatedRules: string[] = (match.entity.related as Record<string, string[]>)['rules'] ?? [];
    for (const id of relatedRules) {
      if (seen.has(id)) continue;
      seen.add(id);
      const relEntity = entities[id];
      if (!relEntity) continue;
      try {
        related.push(loadCanonFile(relEntity, entities, collectionsRoot));
      } catch { /* file missing on disk */ }
      if (related.length >= RULES_MAX_RELATED) return related;
    }
  }

  return related;
}

// ── Design output validation ──────────────────────────────────────────────────

// Guardrail patterns, checkers, strip, and validate live in design-guardrails.ts
// so tests can import them without triggering ask.ts's CLI main() side-effect.
import {
  checkNoMonsterViolations,
  checkHomebrewViolations as _checkHomebrewViolations,
  checkCompositionViolations,
  validateDesignResponse as _validateDesignResponse,
  stripViolatingContent as _stripViolatingContent,
} from './design-guardrails.js';
import {
  buildEncounterCompositionPlan,
  buildCreatureScaffold,
  formatCompositionDebug,
} from './composition.js';
import type { EncounterCompositionPlan, CandidateForComposition } from './composition.js';
import {
  parseEncounterIntent,
  compileEncounterBrief,
  renderDeterministicFallback,
  formatEncounterBriefDebug,
} from './encounter-brief.js';
import type { EncounterBrief } from './encounter-brief.js';

// extractPartyInfo is defined and exported in resolver.ts to keep ask.ts importable
// in tests without triggering the CLI main() function.
import { extractPartyInfo } from './resolver.js';

/**
 * CR suitability adjustment for party-level-aware monster scoring.
 * Returns an additive score delta. Negative values penalise out-of-band monsters.
 */
function crSuitabilityAdjustment(cr: number, partyLevel: number): number {
  if (cr <= partyLevel + 1) return 4;   // preferred: within encounter band
  if (cr <= partyLevel + 2) return -5;  // borderline: hard penalty
  return -15;                           // wildly outside: effectively excluded from combat
}

function checkHomebrewViolations(text: string, _loadedMonsterNames: string[] = []): string[] {
  return _checkHomebrewViolations(text);
}
function validateDesignResponse(
  text: string,
  noMonsterData = false,
  allowHomebrew = false,
  _loadedMonsterNames: string[] = [],
  compositionPlan: EncounterCompositionPlan | null = null,
): boolean {
  return _validateDesignResponse(text, noMonsterData, allowHomebrew, compositionPlan ?? undefined);
}
function stripViolatingContent(text: string, allowHomebrew: boolean, noMonsterData: boolean, _loadedMonsterNames: string[] = []): { stripped: string; removed: string[] } {
  return _stripViolatingContent(text, allowHomebrew, noMonsterData);
}

/**
 * Replace the model-generated ## Creatures / opposition section with the
 * deterministic locked scaffold. Called after every model generation when a
 * composition plan is active — the model cannot drift the creature list here.
 */
function injectLockedCreatureSection(
  text: string,
  plan: EncounterCompositionPlan,
): string {
  const scaffold = buildCreatureScaffold(plan);
  // Capture the heading line in $1; replace the body until the next ## heading or end of string.
  return text.replace(
    /(##\s+Creatures\s*\/\s*opposition[^\n]*\n)[\s\S]*?(?=\n## |\s*$)/i,
    `$1${scaffold}\n`,
  );
}

function buildDesignRepairMessages(
  question: string,
  badResponse: string,
  noMonsterData = false,
  allowHomebrew = false,
  loadedMonsterNames: string[] = [],
  compositionPlan: EncounterCompositionPlan | null = null,
): Array<{ role: string; content: string }> {
  const noMonsterViolations = noMonsterData ? checkNoMonsterViolations(badResponse) : [];
  const homebrewViolations = allowHomebrew ? [] : checkHomebrewViolations(badResponse, loadedMonsterNames);
  const compositionViolations = compositionPlan ? checkCompositionViolations(badResponse, compositionPlan) : [];

  const noMonsterSection = noMonsterData
    ? `
NO MONSTER DATA MODE — the ## Creatures / opposition section in the previous answer is invalid.

You must:
1. Remove every named creature, monster, stat block reference, CR rating, AC value, HP value, damage resistance, and spellcasting reference from ## Creatures / opposition.
2. Do not preserve any of these — they are all forbidden.
3. Replace the entire section with encounter ROLES only. Examples:
   - displaced mountain pack predator
   - wounded heavy-bodied grazer
   - frightened cliff scavenger
   - territorial nesting beast
4. Add this exact sentence at the start of the section:
   "Monster metadata is not yet loaded, so these are encounter roles rather than selected stat blocks."
${noMonsterViolations.length > 0 ? `\nViolations found: ${noMonsterViolations.join(', ')}` : ''}
`
    : '';

  const homebrewSection = homebrewViolations.length > 0
    ? `
HOMEBREW GATE VIOLATION — the previous answer contained unsupported stat modifications.

Remove ALL of the following from the ENTIRE answer (every section including ## Scaling options):
- "based on [monster name]" (homebrew reskin)
- HP changes: "reduce HP", "increase HP", "extra hit points", "HP to N"
- Damage changes: "increase damage", "reduce damage", "increase bite damage"
- AC changes: any AC modification
- Ability score changes: "+N Strength", "+N Constitution", etc.
- Saving throw modifiers: "advantage on saving throws", "disadvantage on saving throws"
- "resistance to" or "damage resistance"
- Any new attack, special ability, or spellcasting not in the loaded files

Violations found in the previous answer: ${homebrewViolations.join(', ')}

Replacement rule for ## Creatures / opposition:
- Use the loaded monster's stat block UNCHANGED.
- Local/regional names (e.g. "Fjallvarg") are allowed ONLY as flavour labels over a loaded monster.

Replacement rule for ## Scaling options — ONLY these approaches are allowed:
- Add or remove a loaded creature from the encounter
- Change starting distance or surprise conditions
- Change terrain pressure or environmental complication intensity
- Make enemies flee or break morale at different thresholds
- Add or remove non-combat pressure (sounds, weather, time limit)
- Alter objective pressure
- Give the party advance warning before initiative

CORRECT EXAMPLE (## Scaling options):
  "To soften: use fewer creatures, start them further away, or give the party warning before initiative.
   To harden: add a second predator already on the road, or remove the escape route behind them."

WRONG EXAMPLE (## Scaling options):
  "Reduce the Polar Bear's HP by half for an easier encounter."
  (HP changes are forbidden — change the count or distance instead.)
`
    : '';

  const compositionSection = compositionPlan
    ? `
COMPOSITION PLAN — RESTORE THE EXACT CREATURE LIST

${compositionViolations.length > 0
  ? `Violations in previous answer: ${compositionViolations.join(', ')}\n`
  : ''}
Your ## Creatures / opposition section must begin with EXACTLY this locked list.
Copy it verbatim. Do not add, remove, rename, or modify any creature:

${buildCreatureScaffold(compositionPlan)}

After the list you may add 2–3 sentences of atmospheric prose. The list itself must not change.

Forbidden creatures (do not mention, even in passing):
${[...new Set(compositionPlan.forbiddenMonsterNames)].slice(0, 10).map(n => `- ${n}`).join('\n')}
`
    : '';

  return [
    {
      role: 'system',
      content: `You are repairing a Karsac Design Assistant answer.

Your previous answer did not follow the required output contract.
${noMonsterSection}${homebrewSection}${compositionSection}
Rewrite the full answer. All ten sections are required.
Do not invent stat blocks or canon facts.
Do not add any stat changes anywhere in the answer.
Do not remove the provisional label.`,
    },
    {
      role: 'user',
      content: `Original question:
${question}

Previous answer:
${badResponse}

Required output structure — use exactly these headings:

## Provisional encounter concept
## Why it fits Karsac
## Encounter setup
## Creatures / opposition
## Terrain and pressure
## What this reveals
## Running it at the table
## Scaling options
## Player-safe description
## Canon status

Rules:
- Do not add an introduction.
- Do not rename headings.
- Start with \`## Provisional encounter concept\`.
- ## Scaling options must use only: creature count, distance, terrain, morale threshold, warning, non-combat pressure.
- Canon status must say: Provisional table material — not canon until accepted.`,
    },
  ];
}

// ── Design context loading ────────────────────────────────────────────────────

/** Rule files loaded for every encounter design request. */
const DESIGN_ENCOUNTER_RULES_IDS = [
  'rules/core/movement-and-position',
  'rules/core/conditions',
  'rules/core/cover',
  'rules/core/hiding-stealth-perception',
  'rules/core/vision-and-light',
] as const;

const DESIGN_MAX_MONSTERS = 5;

interface MonsterEntry {
  id: string;
  name: string;
  cr: number;
  size: string;
  type: string;
  terrain: string[];
  roles: string[];
  displacement: {
    nativeTo: string[];
    canMoveTo: string[];
    reasons: string[];
  };
  karsacFit: {
    regions: string[];
    tone: string[];
    notes?: string;
  };
  sourceRule: string;
}


interface MonsterCandidate {
  key: string;
  monster: MonsterEntry;
  score: number;
  reasons: string[];
}

interface DesignContext {
  canonFiles: CanonFile[];
  rulesFiles: CanonFile[];
  monsterFiles: CanonFile[];
  monsterCandidates: MonsterCandidate[];
  resolvedIds: string[];
  partyInfo: { size: number | null; level: number | null };
  /** True when a corpus exists but no candidates are level-appropriate. */
  noSuitableMonsters: boolean;
  loadedMonsterNames: string[];
  /** Deterministic composition plan — null when no monster corpus. */
  compositionPlan: EncounterCompositionPlan | null;
  /** Compiled encounter brief — replaces the raw question as the model's user message. */
  encounterBrief: EncounterBrief | null;
}

/** Extract terrain/region/displacement/party signals from the question text. */
function extractDesignSignals(question: string, resolvedIds: string[]): {
  terrainSignals: Set<string>;
  destinationSignals: Set<string>;
  regionSignals: Set<string>;
  displacementSignals: string[];
  partyInfo: { size: number | null; level: number | null };
} {
  const lq = question.toLowerCase();
  const terrainSignals = new Set<string>();
  const destinationSignals = new Set<string>();
  const regionSignals = new Set<string>();
  const displacementSignals: string[] = [];

  // Terrain of origin — use substring includes for common plurals (mountains, forests, etc.)
  if (/mountain|peaks?|highland|high ground|cliff|ridge/.test(lq)) terrainSignals.add('mountain');
  if (/forest|wood(?:land)?|trees?/.test(lq)) terrainSignals.add('forest');
  if (/hills?|hillside|slopes?/.test(lq)) terrainSignals.add('hills');
  if (/cave|cavern|underground|tunnel/.test(lq)) terrainSignals.add('cavern');

  // Destination / can-move-to
  if (/coast|coastal|shore|sea|harbour|harbor|dock/.test(lq)) destinationSignals.add('coast');
  if (/\broad\b|path|trail|travel/.test(lq)) destinationSignals.add('road');
  if (/settlement|village|town|city|edge/.test(lq)) destinationSignals.add('settlement-edge');

  // Region from resolved entity IDs (e.g. "places/losweg" → "losweg")
  for (const id of resolvedIds) {
    const parts = id.split('/');
    regionSignals.add(parts[parts.length - 1]);  // e.g. "losweg"
    if (parts.length > 2) regionSignals.add(parts.slice(1).join('-')); // sub-place
  }
  // Detect region names inline — use simple includes for names with diacritics
  const lqNorm = lq.normalize('NFD').replace(/[̀-ͯ]/g, ''); // strip diacritics
  if (lqNorm.includes('losweg') || lq.includes('lösweg')) regionSignals.add('losweg');
  if (lqNorm.includes('torweg') || lq.includes('törweg')) regionSignals.add('torweg');
  if (lq.includes('stormwatch')) regionSignals.add('stormwatch-mountains');
  if (/the\s+maw/.test(lq)) regionSignals.add('the-maw');

  // Displacement reasons
  if (/disturb|displace|driven|forced|push|pressure/.test(lq)) displacementSignals.push('territorial-pressure');
  if (/hunger|starv|food|prey/.test(lq)) displacementSignals.push('hunger');
  if (/winter|cold|ice|snow|freez/.test(lq)) displacementSignals.push('winter');
  if (/magic|disturbance|spell|rift|anomal/.test(lq)) displacementSignals.push('magical-disturbance');

  const partyInfo = extractPartyInfo(question);

  return { terrainSignals, destinationSignals, regionSignals, displacementSignals, partyInfo };
}

/** Score monsters by relevance to the encounter signals, with party-level CR filtering. */
function scoreMonsterCandidates(
  monstersData: Record<string, MonsterEntry>,
  signals: ReturnType<typeof extractDesignSignals>,
  maxResults: number,
  question = '',
): MonsterCandidate[] {
  const { terrainSignals, destinationSignals, regionSignals, displacementSignals, partyInfo } = signals;
  const scored: MonsterCandidate[] = [];

  for (const [key, monster] of Object.entries(monstersData)) {
    let score = 0;
    const reasons: string[] = [];

    // Explicit request boost: if the user names this creature directly, it MUST be
    // selected. A +25 boost ensures it always tops terrain/region candidates.
    // Check the key, hyphen-normalised key, and monster name (all with optional plural 's').
    if (question) {
      const nameForms = [
        key,
        key.replace(/-/g, ' '),
        (monster.name ?? key).toLowerCase(),
      ];
      for (const form of nameForms) {
        if (form && new RegExp(`\\b${form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?\\b`, 'i').test(question)) {
          score += 25;
          reasons.push(`explicit-request: ${form}`);
          break;
        }
      }
    }
    const nativeTo = new Set(monster.displacement?.nativeTo ?? []);
    const canMoveTo = new Set(monster.displacement?.canMoveTo ?? []);
    const monsterTerrain = new Set(monster.terrain ?? []);
    const monsterRegions = new Set(monster.karsacFit?.regions ?? []);
    const dispReasons = monster.displacement?.reasons ?? [];

    // Native terrain match — strong signal, creature genuinely lives here
    for (const t of terrainSignals) {
      if (nativeTo.has(t)) { score += 6; reasons.push(`native: ${t}`); }
      else if (monsterTerrain.has(t)) { score += 2; reasons.push(`terrain: ${t}`); }
    }

    // Destination/can-move-to — weaker; many creatures can range widely
    for (const d of destinationSignals) {
      if (canMoveTo.has(d)) { score += 2; reasons.push(`can move to: ${d}`); }
    }

    // Region match — high value when the DM specifies a named Karsac location
    for (const r of regionSignals) {
      if (monsterRegions.has(r)) { score += 4; reasons.push(`region: ${r}`); }
    }

    // Displacement reason match
    for (const dr of displacementSignals) {
      const normalized = dr.replace(/-/g, ' ');
      if (dispReasons.some(r => r.includes(normalized) || r.includes(dr))) {
        score += 2; reasons.push(`displacement: ${dr}`);
      }
    }

    // Role relevance bonus: combat/encounter-meaningful roles rank higher than trivial ones
    const combatRoles = new Set(['pack-predator', 'apex-predator', 'bruiser', 'skirmisher',
      'territorial-threat', 'ambusher', 'shock-assault', 'aerial-hunter']);
    if (monster.roles?.some(r => combatRoles.has(r))) { score += 1; }

    // CR suitability — hard filter when party level is known
    const cr = typeof monster.cr === 'number' ? monster.cr : 0;
    if (partyInfo.level !== null) {
      const crAdj = crSuitabilityAdjustment(cr, partyInfo.level);
      score += crAdj;
      if (crAdj < 0) reasons.push(`CR ${cr} (level ${partyInfo.level} party: ${crAdj > -10 ? 'borderline' : 'too high'})`);
      else reasons.push(`CR ${cr} (level-appropriate)`);
    } else if (score > 0 && cr >= 1) {
      score += 0.5; // mild CR tiebreaker when party level unknown
    }

    // Encounter quality tiebreaker: prefer meaningful combat threats over trivial creatures.
    // CR 1–3 are the sweet spot; sub-1/4 creatures are rarely the primary encounter threat.
    if (cr >= 1 && cr <= 3) score += 2;
    else if (cr >= 0.5) score += 1;
    else if (cr < 0.25) score -= 2; // bats, stirges, eagles — atmosphere, not encounter core

    if (score > 0) scored.push({ key, monster, score, reasons });
  }

  return scored
    .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key))
    .slice(0, maxResults);
}

function loadDesignContext(
  question: string,
  aliases: AliasMap,
  entities: EntityMap,
  collectionsRoot: string,
): DesignContext {
  // Resolve named canon entities — failure is OK
  const { resolved } = resolveQuestion(question, aliases, entities);
  const resolvedIds = resolved.map(m => m.entity.id);

  const canonFiles: CanonFile[] = [];
  for (const match of resolved) {
    try {
      canonFiles.push(loadCanonFile(match.entity, entities, collectionsRoot));
    } catch { /* file missing — skip gracefully */ }
  }

  const rulesFiles: CanonFile[] = [];
  for (const ruleId of DESIGN_ENCOUNTER_RULES_IDS) {
    const ruleEntity = entities[ruleId];
    if (!ruleEntity) continue;
    try {
      rulesFiles.push(loadCanonFile(ruleEntity, entities, collectionsRoot));
    } catch { /* skip */ }
  }

  // Monster context: load from rules-data if available
  let monsterFiles: CanonFile[] = [];
  let monsterCandidates: MonsterCandidate[] = [];
  let noSuitableMonsters = false;
  let loadedMonsterNames: string[] = [];
  let partyInfo: { size: number | null; level: number | null } = { size: null, level: null };
  let compositionPlan: EncounterCompositionPlan | null = null;
  let encounterBrief: EncounterBrief | null = null;

  const monstersPath = resolve(RULES_DATA_DIR, 'monsters.json');
  if (existsSync(monstersPath)) {
    const monstersData = JSON.parse(readFileSync(monstersPath, { encoding: 'utf-8' })) as Record<string, MonsterEntry>;

    const signals = extractDesignSignals(question, resolvedIds);
    partyInfo = signals.partyInfo;
    monsterCandidates = scoreMonsterCandidates(monstersData, signals, DESIGN_MAX_MONSTERS, question);

    // noSuitableMonsters: corpus exists but all top candidates are CR-penalised out of band
    if (monsterCandidates.length === 0) {
      noSuitableMonsters = true;
    } else if (partyInfo.level !== null) {
      const allOutOfBand = monsterCandidates.every(c => {
        const cr = typeof c.monster.cr === 'number' ? c.monster.cr : 0;
        return cr > partyInfo.level! + 3;
      });
      if (allOutOfBand) noSuitableMonsters = true;
    }

    if (!noSuitableMonsters) {
      // Build the deterministic composition plan before loading files
      const candidatesForComposition: CandidateForComposition[] = monsterCandidates.map(c => ({
        key: c.key,
        monsterName: c.monster.name,
        monsterId: c.monster.sourceRule ?? c.monster.id ?? `monsters/srd-2014/${c.key}`,
        cr: typeof c.monster.cr === 'number' ? c.monster.cr : 0,
        roles: c.monster.roles ?? [],
      }));
      compositionPlan = buildEncounterCompositionPlan(
        candidatesForComposition,
        partyInfo.size,
        partyInfo.level,
        question,
        false, // allowHomebrew passed separately to main(); false here for context loading
        signals.regionSignals,
      );

      // Load only the files the composition plan selected (not all candidates)
      for (const creature of compositionPlan.selectedOpposition) {
        const monsterEntity = entities[creature.monsterId];
        if (!monsterEntity) continue;
        try {
          const file = loadCanonFile(monsterEntity, entities, collectionsRoot);
          monsterFiles.push(file);
          loadedMonsterNames.push(creature.monsterName);
        } catch { /* file missing — skip */ }
      }
    }
  }

  // Compile the encounter brief if we have a composition plan.
  // Note: allowHomebrew is not available here (it comes from CLI flags); the brief
  // is rebuilt in main() with the correct flag. This null-check ensures we only
  // build it when there is a meaningful composition to brief from.
  if (compositionPlan) {
    const signals = extractDesignSignals(question, resolvedIds);
    const intent = parseEncounterIntent(
      question, partyInfo, compositionPlan.difficultyIntent, signals.regionSignals, false,
    );
    encounterBrief = compileEncounterBrief(intent, compositionPlan);
  }

  return { canonFiles, rulesFiles, monsterFiles, monsterCandidates, resolvedIds,
           partyInfo, noSuitableMonsters, loadedMonsterNames, compositionPlan, encounterBrief };
}

// ── Extract-then-compare ──────────────────────────────────────────────────────

async function extractThenCompare(
  canons: CanonFile[],
  question: string,
  profile: KarsacProfile,
): Promise<void> {
  // Phase 1: extract facts from each entity file independently
  const packets: FactPacket[] = [];
  for (let i = 0; i < canons.length; i++) {
    process.stderr.write(`  [${i + 1}/${canons.length}] Extracting: ${canons[i].id}…\n`);
    const facts = await callOllama(buildExtractionMessages(canons[i]), { silent: true, profile });
    packets.push({ canon: canons[i], facts });
  }
  process.stderr.write('\n');

  // Phase 2: compare the extracted fact packets
  const comparisonMessages = buildComparisonFromFactsMessages(packets, question);
  const response = await callOllama(comparisonMessages, { profile });

  if (!validateComparisonResponse(response)) {
    process.stderr.write(
      '\n⚠  Output contract validation failed. Retrying with repair prompt…\n\n',
    );
    await callOllama(buildRepairMessages(comparisonMessages, response), { profile });
  }
}

// ── Extract-then-analyse (deep-lore) ─────────────────────────────────────────

function savePromptToDebug(filename: string, content: string): void {
  mkdirSync(DEBUG_DIR, { recursive: true });
  const p = resolve(DEBUG_DIR, filename);
  writeFileSync(p, content, { encoding: 'utf-8' });
  process.stderr.write(`  [saved prompt → ${p}]\n`);
}

/**
 * For deep-lore with >1 loaded file: extract facts per file silently, then
 * analyse from fact packets only. Returns the final response text.
 */
async function extractThenAnalyse(
  canons: CanonFile[],
  question: string,
  profile: KarsacProfile,
  doSavePrompt: boolean,
): Promise<string> {
  // Phase 1: extract facts from each file independently
  const packets: FactPacket[] = [];
  for (let i = 0; i < canons.length; i++) {
    process.stderr.write(`  [${i + 1}/${canons.length}] Extracting: ${canons[i].id}…\n`);
    const extractMsgs = buildDeepLoreExtractionMessages(canons[i]);
    if (doSavePrompt) {
      savePromptToDebug(
        `extract-${canons[i].id.replace(/\//g, '-')}.txt`,
        extractMsgs.map(m => `[${m.role}]\n${m.content}`).join('\n\n---\n\n'),
      );
    }
    const facts = await callOllama(extractMsgs, { silent: true, profile });
    packets.push({ canon: canons[i], facts });
  }
  process.stderr.write('\n');

  // Phase 2: analyse from fact packets only
  const analyseMsgs = buildDeepLoreFromFactsMessages(packets, question);
  if (doSavePrompt) {
    savePromptToDebug(
      'analyse-from-facts.txt',
      analyseMsgs.map(m => `[${m.role}]\n${m.content}`).join('\n\n---\n\n'),
    );
  }
  const response = await callOllama(analyseMsgs, { profile });
  return response;
}

// ── State context loader ──────────────────────────────────────────────────────

interface LoadedStateContext extends StateContextData {
  loadedFiles: string[];
}

function loadStateContext(question: string): LoadedStateContext {
  const lq = question.toLowerCase();
  const loadedFiles: string[] = [];

  function readState(relPath: string): Record<string, unknown> | null {
    const p = resolve(STATE_ROOT, relPath);
    if (!existsSync(p)) return null;
    loadedFiles.push(`corpus/state/${relPath}`);
    return JSON.parse(readFileSync(p, { encoding: 'utf-8' })) as Record<string, unknown>;
  }

  // Core files — always loaded
  const playerKnowledge = readState('player-knowledge.json');
  const campaignState   = readState('campaign-state.json');
  const partyState      = readState('party-state.json');
  const worldThreads    = readState('world-threads.json');
  const npcsState       = readState('npcs-state.json');
  const itemsState      = readState('items-state.json');

  // Session-specific files — load when the query mentions session/facts/handouts/progress/radar
  const needsSession =
    lq.includes('session') || lq.includes('fact') || lq.includes('handout') ||
    lq.includes('progress') || lq.includes('step') || lq.includes('radar') ||
    lq.includes('reveal') || lq.includes('available') || lq.includes('chapter 3') ||
    lq.includes('carry forward') || lq.includes('pick up');

  const sessionFacts    = needsSession ? readState('session-facts/session-2.json') : null;
  const sessionProgress = needsSession ? readState('session-progress/session-2.json') : null;
  const handouts        = needsSession ? readState('handouts/session-2.json') : null;
  const radar           = needsSession ? readState('radar/session-2.json') : null;

  return {
    playerKnowledge, campaignState, partyState, worldThreads,
    npcsState, itemsState, sessionFacts, sessionProgress, handouts,
    radar, loadedFiles,
  };
}

// ── Encounter-design context loader ──────────────────────────────────────────

function loadEncounterDesignContext(question: string): EncounterDesignCtx {
  const adversaries = loadScoredAdversaries(ADVERSARY_CORPUS_ROOT, question, 3);
  const patterns = loadScoredPatterns(ENCOUNTER_PATTERNS_ROOT, question, 2);

  // Collect all mechanical_base refs across matched adversaries
  const allBases = [...new Set(adversaries.flatMap(a => a.mechanicalBase))];
  const npcBases = getNpcBaseSummaries(allBases);

  // Minimal state summary — load core state files only
  function readStateFile(relPath: string): Record<string, unknown> | null {
    const p = resolve(STATE_ROOT, relPath);
    if (!existsSync(p)) return null;
    try {
      return JSON.parse(readFileSync(p, { encoding: 'utf-8' })) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  const campaignState   = readStateFile('campaign-state.json');
  const partyState      = readStateFile('party-state.json');
  const worldThreads    = readStateFile('world-threads.json');
  const playerKnowledge = readStateFile('player-knowledge.json');

  return {
    adversaries,
    patterns,
    npcBases,
    stateData: { campaignState, partyState, worldThreads, playerKnowledge },
  };
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { question, profileName: explicitProfileName, explicitMode, maxRelated, maxRelatedExplicit, debugRelated, strategy, savePrompt, allowHomebrew } = parseArgs();
  if (!question) {
    console.error('Usage: npm run karsac:ask -- "<question>" [--profile <name>] [--mode player|dm]');
    console.error('Example: npm run karsac:ask -- "Tell me about Brynja"');
    console.error(`Profiles:  ${Object.keys(PROFILES).join(', ')}  (auto-routed when omitted)`);
    process.exit(1);
  }

  // ── Profile and mode resolution ─────────────────────────────────────────────
  let profile: KarsacProfile;
  let mode: ProseMode;
  let routeResult: RouteResult | null = null;

  if (explicitProfileName !== null) {
    const p = PROFILES[explicitProfileName];
    if (!p) {
      console.error(`Unknown profile: "${explicitProfileName}". Available: ${Object.keys(PROFILES).join(', ')}`);
      process.exit(1);
    }
    profile = p;
    mode = explicitMode ?? p.defaultMode;
  } else {
    routeResult = routeQuestion(question);
    profile = PROFILES[routeResult.profile];
    mode = (routeResult.modeOverride ?? explicitMode ?? profile.defaultMode) as ProseMode;
    process.stderr.write(`\nRoute:\n  profile: ${routeResult.profile}\n  reason: ${routeResult.reason}\n`);
  }

  const aliases = loadJSON<AliasMap>('aliases.json');
  const entities = loadJSON<EntityMap>('entities.json');

  // ── design: own retrieval path — does not require entity resolution ──────────
  if (profile.name === 'design') {
    const ctx = loadDesignContext(question, aliases, entities, COLLECTIONS_ROOT);
    const noMonsterData = ctx.monsterFiles.length === 0;

    process.stderr.write(`→ Model:  ${profile.model} @ ${OLLAMA_HOST}\n`);
    process.stderr.write(`\nProfile:\n  ${profile.name}\n`);
    process.stderr.write(`\nMode:\n  encounter\n`);
    process.stderr.write(`\nStrategy:\n  design-canon-plus-encounter-rules\n`);

    // Party info
    if (ctx.partyInfo.size !== null || ctx.partyInfo.level !== null) {
      process.stderr.write(`\nParty:\n`);
      if (ctx.partyInfo.size !== null) process.stderr.write(`  size: ${ctx.partyInfo.size}\n`);
      if (ctx.partyInfo.level !== null) process.stderr.write(`  level: ${ctx.partyInfo.level}\n`);
    }
    if (allowHomebrew) process.stderr.write(`\nHomebrew gate:\n  --allow-homebrew active\n`);

    if (ctx.canonFiles.length > 0) {
      process.stderr.write(`\nCanon context:\n`);
      for (const f of ctx.canonFiles) process.stderr.write(`  - ${f.id}  (${f.path})\n`);
    } else {
      process.stderr.write(`\nCanon context:\n  - none resolved\n`);
    }
    process.stderr.write(`\nRules context:\n`);
    for (const f of ctx.rulesFiles) process.stderr.write(`  - ${f.id}  (${f.path})\n`);

    if (ctx.monsterCandidates.length > 0) {
      process.stderr.write(`\nMonster context:\n  loaded\n`);
      process.stderr.write(`\nMonster candidates:\n`);
      for (const c of ctx.monsterCandidates) {
        process.stderr.write(`  - monsters/srd-2014/${c.key} — ${c.reasons.join('; ')}\n`);
      }
      if (ctx.noSuitableMonsters) {
        process.stderr.write(`\n⚠  No suitable level-appropriate candidates — falling back to role-only opposition.\n`);
      } else if (ctx.compositionPlan) {
        process.stderr.write(`\n${formatCompositionDebug(ctx.compositionPlan)}\n`);
        process.stderr.write(`\nSelected monster files:\n`);
        for (const f of ctx.monsterFiles) process.stderr.write(`  - ${f.id}  (${f.path})\n`);
      }
    } else {
      process.stderr.write(`\nMonster context:\n  none loaded\n`);
    }
    process.stderr.write('\n');

    // Rebuild composition plan with the actual allowHomebrew flag from CLI
    const finalCompositionPlan = ctx.compositionPlan
      ? buildEncounterCompositionPlan(
          ctx.compositionPlan.selectedOpposition.map(c => ({
            key: c.monsterId.replace(/^monsters\/srd-2014\//, ''),
            monsterName: c.monsterName,
            monsterId: c.monsterId,
            cr: c.cr,
            roles: [],
          })),
          ctx.partyInfo.size,
          ctx.partyInfo.level,
          question,
          allowHomebrew,
          extractDesignSignals(question, ctx.resolvedIds).regionSignals,
        )
      : null;

    // Rebuild the brief and composition plan with the actual allowHomebrew flag.
    const signals = extractDesignSignals(question, ctx.resolvedIds);
    const finalBrief = finalCompositionPlan
      ? compileEncounterBrief(
          parseEncounterIntent(question, ctx.partyInfo, finalCompositionPlan.difficultyIntent, signals.regionSignals, allowHomebrew),
          finalCompositionPlan,
        )
      : null;

    // Debug: confirm raw question is NOT the model instruction
    if (finalBrief) {
      process.stderr.write(`\n${formatEncounterBriefDebug(finalBrief)}\n`);
    }

    const designMessages = buildDesignMessages(ctx.canonFiles, ctx.rulesFiles, question, ctx.monsterFiles, {
      partyInfo: ctx.partyInfo.level !== null ? ctx.partyInfo as { size: number | null; level: number } : null,
      allowHomebrew,
      noSuitableMonsters: ctx.noSuitableMonsters,
      loadedMonsterNames: ctx.loadedMonsterNames,
      compositionPlan: finalCompositionPlan,
      encounterBrief: finalBrief,
    });
    const rawDesignResponse = await callOllama(designMessages, { profile });
    const designResponse = finalCompositionPlan
      ? injectLockedCreatureSection(rawDesignResponse, finalCompositionPlan)
      : rawDesignResponse;
    if (finalCompositionPlan && rawDesignResponse !== designResponse) {
      process.stderr.write(`  [creatures / opposition section injected deterministically]\n`);
    }

    const compositionViolations = finalCompositionPlan
      ? checkCompositionViolations(designResponse, finalCompositionPlan)
      : [];
    if (!validateDesignResponse(designResponse, noMonsterData, allowHomebrew, ctx.loadedMonsterNames, finalCompositionPlan)) {
      const noMonsterViolations = noMonsterData ? checkNoMonsterViolations(designResponse) : [];
      const homebrewViolations = allowHomebrew ? [] : checkHomebrewViolations(designResponse, ctx.loadedMonsterNames);
      const allViolations = [...noMonsterViolations, ...homebrewViolations, ...compositionViolations];
      if (allViolations.length > 0) {
        process.stderr.write(`\n⚠  Guardrail violations: ${allViolations.join(', ')}\n`);
      }
      process.stderr.write('\n⚠  Output contract validation failed. Running silent repair…\n');

      // Repair uses the compiled brief (not the raw question) as the user instruction.
      const repairBriefText = finalBrief?.briefText ?? question;
      const repairedRaw = await callOllama(
        buildDesignRepairMessages(repairBriefText, designResponse, noMonsterData, allowHomebrew, ctx.loadedMonsterNames, finalCompositionPlan),
        { profile, silent: true },
      );
      const repaired = finalCompositionPlan
        ? injectLockedCreatureSection(repairedRaw, finalCompositionPlan)
        : repairedRaw;

      if (validateDesignResponse(repaired, noMonsterData, allowHomebrew, ctx.loadedMonsterNames, finalCompositionPlan)) {
        process.stderr.write('✓  Repair passed validation.\n\n');
        process.stdout.write(repaired + '\n');
      } else {
        const repairViolations = [
          ...(noMonsterData ? checkNoMonsterViolations(repaired) : []),
          ...(allowHomebrew ? [] : checkHomebrewViolations(repaired, ctx.loadedMonsterNames)),
          ...(finalCompositionPlan ? checkCompositionViolations(repaired, finalCompositionPlan) : []),
        ];
        process.stderr.write(`\n⚠  REPAIR VALIDATION FAILED\n`);
        process.stderr.write(`   Remaining violations: ${repairViolations.join(', ')}\n`);

        // Deterministic fallback: render a correct answer without model involvement.
        if (finalBrief && finalCompositionPlan) {
          process.stderr.write(`   Rendering deterministic fallback — model output discarded.\n\n`);
          const fallback = renderDeterministicFallback(finalBrief.intent, finalCompositionPlan);
          process.stdout.write(fallback + '\n');
        } else {
          process.stderr.write(`   Stripping violating lines and outputting cleaned response.\n\n`);
          const { stripped, removed } = stripViolatingContent(repaired, allowHomebrew, noMonsterData, ctx.loadedMonsterNames);
          if (removed.length > 0) {
            process.stderr.write(`Removed lines:\n`);
            for (const line of removed) process.stderr.write(`  - ${line.slice(0, 80)}\n`);
            process.stderr.write('\n');
          }
          process.stdout.write(stripped + '\n');
        }
      }
    }
    return;
  }

  // ── encounter-design: own path — no entity resolution ───────────────────────
  if (profile.name === 'encounter-design') {
    process.stderr.write(`→ Model:  ${profile.model} @ ${OLLAMA_HOST}\n`);
    process.stderr.write(`\nProfile:\n  ${profile.name}\n`);
    process.stderr.write(`\nStrategy:\n  encounter-design-adversary-plus-patterns\n`);

    const edCtx = loadEncounterDesignContext(question);

    process.stderr.write(`\nAdversaries selected:\n`);
    if (edCtx.adversaries.length > 0) {
      for (const adv of edCtx.adversaries) {
        process.stderr.write(`  - ${adv.id}  (score: ${adv.score}  reasons: ${adv.scoreReasons.slice(0, 3).join(', ')})\n`);
      }
    } else {
      process.stderr.write(`  - none matched\n`);
    }

    process.stderr.write(`\nPatterns matched:\n`);
    if (edCtx.patterns.length > 0) {
      for (const pat of edCtx.patterns) {
        process.stderr.write(`  - ${pat.id}  (score: ${pat.score})\n`);
      }
    } else {
      process.stderr.write(`  - none matched\n`);
    }
    process.stderr.write('\n');

    const edMessages = buildEncounterDesignMessages(edCtx, question);
    await callOllama(edMessages, { profile });
    return;
  }

  // ── state: own path — reads corpus/state JSON files, no entity resolution ────
  if (profile.name === 'state') {
    process.stderr.write(`→ Model:  ${profile.model} @ ${OLLAMA_HOST}\n`);
    process.stderr.write(`\nProfile:\n  ${profile.name}\n`);
    process.stderr.write(`\nStrategy:\n  state-corpus-direct\n`);

    const stateCtx = loadStateContext(question);

    process.stderr.write(`\nState files loaded:\n`);
    for (const f of stateCtx.loadedFiles) process.stderr.write(`  - ${f}\n`);
    process.stderr.write('\n');

    const stateMessages = buildStateMessages(stateCtx, question);
    await callOllama(stateMessages, { profile });
    return;
  }

  process.stderr.write(`Resolving: "${question}"\n`);

  const { resolved, unresolved } = profile.name === 'rules'
    ? resolveRulesQuestion(question, aliases, entities)
    : resolveQuestion(question, aliases, entities);

  if (resolved.length === 0 && unresolved.length === 0) {
    console.error(`\nNo known entity found in: "${question}"`);
    console.error('Try: npm run karsac:lookup -- "<name>" to check the registry.');
    process.exit(1);
  }

  if (unresolved.length > 0) {
    if (resolved.length > 0) {
      process.stderr.write(`Resolved entities:\n`);
      for (const m of resolved) {
        process.stderr.write(`- ${m.entity.id}  —  ${m.entity.title}\n`);
      }
    }
    process.stderr.write(`\nUnresolved entities:\n`);
    for (const phrase of unresolved) {
      process.stderr.write(`- ${phrase}\n`);
    }
    process.stderr.write(`\nNo answer generated. Resolve or remove unresolved entities before asking.\n`);
    process.exit(1);
  }

  const matches = resolved;

  if (matches.length === 1) {
    const m = matches[0];
    process.stderr.write(`→ ${m.entity.id}  —  ${m.entity.title}  [score:${m.score} ${m.matchReason}]\n`);
  } else {
    process.stderr.write(`Resolved ${matches.length} entities:\n`);
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      process.stderr.write(`  ${i + 1}. ${m.entity.id}  —  ${m.entity.title}  [score:${m.score} ${m.matchReason}]\n`);
    }
  }

  // ── rules: rules-exact-plus-related ─────────────────────────────────────────
  if (profile.name === 'rules') {
    const primaryCanons = matches.map(m => loadCanonFile(m.entity, entities, COLLECTIONS_ROOT));
    const relatedCanons = loadRulesRelatedContext(matches, entities, COLLECTIONS_ROOT);
    const allCanons = [...primaryCanons, ...relatedCanons];

    // Structured data: conditions, abilities, etc.
    const structuredEntries: StructuredEntry[] = [];
    const conditionsData = loadRulesDataFile<RulesDataEntry>('conditions.json');
    if (conditionsData) {
      structuredEntries.push(...detectStructuredEntries(question, conditionsData, 'rules-data/conditions.json'));
    }

    process.stderr.write(`→ Model:  ${profile.model} @ ${OLLAMA_HOST}\n`);
    process.stderr.write(`\nProfile:\n  ${profile.name}\n`);
    process.stderr.write(`\nStrategy:\n  rules-exact-plus-related\n`);
    if (structuredEntries.length > 0) {
      process.stderr.write(`\nStructured data:\n`);
      for (const e of structuredEntries) {
        process.stderr.write(`  - ${e.id} from ${e.sourceDataFile}\n`);
      }
    }
    process.stderr.write(`\nPrimary files:\n`);
    for (const c of primaryCanons) process.stderr.write(`  - ${c.id}  (${c.path})\n`);
    if (relatedCanons.length > 0) {
      process.stderr.write(`\nRelated rule files:\n`);
      for (const c of relatedCanons) process.stderr.write(`  - ${c.id}  (${c.path})\n`);
    }
    process.stderr.write('\n');

    const rulesMessages = buildRulesMessages(allCanons, question, structuredEntries);
    const rulesResponse = await callOllama(rulesMessages, { profile });

    if (!validateRulesResponse(rulesResponse)) {
      process.stderr.write('\n⚠  Output contract validation failed. Retrying with repair prompt…\n\n');
      const repaired = await callOllama(buildRulesRepairMessages(question, rulesResponse), { profile });
      if (!validateRulesResponse(repaired)) {
        process.stderr.write('⚠  Output still failed validation after repair. Showing best effort answer.\n');
      }
    }
    return;
  }

  // ── deep-lore: exact-plus-related ───────────────────────────────────────────
  if (profile.name === 'deep-lore') {
    const lq = question.toLowerCase();
    if (lq.includes('player-facing') || lq.includes('player facing')) {
      process.stderr.write(
        `\n⚠  --profile deep-lore is DM-facing and does not produce player-safe output.\n` +
        `   For player-facing prose, use: --profile prose --mode player\n`,
      );
      process.exit(1);
    }

    // Auto-raise max-related for 3+ primary entities unless user set it explicitly
    const effectiveMaxRelated = (!maxRelatedExplicit && matches.length >= 3)
      ? DEEP_LORE_MAX_RELATED_MULTI
      : maxRelated;

    const priority = getExpansionPriority(question, matches);

    const ctx = loadDeepLoreContext(
      matches, entities, aliases, COLLECTIONS_ROOT, question, priority, effectiveMaxRelated, debugRelated,
    );
    const allCanons = [...ctx.primaryCanons, ...ctx.expandedCanons];

    if (debugRelated) {
      for (const line of ctx.debugLines) process.stderr.write(line);
    }

    const useExtractThenAnalyse = strategy !== 'direct' && allCanons.length > 1;
    const strategyName = useExtractThenAnalyse
      ? 'deep-lore-extract-then-analyse'
      : 'deep-lore-exact-file';

    process.stderr.write(`→ Model:  ${profile.model} @ ${OLLAMA_HOST}\n`);
    process.stderr.write(`\nProfile:\n  ${profile.name}\n`);
    process.stderr.write(`\nMode:\n  dm\n`);
    process.stderr.write(`\nStrategy:\n  ${strategyName}\n`);
    process.stderr.write(`\nMax related:\n  ${effectiveMaxRelated}\n`);
    process.stderr.write(`\nRelated expansion priority:\n  ${priority.join(' > ')}\n`);
    process.stderr.write(`\nPrimary files:\n`);
    for (const c of ctx.primaryCanons) {
      process.stderr.write(`  - ${c.id}  (${c.path})\n`);
    }
    process.stderr.write(`\nExpanded related files:\n`);
    if (ctx.expandedCanons.length > 0) {
      for (const c of ctx.expandedCanons) process.stderr.write(`  - ${c.id}  (${c.path})\n`);
    } else {
      process.stderr.write(`  - none\n`);
    }
    process.stderr.write(`\nSkipped related files:\n`);
    if (ctx.skipped.length > 0) {
      for (const s of ctx.skipped) process.stderr.write(`  - ${s.id} — ${s.reason}\n`);
    } else {
      process.stderr.write(`  - none\n`);
    }
    process.stderr.write('\n');

    let response: string;
    if (useExtractThenAnalyse) {
      process.stderr.write(`Extracting canon facts per file…\n`);
      response = await extractThenAnalyse(allCanons, question, profile, savePrompt);
    } else {
      const deepLoreMessages = buildDeepLoreMessages(allCanons, question);
      if (savePrompt) {
        savePromptToDebug(
          'deep-lore-direct.txt',
          deepLoreMessages.map(m => `[${m.role}]\n${m.content}`).join('\n\n---\n\n'),
        );
      }
      response = await callOllama(deepLoreMessages, { profile });
    }

    if (!validateDeepLoreResponse(response)) {
      process.stderr.write(
        '\n⚠  Output contract validation failed. Retrying with repair prompt…\n\n',
      );
      const repairResponse = await callOllama(
        buildDeepLoreRepairMessages(question, response), { profile },
      );
      if (!validateDeepLoreResponse(repairResponse)) {
        process.stderr.write(
          '⚠  Output still failed validation after repair. Showing best effort answer.\n',
        );
      }
    }
    return;
  }

  // ── canon / prose: exact-file or extract-then-compare ───────────────────────
  const rawCanons = matches.map(m => loadCanonFile(m.entity, entities, COLLECTIONS_ROOT));

  if (rawCanons.length === 1) {
    process.stderr.write(`→ Loaded: ${rawCanons[0].path}\n`);
  } else {
    process.stderr.write(`Context files:\n`);
    for (const c of rawCanons) process.stderr.write(`  - ${c.id}  (${c.path})\n`);
  }

  // Apply player-mode filtering for prose profile
  const canons = (profile.name === 'prose' && mode === 'player')
    ? rawCanons.map(c => ({ ...c, content: filterPlayerContent(c.content) }))
    : rawCanons;

  // extract-then-compare only for canon profile on comparison questions
  const isComparison = isComparisonQuestion(question) && canons.length >= 2 && profile.name === 'canon';
  const canonStrategy = isComparison ? 'extract-then-compare' : 'exact-file';

  process.stderr.write(`→ Model:  ${profile.model} @ ${OLLAMA_HOST}\n`);
  process.stderr.write(`\nProfile:\n  ${profile.name}\n`);
  if (profile.name === 'prose') process.stderr.write(`\nMode:\n  ${mode}\n`);
  process.stderr.write(`\nStrategy:\n  ${canonStrategy}\n\n`);

  if (isComparison) {
    process.stderr.write('Extracting canon facts per entity…\n');
    await extractThenCompare(canons, question, profile);
  } else if (profile.name === 'prose') {
    await callOllama(buildProseMessages(canons, question), { profile });
  } else {
    await callOllama(buildMessages(canons, question), { profile });
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
