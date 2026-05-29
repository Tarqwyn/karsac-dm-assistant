import { resolve, dirname, relative } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, writeFileSync } from 'fs';
import fg from 'fast-glob';
import { parseFile, extractSections } from './parser.js';
import type { EntityMap, AliasMap, RelationshipMap, SectionMap } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const COLLECTIONS_ROOT = resolve(PROJECT_ROOT, '..', 'openwebui-runtime-collections');
const INDEX_DIR = resolve(PROJECT_ROOT, '.karsac-index');

async function buildIndex(): Promise<void> {
  console.log(`Scanning: ${COLLECTIONS_ROOT}`);

  const files = await fg('**/*.md', {
    cwd: COLLECTIONS_ROOT,
    absolute: true,
    dot: false,
  });

  console.log(`Found ${files.length} Markdown files`);

  const entities: EntityMap = {};
  const aliases: AliasMap = {};
  const relationships: RelationshipMap = {};
  const sections: SectionMap = {};

  let parsed = 0;
  let skipped = 0;

  for (const filePath of files.sort()) {
    const entity = parseFile(filePath, COLLECTIONS_ROOT);
    if (!entity) {
      skipped++;
      continue;
    }

    const existing = entities[entity.id];
    if (existing) {
      // Keep the more detailed file (entity cards are secondary; prefer canon files)
      if (entity.type === 'entity-card' && existing.type !== 'entity-card') {
        skipped++;
        continue;
      }
    }

    entities[entity.id] = entity;

    // Register all aliases → entity id
    for (const alias of entity.aliases) {
      const key = alias.toLowerCase();
      if (!aliases[key]) aliases[key] = [];
      if (!aliases[key].includes(entity.id)) {
        aliases[key].push(entity.id);
      }
    }

    // Relationships
    if (Object.keys(entity.related).length > 0) {
      relationships[entity.id] = entity.related;
    }

    // Sections
    const fileSections = extractSections(filePath);
    if (fileSections.length > 0) {
      sections[entity.id] = fileSections;
    }

    parsed++;
  }

  mkdirSync(INDEX_DIR, { recursive: true });

  const write = (name: string, data: unknown) => {
    const outPath = resolve(INDEX_DIR, name);
    writeFileSync(outPath, JSON.stringify(data, null, 2), { encoding: 'utf-8' });
    console.log(`  wrote ${name} (${Object.keys(data as object).length} entries)`);
  };

  write('entities.json', entities);
  write('aliases.json', aliases);
  write('relationships.json', relationships);
  write('sections.json', sections);

  writeReport(entities, aliases, relationships, sections, parsed, skipped);

  console.log(`\nDone. ${parsed} entities indexed, ${skipped} files skipped.`);
  console.log(`Index written to: ${INDEX_DIR}`);
}

function writeReport(
  entities: EntityMap,
  aliases: AliasMap,
  relationships: RelationshipMap,
  sections: SectionMap,
  parsed: number,
  skipped: number,
): void {
  const byCollection: Record<string, number> = {};
  const byType: Record<string, number> = {};

  for (const e of Object.values(entities)) {
    byCollection[e.collection] = (byCollection[e.collection] ?? 0) + 1;
    byType[e.type] = (byType[e.type] ?? 0) + 1;
  }

  const collectionRows = Object.entries(byCollection)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([col, n]) => `| \`${col}\` | ${n} |`)
    .join('\n');

  const typeRows = Object.entries(byType)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([t, n]) => `| \`${t}\` | ${n} |`)
    .join('\n');

  const aliasCount = Object.keys(aliases).length;
  const relationshipCount = Object.keys(relationships).length;
  const sectionCount = Object.values(sections).reduce((n, s) => n + s.length, 0);

  const now = new Date().toISOString().slice(0, 10);

  const report = `# Karsac Index Report

**Generated:** ${now}
**Entities indexed:** ${parsed}
**Files skipped:** ${skipped}
**Aliases registered:** ${aliasCount}
**Entities with relationships:** ${relationshipCount}
**Total sections indexed:** ${sectionCount}

## Entities by Collection

| Collection | Count |
|---|---|
${collectionRows}

## Entities by Type

| Type | Count |
|---|---|
${typeRows}

## Index Files

| File | Description |
|---|---|
| \`entities.json\` | Full entity objects keyed by id |
| \`aliases.json\` | Lowercase alias → entity id[] lookup |
| \`relationships.json\` | Entity id → related map |
| \`sections.json\` | Entity id → section heading list |
`;

  const outPath = resolve(INDEX_DIR, 'index-report.md');
  writeFileSync(outPath, report, { encoding: 'utf-8' });
  console.log(`  wrote index-report.md`);
}

buildIndex().catch(err => {
  console.error(err);
  process.exit(1);
});
