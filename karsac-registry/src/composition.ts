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

// ── XP and difficulty data ────────────────────────────────────────────────────

const CR_XP: Readonly<Record<string, number>> = {
  '0': 10, '0.125': 25, '0.25': 50, '0.5': 100,
  '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800,
  '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900,
};

// Per-character XP thresholds: [easy, medium, hard, deadly]
const CHAR_THRESHOLDS: Readonly<Record<number, [number, number, number, number]>> = {
  1: [25, 50, 75, 100], 2: [50, 100, 150, 200], 3: [75, 150, 225, 400],
  4: [125, 250, 375, 500], 5: [250, 500, 750, 1100], 6: [300, 600, 900, 1400],
  7: [350, 750, 1100, 1700], 8: [450, 900, 1400, 2100],
};

function crXp(cr: number): number {
  return CR_XP[String(cr)] ?? CR_XP[String(Math.floor(cr))] ?? 10;
}

function xpMultiplier(count: number): number {
  if (count <= 1) return 1;
  if (count === 2) return 1.5;
  if (count <= 6) return 2;
  if (count <= 10) return 2.5;
  return 3;
}

function xpBudget(partySize: number, partyLevel: number, difficulty: DifficultyIntent): number {
  const thresh = CHAR_THRESHOLDS[Math.min(partyLevel, 8)] ?? CHAR_THRESHOLDS[3];
  const [easy, medium, hard, deadly] = thresh;
  const push = Math.round((hard + deadly) / 2);
  const perChar = { easy, medium, hard, push, unknown: medium }[difficulty] ?? medium;
  return perChar * partySize;
}

// ── Regional name table ───────────────────────────────────────────────────────

const LOSWEG_REGIONAL_NAMES: Readonly<Record<string, { name: string; meaning: string }>> = {
  'wolf':          { name: 'Vargr',               meaning: 'common mountain wolf' },
  'dire-wolf':     { name: 'Fjallvarg',            meaning: 'great mountain wolf' },
  'polar-bear':    { name: 'Isbjørn',              meaning: 'ice bear, a large coastal predator' },
  'brown-bear':    { name: 'Fjell-Bjørn',          meaning: 'mountain bear' },
  'black-bear':    { name: 'Skogs-Bjørn',          meaning: 'forest bear' },
  'giant-eagle':   { name: 'Fjell-Ørn',            meaning: 'mountain eagle' },
  'giant-vulture': { name: 'Skarvgrip',            meaning: 'cliff-grip, scavenger following displaced animals' },
  'giant-bat':     { name: 'Skumringsflaggermus', meaning: 'twilight bat of coastal caves' },
  'blood-hawk':    { name: 'Blodhøk',              meaning: 'blood-hawk, aggressive cliff raptor' },
  'griffon':       { name: 'Klippøgle',            meaning: 'cliff beast, mythic mountain hunter' },
  'harpy':         { name: 'Strandvætte',          meaning: 'shore-spirit, coastal lure-creature' },
  'ogre':          { name: 'Jötunn',               meaning: 'displaced mountain giant-kin' },
  'ettin':         { name: 'Tvihøved',             meaning: 'two-headed mountain-kin, rarely near coasts' },
  'troll':         { name: 'Bergtroll',            meaning: 'mountain troll, hard to kill' },
  'worg':          { name: 'Nidvarg',              meaning: 'ill-wolf, large malicious predator' },
  'wyvern':        { name: 'Orm',                  meaning: 'the great serpent, seen only at distance' },
  'manticore':     { name: 'Mennekselion',         meaning: 'man-lion, a mountain terror' },
  'owlbear':       { name: 'Uglebjørn',            meaning: 'owl-bear, displaced from deep forest' },
};

/** Common "phantom" monsters models tend to invent when no data restricts them. */
const PHANTOM_MONSTERS = [
  'Dire Wolf', 'Dire Wolves', 'Goblin', 'Goblins',
  'Orc', 'Orcs', 'Bandit', 'Hobgoblin', 'Kobold',
  'Skeleton', 'Zombie', 'Gnoll', 'Cultist',
];

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
