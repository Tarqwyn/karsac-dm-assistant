/**
 * Deterministic encounter composition step.
 *
 * Takes monster candidates from the retrieval phase and produces an
 * EncounterCompositionPlan that specifies exactly which monsters may appear in
 * the final answer, their roles, and any allowed regional name mappings.
 *
 * The model never chooses the opposition — it only writes encounter prose
 * within the constraints set here.
 */

import { getCrXpTable, getCharXpThresholds, getXpMultipliers } from './rulesDataLoader.js'
import { getLosweqRegionalCreatureNames, getPhantomMonsters } from './regionalNamesLoader.js'

// ── Types ─────────────────────────────────────────────────────────────────────

export type DifficultyIntent = 'easy' | 'medium' | 'hard' | 'push' | 'unknown';
export type CreatureRole =
  | 'primary-threat'
  | 'support'
  | 'scout'
  | 'hazard-pressure'
  | 'background-presence';
export type MechanicalPolicy = 'srd-only' | 'homebrew-allowed';

/** Minimal view of a candidate needed for composition — avoids circular imports. */
export interface CandidateForComposition {
  key: string;           // e.g. "polar-bear"
  monsterName: string;   // e.g. "Polar Bear"
  monsterId: string;     // e.g. "monsters/srd-2014/polar-bear"
  cr: number;
  roles: string[];       // from monsters.json roles array
}

export interface CompositionCreature {
  monsterId: string;
  monsterName: string;
  cr: number;
  count: number;
  role: CreatureRole;
  useAsCombatant: boolean;
  notes: string;
}

export interface LocalNameMapping {
  localName: string;
  monsterId: string;
  monsterName: string;
  meaning: string;
}

export interface EncounterCompositionPlan {
  partySize: number | null;
  partyLevel: number | null;
  difficultyIntent: DifficultyIntent;
  allowedMonsterIds: string[];
  allowedMonsterNames: string[];
  selectedOpposition: CompositionCreature[];
  /** Candidates retrieved but not included in this composition. */
  notIncludedFromCandidates: string[];
  /** Monster names that must not appear anywhere in the answer. */
  forbiddenMonsterNames: string[];
  allowedLocalNames: LocalNameMapping[];
  mechanicalPolicy: MechanicalPolicy;
  balanceNotes: string[];
}

// ── XP and difficulty data — loaded from corpus/rules-data/dnd5e-rules.yaml ──

function crXp(cr: number): number {
  const table = getCrXpTable()
  return table[String(cr)] ?? table[String(Math.floor(cr))] ?? 10;
}

function xpMultiplier(count: number): number {
  for (const [maxCount, multiplier] of getXpMultipliers()) {
    if (count <= maxCount) return multiplier
  }
  return 3;
}

function xpBudget(partySize: number, partyLevel: number, difficulty: DifficultyIntent): number {
  const thresholds = getCharXpThresholds()
  const thresh = thresholds[Math.min(partyLevel, 8)] ?? thresholds[3];
  const [easy, medium, hard, deadly] = thresh;
  const push = Math.round((hard + deadly) / 2);
  const perChar = { easy, medium, hard, push, unknown: medium }[difficulty] ?? medium;
  return perChar * partySize;
}

// ── Regional name table — loaded from corpus/rules-data/losweg-regional-names.yaml ──

const LOSWEG_REGIONAL_NAMES = getLosweqRegionalCreatureNames()

/** Common "phantom" monsters models tend to invent when no data restricts them. */
const PHANTOM_MONSTERS = getPhantomMonsters()

// ── Helpers ───────────────────────────────────────────────────────────────────

export function detectDifficultyIntent(question: string): DifficultyIntent {
  const lq = question.toLowerCase();
  if (/\bpush(?:es|ing)?\s+(?:them|the\s+party)\b|\bpush(?:ing)?\s+encounter\b/.test(lq)) return 'push';
  if (/\bdeadly\b|\bowerpowering\b|\bkill\s+them\b/.test(lq)) return 'push';
  if (/\bchallenging\b|\bhard\b|\btough\b|\bdifficult\b/.test(lq)) return 'hard';
  if (/\bmedium\b|\bmoderate\b/.test(lq)) return 'medium';
  if (/\beasy\b|\bwarm.?up\b|\bbeginner\b/.test(lq)) return 'easy';
  return 'unknown';
}

function isAerial(key: string, roles: string[]): boolean {
  const aerialKeys = ['eagle', 'vulture', 'hawk', 'bat', 'griffon', 'harpy', 'wyvern', 'roc'];
  return aerialKeys.some(k => key.includes(k)) || roles.includes('aerial-hunter');
}

function requestsLocalNames(question: string): boolean {
  const lq = question.toLowerCase();
  return /\blocal\s+names?\b|\bregional\s+names?\b|\bscandinavian\b|\blosweg\s+names?\b|\bnordic\b|\bnorse\b/
    .test(lq);
}

// ── Main composition function ─────────────────────────────────────────────────

export function buildEncounterCompositionPlan(
  candidates: CandidateForComposition[],
  partySize: number | null,
  partyLevel: number | null,
  question: string,
  allowHomebrew: boolean,
  regionSignals: Set<string>,
): EncounterCompositionPlan {
  const difficulty = detectDifficultyIntent(question);
  const level = partyLevel ?? 3;
  const size = partySize ?? 4;
  const wantsLocalNames = requestsLocalNames(question) || regionSignals.has('losweg');

  // Separate combat-suitable ground creatures from aerial/atmospheric ones.
  // "Too strong" = CR > partyLevel + 2 (borderline-hard boundary).
  const tooStrong = (cr: number) => partyLevel !== null && cr > partyLevel + 2;
  const ground = candidates.filter(c => !isAerial(c.key, c.roles));
  const aerial = candidates.filter(c => isAerial(c.key, c.roles));

  // Primary threat: highest-scored non-aerial creature that isn't wildly over-CR.
  // Prefer direct combatants (CR 0.5–partyLevel+1). If the best ground candidate
  // is too strong, mark it as background-presence and keep looking.
  let primaryCandidate: CandidateForComposition | null = null;
  for (const c of ground) {
    if (!tooStrong(c.cr)) { primaryCandidate = c; break; }
  }
  // Fall back: best aerial as primary if no suitable ground creature exists
  if (!primaryCandidate) {
    for (const c of aerial) {
      if (!tooStrong(c.cr)) { primaryCandidate = c; break; }
    }
  }

  // Secondary/omen: prefer aerial (circling overhead presence), then lower-CR ground
  let secondaryCandidate: CandidateForComposition | null = null;
  for (const c of aerial) {
    if (c !== primaryCandidate) { secondaryCandidate = c; break; }
  }
  if (!secondaryCandidate) {
    for (const c of ground) {
      if (c !== primaryCandidate && c.cr < (primaryCandidate?.cr ?? 99)) {
        secondaryCandidate = c; break;
      }
    }
  }

  // Build opposition list
  const selectedOpposition: CompositionCreature[] = [];
  const selectedKeys = new Set<string>();

  if (primaryCandidate) {
    // Determine count from difficulty / XP budget
    let count = 1;
    const budget = xpBudget(size, level, difficulty === 'unknown' ? 'hard' : difficulty);
    const soloXp = crXp(primaryCandidate.cr) * xpMultiplier(1);
    // Add a second primary if no secondary exists and budget allows
    if (!secondaryCandidate && soloXp < budget * 0.55) count = 2;

    selectedOpposition.push({
      monsterId: primaryCandidate.monsterId,
      monsterName: primaryCandidate.monsterName,
      cr: primaryCandidate.cr,
      count,
      role: 'primary-threat',
      useAsCombatant: true,
      notes: `CR ${primaryCandidate.cr} — primary challenge for level ${level} party`,
    });
    selectedKeys.add(primaryCandidate.key);
  }

  if (secondaryCandidate) {
    const aerialRole = isAerial(secondaryCandidate.key, secondaryCandidate.roles);
    selectedOpposition.push({
      monsterId: secondaryCandidate.monsterId,
      monsterName: secondaryCandidate.monsterName,
      cr: secondaryCandidate.cr,
      count: 1,
      role: aerialRole ? 'scout' : 'support',
      useAsCombatant: false,
      notes: aerialRole
        ? 'circling overhead — omen, atmospheric presence, not a direct combatant'
        : 'secondary pressure — support or hazard role',
    });
    selectedKeys.add(secondaryCandidate.key);
  }

  // Candidates retrieved but not placed in this composition
  const notIncludedFromCandidates = candidates
    .filter(c => !selectedKeys.has(c.key))
    .map(c => c.monsterName);

  // Forbidden list: candidates not in composition + phantom monsters
  const allowedNames = new Set(selectedOpposition.map(c => c.monsterName.toLowerCase()));
  const forbiddenMonsterNames = [
    ...notIncludedFromCandidates,
    ...PHANTOM_MONSTERS.filter(m => !allowedNames.has(m.toLowerCase())),
  ];

  // Allowed monster IDs and names
  const allowedMonsterIds = selectedOpposition.map(c => c.monsterId);
  const allowedMonsterNames = selectedOpposition.map(c => c.monsterName);

  // Regional name mappings
  const allowedLocalNames: LocalNameMapping[] = [];
  if (wantsLocalNames) {
    for (const creature of selectedOpposition) {
      const key = creature.monsterId.replace(/^monsters\/srd-2014\//, '');
      const entry = LOSWEG_REGIONAL_NAMES[key];
      if (entry) {
        allowedLocalNames.push({
          localName: entry.name,
          monsterId: creature.monsterId,
          monsterName: creature.monsterName,
          meaning: entry.meaning,
        });
      }
    }
  }

  // Balance notes
  const balanceNotes: string[] = [];
  if (selectedOpposition.length > 0) {
    const totalRaw = selectedOpposition.reduce((s, c) => s + crXp(c.cr) * c.count, 0);
    const totalCount = selectedOpposition.reduce((s, c) => s + c.count, 0);
    const adjusted = Math.round(totalRaw * xpMultiplier(totalCount));
    const target = xpBudget(size, level, difficulty === 'unknown' ? 'hard' : difficulty);
    balanceNotes.push(`Estimated adjusted XP: ${adjusted}`);
    balanceNotes.push(`Target for "${difficulty}": ${target}`);
  }

  return {
    partySize,
    partyLevel,
    difficultyIntent: difficulty,
    allowedMonsterIds,
    allowedMonsterNames,
    selectedOpposition,
    notIncludedFromCandidates,
    forbiddenMonsterNames,
    allowedLocalNames,
    mechanicalPolicy: allowHomebrew ? 'homebrew-allowed' : 'srd-only',
    balanceNotes,
  };
}

// ── Output formatters ─────────────────────────────────────────────────────────

/**
 * Build the deterministic ## Creatures / opposition section content.
 *
 * This is injected into the system prompt as a locked scaffold. The model is
 * told to reproduce it verbatim so the first response matches the plan without
 * needing repair.
 */
export function buildCreatureScaffold(plan: EncounterCompositionPlan): string {
  const lines: string[] = [];

  for (const c of plan.selectedOpposition) {
    const local = plan.allowedLocalNames.find(l => l.monsterId === c.monsterId);
    const displayName = local ? `**${local.localName}**` : `**${c.monsterName}**`;
    const countStr = c.count === 1 ? '1 ×' : `${c.count} ×`;
    const baseRef = `\`${c.monsterId}\``;
    const localNote = local ? ` — local name for ${baseRef} (${local.meaning})` : ` (${baseRef})`;
    const combatNote = c.useAsCombatant
      ? `role: ${c.role}; direct combatant.`
      : `role: ${c.role}; non-combat presence only — does NOT attack.`;

    lines.push(`- ${displayName}${localNote}; ${countStr} ${c.monsterName}; ${combatNote}`);

    if (!c.useAsCombatant) {
      lines.push(`  - ALLOWED: watches from above, circles the road, alerts allies, makes the party feel exposed.`);
      lines.push(`  - FORBIDDEN: attacks, dive-bombs, deals damage, claws at characters, joins the fight.`);
    }
  }

  return lines.join('\n');
}

/** Debug string for stderr output. */
export function formatCompositionDebug(plan: EncounterCompositionPlan): string {
  const lines: string[] = [
    'Composition plan:',
    `  difficulty: ${plan.difficultyIntent}`,
    `  mechanical policy: ${plan.mechanicalPolicy}`,
    '  allowed opposition:',
  ];
  for (const c of plan.selectedOpposition) {
    const local = plan.allowedLocalNames.find(l => l.monsterId === c.monsterId);
    const localStr = local ? `, local name: ${local.localName}` : '';
    const combatStr = c.useAsCombatant ? '' : ' (non-combatant)';
    lines.push(`    - ${c.count} x ${c.monsterName} as ${c.role}${combatStr}${localStr}`);
  }
  if (plan.notIncludedFromCandidates.length > 0) {
    lines.push('  not included from candidates:');
    for (const n of plan.notIncludedFromCandidates) lines.push(`    - ${n}`);
  }
  const phantoms = PHANTOM_MONSTERS.slice(0, 4).join(', ');
  lines.push(`  forbidden unselected examples: ${phantoms}`);
  for (const note of plan.balanceNotes) lines.push(`  ${note}`);
  return lines.join('\n');
}

/** Prompt block for inclusion in the system prompt (placed before persona). */
export function formatCompositionPromptBlock(plan: EncounterCompositionPlan): string {
  const lines: string[] = [
    '══════════════════════════════════════════════════════════',
    'ALLOWED FINAL OPPOSITION — MANDATORY',
    '══════════════════════════════════════════════════════════',
    '',
    'You must use ONLY the following creatures. Do not add any other creature.',
    '',
    'Allowed opposition:',
  ];

  for (const c of plan.selectedOpposition) {
    const local = plan.allowedLocalNames.find(l => l.monsterId === c.monsterId);
    lines.push(`- ${c.count} × ${c.monsterName} (${c.monsterId})`);
    lines.push(`  Role: ${c.role}${c.useAsCombatant ? '' : ' — non-combat/atmospheric only'}`);
    if (local) lines.push(`  Local name: ${local.localName} — ${local.meaning}`);
    lines.push('');
  }

  if (plan.notIncludedFromCandidates.length > 0) {
    lines.push('Do NOT use these retrieved-but-unselected creatures:');
    for (const n of plan.notIncludedFromCandidates) lines.push(`- ${n}`);
    lines.push('');
  }

  lines.push('Do NOT mention these creatures (even in passing):');
  for (const n of [...new Set(plan.forbiddenMonsterNames)].slice(0, 12)) {
    lines.push(`- ${n}`);
  }
  lines.push('');

  if (plan.allowedLocalNames.length > 0) {
    lines.push('Allowed local/regional names (only these — do not invent others):');
    for (const l of plan.allowedLocalNames) {
      lines.push(`- ${l.localName} → ${l.monsterName}: ${l.meaning}`);
    }
  } else {
    lines.push('No local names are in scope. Do not invent any.');
  }

  lines.push('');
  lines.push('Rules:');
  lines.push('- DO NOT say "reskinned", "based on", "use X stats", or "Monster Manual".');
  lines.push('- DO NOT modify AC, HP, damage, saves, resistances, spellcasting, or attacks.');
  if (plan.mechanicalPolicy === 'srd-only') {
    lines.push('- If citing a mechanic, say "uses the loaded SRD 5.1 <monster> base".');
  }
  lines.push('- ## Scaling options: use creature count, distance, warning, morale, terrain — NOT stat changes.');
  lines.push('');
  lines.push('══════════════════════════════════════════════════════════');
  lines.push('');

  return lines.join('\n');
}
