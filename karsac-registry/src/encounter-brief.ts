/**
 * Encounter Brief Compiler
 *
 * Turns a raw user question into a structured EncounterIntent, then compiles
 * a model-facing EncounterBrief that replaces the raw question in the model
 * prompt. The model writes from the compiled brief — it never sees the raw
 * natural-language request.
 *
 * Principle: The user prompt is evidence. The compiled brief is the instruction.
 */

import type { EncounterCompositionPlan } from './composition.js';
import { buildCreatureScaffold } from './composition.js';
import type { DifficultyIntent } from './composition.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EncounterIntent {
  type: 'encounter';
  location: string | null;
  region: string | null;
  partySize: number | null;
  partyLevel: number | null;
  difficultyIntent: DifficultyIntent;
  encounterPressure: string[];
  tone: string[];
  requestedFeatures: string[];
  allowHomebrew: boolean;
}

export interface EncounterBrief {
  intent: EncounterIntent;
  plan: EncounterCompositionPlan;
  /** Compiled model-facing instruction — replaces the raw question as user message. */
  briefText: string;
}

// ── Intent parsing ────────────────────────────────────────────────────────────

/**
 * Parse a raw user question into a structured EncounterIntent.
 *
 * The intent captures design signals (location, tone, difficulty, features)
 * without forwarding raw creature mentions as model permissions. References
 * to "wolves", "bears", "Scandinavian names", etc. are treated as planner
 * inputs, not model instructions.
 */
export function parseEncounterIntent(
  question: string,
  partyInfo: { size: number | null; level: number | null },
  difficultyIntent: DifficultyIntent,
  regionSignals: Set<string>,
  allowHomebrew: boolean,
): EncounterIntent {
  const lq = question.toLowerCase();

  // Location — extract the specific encounter setting
  let location: string | null = null;
  const roadToMatch = lq.match(/road\s+to\s+([a-zöäüå\s]+?)(?:\.|,|\?|$|\s+i\b|\s+\-)/);
  if (roadToMatch) {
    const placeName = roadToMatch[1].trim();
    // Only capitalize the very first character — diacritics break \b\w patterns
    location = `road to ${placeName.charAt(0).toUpperCase()}${placeName.slice(1)}`;
  } else if (regionSignals.has('losweg')) {
    location = 'road to Lösweg';
  } else if (/\broad\b/.test(lq)) {
    location = 'a road encounter';
  } else if (/\bpath\b|\btrail\b/.test(lq)) {
    location = 'a path encounter';
  }

  // Region
  const region = regionSignals.has('losweg') ? 'Lösweg'
    : regionSignals.has('torweg') ? 'Törweg'
    : regionSignals.has('stormwatch-mountains') ? 'the Stormwatch Mountains'
    : regionSignals.has('the-maw') ? 'the Maw'
    : null;

  // Encounter pressure tags — describe the design intent, not specific creatures
  const encounterPressure: string[] = [];
  if (/\broad\b|\bpath\b|\btrail\b|\btravel\b/.test(lq)) encounterPressure.push('travel');
  if (/\bmountain|highland|peak|ridge/.test(lq)) encounterPressure.push('mountain-origin');
  if (/\bdisturb|displaced|driven|forced|push/.test(lq)) encounterPressure.push('creature-displacement');
  if (/coast|coastal|shore|sea/.test(lq)) encounterPressure.push('coast-bound');
  if (/ambush|surprise|stealth/.test(lq)) encounterPressure.push('ambush-potential');

  // Tone — aesthetic signals for the writing, not monster permissions
  const tone: string[] = [];
  if (/cold|ice|winter|frost|snow/.test(lq)) tone.push('cold');
  if (/damp|rain|wet|grey|gray|fog|mist/.test(lq)) tone.push('damp');
  if (/scandinavian|nordic|norse|viking/.test(lq)) tone.push('Scandinavian-influenced');
  if (regionSignals.has('losweg')) tone.push('regional Lösweg');
  if (/grounded|practical|weather.shaped/.test(lq)) tone.push('grounded');
  if (!tone.length) tone.push('grounded', 'weather-shaped');

  // Requested features — design signals, NOT model permissions
  const requestedFeatures: string[] = [];
  if (/local\s+name|regional\s+name|scandinavian|nordic|norse|losweg\s+name/.test(lq)) {
    requestedFeatures.push('local creature names');
  }
  if (/displaced|disturb|forced|push/.test(lq)) {
    requestedFeatures.push('displaced mountain creatures');
  }
  if (/hard|push|challeng|tough/.test(lq)) {
    requestedFeatures.push('challenging difficulty');
  }

  return {
    type: 'encounter',
    location,
    region,
    partySize: partyInfo.size,
    partyLevel: partyInfo.level,
    difficultyIntent,
    encounterPressure,
    tone,
    requestedFeatures,
    allowHomebrew,
  };
}

// ── Brief compiler ────────────────────────────────────────────────────────────

/**
 * Compile a structured encounter brief from intent + composition plan.
 *
 * This replaces the raw user question as the model's user-role message.
 * The model receives a clean instruction set — no free-text creature hints.
 */
export function compileEncounterBrief(
  intent: EncounterIntent,
  plan: EncounterCompositionPlan,
): EncounterBrief {
  const b: string[] = [];

  b.push('ENCOUNTER BRIEF');
  b.push('');
  b.push('Task:');
  b.push('Write a provisional Karsac encounter for the DM using the sections below.');
  b.push('');

  b.push('Intent:');
  if (intent.location) {
    b.push(`- The party is travelling on the ${intent.location}.`);
  }
  if (intent.encounterPressure.length > 0) {
    b.push(`- Encounter pressure: ${intent.encounterPressure.join(', ')}.`);
  }
  if (intent.tone.length > 0) {
    b.push(`- Tone: ${intent.tone.join(', ')}.`);
  }
  if (intent.partySize !== null && intent.partyLevel !== null) {
    b.push(`- The party is ${intent.partySize} level ${intent.partyLevel} characters.`);
  } else if (intent.partyLevel !== null) {
    b.push(`- Party level: ${intent.partyLevel}.`);
  }
  b.push(`- Difficulty intent: ${plan.difficultyIntent}; not a boss fight.`);

  b.push('');
  b.push('Allowed final opposition:');
  for (const c of plan.selectedOpposition) {
    const local = plan.allowedLocalNames.find(l => l.monsterId === c.monsterId);
    const name = local ? local.localName : c.monsterName;
    const localNote = local ? ` — local ${intent.region ?? 'regional'} name for ${c.monsterName}` : '';
    const combatNote = c.useAsCombatant
      ? 'primary threat; direct combatant'
      : `${c.role}; non-combat presence only`;
    b.push(`- ${name}${localNote}; ${c.count} × loaded SRD 5.1 ${c.monsterName} base; ${combatNote}.`);
    if (!c.useAsCombatant) {
      b.push(`  ${name} does NOT attack. It may watch, circle, warn, unsettle or draw the party's attention.`);
    }
  }

  b.push('');
  b.push('Locked rules:');
  b.push('- Do not add any other monsters, creatures, spirits, constructs, or named entities.');

  // Name the top phantom monsters explicitly so the model cannot plead ignorance
  const phantoms = [...new Set(plan.forbiddenMonsterNames)].slice(0, 8);
  if (phantoms.length > 0) {
    b.push(`- Specifically forbidden (do not mention even in passing): ${phantoms.join(', ')}.`);
  }

  b.push('- Do not use "reskinned", "based on", or "Monster Manual".');
  b.push('- To explain mechanics, say "uses the loaded SRD 5.1 <monster> base".');
  b.push('- Do not alter HP, AC, damage, ability scores, resistances, attacks, spellcasting, or saving throws.');
  b.push('- ## Scaling options: use positioning, warning, morale, terrain pressure or objectives — NOT stat changes.');
  b.push('- All output is provisional table material, not canon.');

  b.push('');
  b.push('You may write:');
  b.push('  atmosphere, encounter setup, terrain pressure, revelations, running guidance, player-safe description.');
  b.push('');
  b.push('You may not write:');
  b.push('  a different creature list, new monster names, new mechanics, stat changes, or invented canon facts.');

  return {
    intent,
    plan,
    briefText: b.join('\n'),
  };
}

// ── Deterministic fallback ────────────────────────────────────────────────────

/**
 * Render a valid encounter response deterministically — no model call needed.
 * Used when repair fails: correct beats colourful.
 */
export function renderDeterministicFallback(
  intent: EncounterIntent,
  plan: EncounterCompositionPlan,
): string {
  const primary = plan.selectedOpposition.find(c => c.useAsCombatant);
  const scout = plan.selectedOpposition.find(c => !c.useAsCombatant);
  const primaryLocal = plan.allowedLocalNames.find(l => l.monsterId === primary?.monsterId);
  const scoutLocal = plan.allowedLocalNames.find(l => l.monsterId === scout?.monsterId);

  const primaryName = primaryLocal?.localName ?? primary?.monsterName ?? 'a mountain creature';
  const scoutName = scoutLocal?.localName ?? scout?.monsterName ?? null;
  const location = intent.location ?? 'the road';
  const region = intent.region ?? 'the region';

  let concept = `A displaced mountain threat blocks ${location}.`;
  if (primary) {
    concept += ` ${primaryName} (using the loaded SRD 5.1 ${primary.monsterName} base) has been forced lower after disturbances in the high ground — drawn toward ${region} by hunger and territorial pressure.`;
  }
  if (scout) {
    concept += ` ${scoutName ?? 'A second creature'} (using the loaded SRD 5.1 ${scout.monsterName} base) circles overhead as a scout and atmospheric presence — it does not engage in combat.`;
  }

  const karsacFit = intent.region
    ? `Displaced mountain creatures appearing on ${location} is consistent with the ecological pressures documented in Karsac. The encounter reflects territorial disruption without introducing new canon.`
    : `This encounter reflects displaced mountain pressure and fits the Karsac setting without introducing new canon.`;

  const scoutNote = scoutName
    ? ` ${scoutName} circles overhead but does not attack.`
    : '';

  const scaffold = buildCreatureScaffold(plan);

  const scaling = primary
    ? `To soften: start ${primaryName} further away or give the party a Perception check warning. To harden: ${primaryName} is already on the road when the party rounds a bend.`
    : 'Adjust encounter difficulty by changing starting distance and whether the party gets advance warning.';

  const playerDesc = primary
    ? `The road ahead narrows. Something large and heavy-footed occupies the path.${scoutNote} The sky above is not empty.`
    : 'The road narrows and the party senses they are not alone.';

  return `## Provisional encounter concept
${concept}

## Why it fits Karsac
${karsacFit}

## Encounter setup
${location.charAt(0).toUpperCase() + location.slice(1)}. The track narrows where a hillside has shed loose stone. Overcast sky. Poor visibility beyond 60 ft.

## Creatures / opposition
${scaffold}

## Terrain and pressure
Narrow road with steep embankments. Rockfall debris limits movement options. Weather limits visibility. The party's flank is exposed if they try to go around.

## What this reveals
Disruption in the high ground has pushed these creatures down from their territory. The encounter is a symptom, not the cause.

## Running it at the table
Allow a DC 13 Perception or Survival check before initiative. On a success, the party hears or smells the threat first. Keep the encounter short: 3–4 rounds maximum before the ${primaryName} either flees or is driven off.

## Scaling options
${scaling}

## Player-safe description
${playerDesc}

## Canon status
Provisional table material — not canon until accepted.`;
}

// ── Debug formatter ───────────────────────────────────────────────────────────

export function formatEncounterBriefDebug(brief: EncounterBrief): string {
  const { intent, plan } = brief;
  const lines = [
    'Compiled encounter brief:',
    `  intent: ${intent.encounterPressure.join(', ') || 'general encounter'}${intent.location ? ' on ' + intent.location : ''}`,
    `  party: ${intent.partySize ?? '?'} level ${intent.partyLevel ?? '?'} characters`,
    `  tone: ${intent.tone.join(', ') || 'grounded'}`,
    '  allowed opposition:',
  ];
  for (const c of plan.selectedOpposition) {
    const local = plan.allowedLocalNames.find(l => l.monsterId === c.monsterId);
    const localStr = local ? ` / ${local.localName}` : '';
    lines.push(`    - ${c.monsterName}${localStr} (${c.role})`);
  }
  lines.push('  raw user question passed to model:');
  lines.push('    no');
  return lines.join('\n');
}
