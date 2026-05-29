import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync } from 'fs';
import type { AliasMap, EntityMap } from './types.js';
import { scoreMatches, isBestMatch } from './scorer.js';
import type { ScoredMatch } from './scorer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INDEX_DIR = resolve(__dirname, '..', '.karsac-index');

function loadJSON<T>(name: string): T {
  const p = resolve(INDEX_DIR, name);
  if (!existsSync(p)) {
    console.error(`Index file not found: ${p}`);
    console.error('Run: npm run karsac:index');
    process.exit(1);
  }
  return JSON.parse(readFileSync(p, { encoding: 'utf-8' })) as T;
}

function main(): void {
  const query = process.argv.slice(2).join(' ').trim();
  if (!query) {
    console.error('Usage: npm run karsac:lookup -- "<query>"');
    process.exit(1);
  }

  const aliases = loadJSON<AliasMap>('aliases.json');
  const entities = loadJSON<EntityMap>('entities.json');

  const key = query.toLowerCase();
  let candidateIds: string[] = aliases[key] ?? [];
  let effectiveQuery = query; // used for scoring; updated when a sub-phrase matches

  if (candidateIds.length === 0) {
    // Substring fallback: collect all ids whose alias contains the query
    const seen = new Set<string>();
    for (const [alias, ids] of Object.entries(aliases)) {
      if (alias.includes(key)) {
        for (const id of ids) {
          if (!seen.has(id)) { seen.add(id); candidateIds.push(id); }
        }
      }
    }

    if (candidateIds.length === 0) {
      // Multi-term fallback: try progressively shorter sub-phrases (longest first).
      // For "displaced mountain predator": tries "displaced mountain", "mountain predator",
      // then "displaced", "mountain", "predator".
      // Scores against the matched sub-phrase so exact-alias scoring fires correctly.
      const words = key.split(/\s+/).filter(w => w.length >= 3);
      if (words.length > 1) {
        outer:
        for (let n = words.length - 1; n >= 1; n--) {
          for (let i = 0; i <= words.length - n; i++) {
            const phrase = words.slice(i, i + n).join(' ');
            const phraseIds = aliases[phrase] ?? [];
            if (phraseIds.length > 0) {
              for (const id of phraseIds) {
                if (!candidateIds.includes(id)) candidateIds.push(id);
              }
              effectiveQuery = phrase; // score against the matched sub-phrase
              break outer;
            }
          }
        }
        // If still nothing, include IDs matching any single word
        if (candidateIds.length === 0) {
          const seenFallback = new Set<string>();
          for (const word of words) {
            for (const id of aliases[word] ?? []) {
              if (!seenFallback.has(id)) { seenFallback.add(id); candidateIds.push(id); }
            }
          }
        }
      }
    }

    if (candidateIds.length === 0) {
      console.log(`No entity found for: "${query}"`);
      process.exit(0);
    }

    const note = effectiveQuery !== query
      ? `No exact match for "${query}". Matched on "${effectiveQuery}". Results:`
      : `No exact alias match for "${query}". Showing results:`;
    console.log(`${note}\n`);
  }

  const ranked = scoreMatches(effectiveQuery, candidateIds, entities);
  const bestMatch = isBestMatch(ranked);

  if (ranked.length === 1) {
    printSingle(ranked[0], bestMatch);
  } else {
    console.log(`${ranked.length} results for "${query}":\n`);
    printRanked(ranked, bestMatch);
  }
}

// ── Display ───────────────────────────────────────────────────────────────────

function printSingle(match: ScoredMatch, best: boolean): void {
  const { entity, score, matchReason } = match;
  if (best) console.log(`★ Best Match\n`);
  console.log(`id:          ${entity.id}`);
  console.log(`title:       ${entity.title}`);
  console.log(`type:        ${entity.type}`);
  console.log(`collection:  ${entity.collection}`);
  console.log(`path:        ${entity.path}`);
  console.log(`score:       ${score}  (${matchReason})`);
  if (entity.summary) console.log(`\nsummary:     ${entity.summary}`);
  if (entity.doNotConfuseWith.length > 0) {
    console.log(`\ndo not confuse with: ${entity.doNotConfuseWith.join(', ')}`);
  }
}

function printRanked(matches: ScoredMatch[], best: boolean): void {
  const scoreW = 4;
  const reasonW = Math.max(...matches.map(m => m.matchReason.length));
  const idW = Math.min(52, Math.max(...matches.map(m => m.entity.id.length)));

  for (let i = 0; i < matches.length; i++) {
    const { entity, score, matchReason } = matches[i];
    const scoreStr = String(score).padStart(scoreW);
    const reasonStr = matchReason.padEnd(reasonW);
    const idStr = entity.id.padEnd(idW);
    const tag = best && i === 0 ? '  ★ best match' : '';
    console.log(`  ${scoreStr}  ${reasonStr}  ${idStr}  ${entity.title}${tag}`);
  }
}

main();
