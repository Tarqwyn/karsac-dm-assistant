import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const PROJECT_ROOT = resolve(__dirname, '..');

function resolveFromProject(defaultRelativePath: string, envValue: string | undefined): string {
  return resolve(PROJECT_ROOT, envValue ?? defaultRelativePath);
}

// Index output dir. Overridable so promotion/index tests can isolate from the
// real .karsac-index instead of clobbering it.
export const INDEX_DIR = resolveFromProject('.karsac-index', process.env.KARSAC_INDEX_DIR);
export const DEBUG_DIR = resolve(INDEX_DIR, 'debug');

export const CORPUS_ROOT = resolveFromProject('../corpus', process.env.KARSAC_CORPUS_ROOT);
export const REGISTRY_ROOT = resolveFromProject('../corpus/registry', process.env.KARSAC_REGISTRY_ROOT);
export const COLLECTIONS_ROOT = resolveFromProject('../corpus/collections', process.env.KARSAC_COLLECTIONS_DIR);
export const RULES_DATA_DIR = resolveFromProject('../corpus/rules-data', process.env.KARSAC_RULES_DATA_DIR);
export const STATE_ROOT = resolveFromProject('../corpus/state', process.env.KARSAC_STATE_DIR);
export const ADVERSARY_CORPUS_ROOT = resolveFromProject('../corpus/adversary-corpus/karsac-adversaries', process.env.KARSAC_ADVERSARY_DIR);
export const ENCOUNTER_PATTERNS_ROOT = resolveFromProject('../corpus/encounter-patterns/non-monster', process.env.KARSAC_PATTERNS_DIR);
export const PROPOSALS_ROOT = resolveFromProject('../corpus/proposals', process.env.KARSAC_PROPOSALS_DIR);
export const PLANNING_ROOT = resolveFromProject('../corpus/planning', process.env.KARSAC_PLANNING_DIR);
