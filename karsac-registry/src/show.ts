import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync } from 'fs';
import type { EntityMap } from './types.js';
import { normalizeRelatedId } from './resolver.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const INDEX_DIR = resolve(PROJECT_ROOT, '.karsac-index');
const COLLECTIONS_ROOT = resolve(PROJECT_ROOT, '..', 'openwebui-runtime-collections');

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
  const args = process.argv.slice(2);
  let relatedDebug = false;
  const filtered: string[] = [];

  for (const arg of args) {
    if (arg === '--related-debug') {
      relatedDebug = true;
    } else {
      filtered.push(arg);
    }
  }

  const id = filtered.join(' ').trim();
  if (!id) {
    console.error('Usage: npm run karsac:show -- "<entity-id>" [--related-debug]');
    console.error('Example: npm run karsac:show -- "npcs/brynja-thorgrimsdotter"');
    process.exit(1);
  }

  const entities = loadJSON<EntityMap>('entities.json');

  let entity = entities[id];
  if (!entity) {
    const lower = id.toLowerCase();
    entity = Object.values(entities).find(e => e.id.toLowerCase() === lower) as typeof entity;
  }
  if (!entity) {
    console.error(`Entity not found: "${id}"`);
    console.error('Run: npm run karsac:lookup -- "<query>" to find the correct id');
    process.exit(1);
  }

  if (relatedDebug) {
    showRelatedDebug(entity, entities);
    return;
  }

  showEntity(entity);
}

function showEntity(entity: { path: string; id: string }): void {
  const relPath = entity.path.replace(/^openwebui-runtime-collections\//, '');
  const absPath = resolve(COLLECTIONS_ROOT, relPath);

  if (!existsSync(absPath)) {
    console.error(`File not found on disk: ${absPath}`);
    console.error(`Entity id: ${entity.id}`);
    process.exit(1);
  }

  const content = readFileSync(absPath, { encoding: 'utf-8' });
  process.stdout.write(content);
}

function showRelatedDebug(
  entity: { id: string; type: string; related: Record<string, string[]> },
  entities: EntityMap,
): void {
  process.stdout.write(`Entity: ${entity.id}\n`);
  process.stdout.write(`Type:   ${entity.type}\n`);

  const related = entity.related;
  const relKeys = Object.keys(related);

  process.stdout.write(`\nRaw related from entity:\n`);
  if (relKeys.length === 0) {
    process.stdout.write(`  (none)\n`);
  } else {
    for (const [rt, slugs] of Object.entries(related)) {
      process.stdout.write(`  ${rt}: [${(slugs as string[]).join(', ')}]\n`);
    }
  }

  process.stdout.write(`\nNormalised related candidates:\n`);
  let any = false;
  for (const [rt, slugs] of Object.entries(related)) {
    for (const slug of slugs as string[]) {
      any = true;
      const fullId = normalizeRelatedId(rt, slug);
      const relEntity = entities[fullId];
      const statusStr = !relEntity
        ? 'missing entity'
        : fullId === entity.id
        ? 'same as source'
        : `exists (${relEntity.type})`;
      process.stdout.write(`  - ${fullId} — ${statusStr}\n`);
    }
  }
  if (!any) process.stdout.write(`  (none)\n`);
}

main();
