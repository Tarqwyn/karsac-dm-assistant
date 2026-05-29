import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const PROJECT_ROOT = resolve(__dirname, '..');
export const INDEX_DIR = resolve(PROJECT_ROOT, '.karsac-index');
export const DEBUG_DIR = resolve(INDEX_DIR, 'debug');

function resolveFromProject(defaultRelativePath: string, envValue: string | undefined): string {
  return resolve(PROJECT_ROOT, envValue ?? defaultRelativePath);
}

export const CORPUS_ROOT = resolveFromProject('../corpus', process.env.KARSAC_CORPUS_ROOT);
export const COLLECTIONS_ROOT = resolveFromProject('../corpus/collections', process.env.KARSAC_COLLECTIONS_DIR);
export const RULES_DATA_DIR = resolveFromProject('../corpus/rules-data', process.env.KARSAC_RULES_DATA_DIR);
export const STATE_ROOT = resolveFromProject('../corpus/state', process.env.KARSAC_STATE_DIR);
