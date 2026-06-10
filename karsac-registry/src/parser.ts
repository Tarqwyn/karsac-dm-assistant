import matter from 'gray-matter';
import { readFileSync } from 'fs';
import type { Entity, Section } from './types.js';

const STOP_WORDS = new Set(['a', 'an', 'the', 'of', 'in', 'at', 'and', 'or', 'to']);

export function parseFile(absolutePath: string, collectionsRoot: string): Entity | null {
  const raw = readFileSync(absolutePath, { encoding: 'utf-8' });
  // Strip leading HTML comments (<!-- ... -->) so gray-matter can find the frontmatter
  const stripped = raw.replace(/^(\s*<!--[\s\S]*?-->\s*)+/, '')
  const { data: fm, content } = matter(stripped);

  if (!fm.id) return null;

  const title = extractH1(content) ?? String(fm.id);
  const collection = extractCollection(absolutePath);
  const relativePath = absolutePath.startsWith(collectionsRoot + '/')
    ? 'openwebui-runtime-collections/' + absolutePath.slice(collectionsRoot.length + 1)
    : absolutePath;

  const retrievalSummary = extractBodyField(content, 'Retrieval Summary') ?? undefined;
  const canonFileId = extractBodyFieldCode(content, 'Canon File ID') ?? undefined;
  const entityCardId = extractBodyFieldCode(content, 'Entity Card ID') ?? undefined;
  const primaryDetailFile =
    extractBodyFieldCode(content, 'Primary Detail File') ??
    (typeof fm.related?.primary_detail_file === 'string' ? fm.related.primary_detail_file : undefined);
  const doNotConfuseWith = extractDoNotConfuseWith(content);

  const rawTags: string[] = Array.isArray(fm.tags) ? fm.tags.map(String) : [];

  // ── Monster-specific alias enrichment ──────────────────────────────────────
  // Extracts encounter roles, terrain, and displacement signals so monster
  // files can be found via queries like "pack predator", "predator", "displaced",
  // "mountain predator", etc.
  const monsterExtraAliases: string[] = [];
  if (fm.type === 'monster') {
    const roles: string[] = Array.isArray(fm.encounter_roles)
      ? fm.encounter_roles.map(String)
      : Array.isArray(fm.combat_role) ? fm.combat_role.map(String) : [];
    for (const role of roles) {
      if (!rawTags.includes(role)) rawTags.push(role);
      const dehyphen = role.replace(/-/g, ' ');
      if (dehyphen !== role) monsterExtraAliases.push(dehyphen);
    }
    if (roles.some(r => r.includes('predator')) && !rawTags.includes('predator')) {
      rawTags.push('predator');
    }
    // terrain values → tags + compound "X predator" aliases
    const terrain: string[] = Array.isArray(fm.terrain) ? fm.terrain.map(String) : [];
    for (const t of terrain) {
      if (!rawTags.includes(t)) rawTags.push(t);
      if (roles.some(r => r.includes('predator'))) {
        monsterExtraAliases.push(`${t} predator`);
      }
    }
    // displacement → "displaced" tag
    if (fm.displacement && !rawTags.includes('displaced')) {
      rawTags.push('displaced');
    }
    // plural of name (simple: append 's' or 'es')
    const plural = makeMonsterPlural(title);
    if (plural && plural.toLowerCase() !== title.toLowerCase()) {
      monsterExtraAliases.push(plural.toLowerCase());
    }
  }

  const aliases = buildAliases(String(fm.id), title, rawTags);
  for (const ea of monsterExtraAliases) {
    if (!aliases.includes(ea)) aliases.push(ea);
  }
  const related = normalizeRelated(fm.related);

  return {
    id: String(fm.id),
    type: fm.type ? String(fm.type) : 'unknown',
    ruleset: fm.ruleset ? String(fm.ruleset) : undefined,
    entityType: fm.entity_type ? String(fm.entity_type) : undefined,
    entityId: fm.entity_id ? String(fm.entity_id) : undefined,
    title,
    path: relativePath,
    collection,
    visibility: fm.visibility ? String(fm.visibility) : undefined,
    canonical: fm.canonical ? String(fm.canonical) : undefined,
    summary: fm.summary ? String(fm.summary) : undefined,
    retrievalSummary,
    canonFileId,
    entityCardId,
    primaryDetailFile,
    tags: rawTags,
    aliases,
    related,
    doNotConfuseWith,
    lastUpdated: fm.last_updated ? toDateString(fm.last_updated) : undefined,
  };
}

export function extractSections(absolutePath: string): Section[] {
  const raw = readFileSync(absolutePath, { encoding: 'utf-8' });
  const { content } = matter(raw);
  const sections: Section[] = [];
  for (const line of content.split('\n')) {
    const match = line.match(/^(#{2,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const heading = match[2].trim();
      const anchor = heading
        .toLowerCase()
        .replace(/[^a-z0-9À-ɏ\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');
      sections.push({ level, heading, anchor });
    }
  }
  return sections;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function extractH1(content: string): string | null {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

function extractCollection(filePath: string): string {
  const segments = filePath.split('/');
  for (const seg of segments) {
    if (seg.startsWith('karsac-')) return seg;
  }
  return 'unknown';
}

function extractBodyField(content: string, field: string): string | null {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Match **Field:** value — stop at blank line or next bold field
  const re = new RegExp(`\\*\\*${escaped}:\\*\\*\\s*(.+?)(?=\\n\\n|\\n\\*\\*|\\n##|$)`, 's');
  const match = content.match(re);
  if (!match) return null;
  return match[1].trim();
}

function extractBodyFieldCode(content: string, field: string): string | null {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\*\\*${escaped}:\\*\\*\\s*\`([^\`]+)\``);
  const match = content.match(re);
  return match ? match[1].trim() : null;
}

function extractDoNotConfuseWith(content: string): string[] {
  const raw = extractBodyField(content, 'Do Not Confuse With');
  if (!raw) return [];
  return splitAtTopLevelCommas(raw)
    .map(s => s.replace(/^or\s+/i, '').replace(/\.$/, '').trim())
    .filter(s => s.length > 0);
}

function splitAtTopLevelCommas(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') depth--;
    else if (text[i] === ',' && depth === 0) {
      const name = extractNameOnly(text.slice(start, i));
      if (name) parts.push(name);
      start = i + 1;
    }
  }
  const last = extractNameOnly(text.slice(start));
  if (last) parts.push(last);
  return parts;
}

function extractNameOnly(s: string): string {
  // Take text before the first '(' and strip markdown/punctuation
  return s
    .split('(')[0]
    .replace(/[*_`]/g, '')
    .replace(/\.$/, '')
    .trim();
}

function buildAliases(id: string, title: string, tags: string[]): string[] {
  const seen = new Set<string>();
  const add = (s: string) => { if (s.trim()) seen.add(s.trim()); };

  add(id);
  add(title);
  add(title.toLowerCase());
  add(toKebab(title));

  const words = title.split(/\s+/);
  if (words.length > 1) {
    const first = words[0];
    if (!STOP_WORDS.has(first.toLowerCase())) {
      add(first);
      add(first.toLowerCase());
    }
    // "The X Y" → also add "X Y" and "x y" and "x-y"
    if (first.toLowerCase() === 'the') {
      const withoutThe = words.slice(1).join(' ');
      add(withoutThe);
      add(withoutThe.toLowerCase());
      add(toKebab(withoutThe));
    }
  }

  for (const tag of tags) {
    add(tag);
  }

  return [...seen];
}

function makeMonsterPlural(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('wolf')) return name.slice(0, -4) + 'wolves';
  if (lower.endsWith('s') || lower.endsWith('x') || lower.endsWith('z')) return name + 'es';
  if (lower.endsWith('man')) return name.slice(0, -3) + 'men';
  if (lower.endsWith('elf')) return name.slice(0, -3) + 'elves';
  return name + 's';
}

function toKebab(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9À-ɏ\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function toDateString(val: unknown): string {
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val);
}

function normalizeRelated(related: unknown): Record<string, string[]> {
  if (!related || typeof related !== 'object' || Array.isArray(related)) return {};
  const result: Record<string, string[]> = {};
  for (const [key, val] of Object.entries(related as Record<string, unknown>)) {
    if (key === 'primary_detail_file') continue;
    if (typeof val === 'string') {
      result[key] = [val];
    } else if (Array.isArray(val)) {
      result[key] = val.filter((v): v is string => typeof v === 'string');
    }
  }
  return result;
}
