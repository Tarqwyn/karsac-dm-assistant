/**
 * Design/encounter guardrail patterns and validation helpers.
 *
 * Extracted into a separate module so tests can import them without
 * triggering ask.ts's CLI main() side-effect.
 */

import { getDesignRequiredHeadings } from './proposals/proposalContractsLoader.js'

// ── Required headings ─────────────────────────────────────────────────────────

export const DESIGN_REQUIRED_HEADINGS: readonly string[] = getDesignRequiredHeadings()

// ── No-monster-data patterns ──────────────────────────────────────────────────

/**
 * Patterns forbidden when no monster corpus is loaded (NO_MONSTER_DATA mode).
 * Each entry: [pattern, label] for diagnostic output.
 */
export const FORBIDDEN_MONSTER_PATTERNS: Array<[RegExp, string]> = [
  // Named SRD monsters
  [/\bstone giant/i, 'Stone Giant'],
  [/\bdire wolf/i, 'Dire Wolf'],
  [/\broper\b/i, 'Roper'],
  [/\b(?:young|adult|ancient|wyrmling)\s+\w+\s+dragon\b/i, 'named dragon'],
  [/\bdragon\s+stats\b/i, 'dragon stats'],
  [/\buse\s+\w+\s+stats\b/i, 'use X stats'],
  [/\breskin(?:ned|ning)?\b/i, 'reskin'],
  // Mechanical stats
  [/\bCR\s+\d/i, 'CR rating'],
  [/\bAC\s+\d{1,2}\b/i, 'AC value'],
  [/[+-]\d+\s*(?:to\s+)?AC\b/i, 'AC modifier'],
  [/(?:reduce|increase|modify|add)\b[^.]*\bHP\b/i, 'HP modification'],
  [/\bdamage\s+resistance\b/i, 'damage resistance'],
  [/\bresistance\s+to\b/i, 'resistance to'],
  [/\bspellcasting\b/i, 'spellcasting'],
  [/\bbreath\s+weapon\b/i, 'breath weapon'],
  [/\bhit\s+dice\b/i, 'hit dice'],
  [/\bboar\s+stats\b/i, 'boar stats'],
];

export const NO_MONSTER_DISCLAIMER =
  'monster metadata is not yet loaded, so these are encounter roles';

// ── Homebrew-gate patterns ────────────────────────────────────────────────────

/**
 * Patterns that indicate homebrew stat modifications — forbidden unless
 * --allow-homebrew is active or the user explicitly requested homebrew.
 * Applied to the full response text even when monster data IS loaded.
 */
export const HOMEBREW_VIOLATION_PATTERNS: Array<[RegExp, string]> = [
  // Reskin indicators
  [/\bbased on\b/i, 'based on (homebrew reskin)'],
  // HP modifications
  [/(?:reduce|lower|decrease|increase|raise|modify|give|add)\b[^.]{0,50}\b(?:hp|hit points?)\b/i, 'HP modification'],
  [/\bextra\s+hit\s+points?\b/i, 'extra hit points'],
  [/\bHP\s+to\s+\d/i, 'HP assignment'],
  // Damage modifications
  [/(?:increase|reduce|boost|lower|raise)\b[^.]{0,30}\b(?:\w+\s+)?damage\b/i, 'damage modification'],
  // AC modifications
  [/(?:reduce|lower|decrease|increase|raise|modify)\b[^.]{0,40}\b(?:ac\b|armou?r class)\b/i, 'AC modification'],
  [/[+-]\d+\s*(?:to\s+)?AC\b/i, 'AC modifier'],
  // Ability score changes
  [/[+-]\d+\s+(?:strength|dexterity|constitution|intelligence|wisdom|charisma|str|dex|con|int|wis|cha)\b/i, 'ability score modifier'],
  // Saving throw invented modifiers
  [/\badvantage\b[^.]{0,40}\b(?:saving throws?|saves?)\b/i, 'invented saving throw advantage'],
  [/\bdisadvantage\b[^.]{0,40}\b(?:saving throws?|saves?)\b/i, 'invented saving throw disadvantage'],
  [/\bsaving\s+throw\s+(?:advantage|disadvantage)\b/i, 'invented saving throw modifier'],
  // Resistance and invented special abilities
  [/\bresistance\s+to\b/i, 'resistance to (invented)'],
  [/\bdamage\s+resistance\b/i, 'damage resistance (invented)'],
  [/\bnew\s+(?:attack|special\s+ability|action|feature)\b/i, 'new attack/ability (invented)'],
];

// ── Checker functions ─────────────────────────────────────────────────────────

// ── Composition-plan validation ───────────────────────────────────────────────

import type { EncounterCompositionPlan } from './composition.js';

/** Extract the text of the ## Creatures / opposition section (lowercased). */
function extractCreaturesSectionLower(text: string): string {
  const match = text.match(/##\s+creatures\s*\/\s*opposition\s*\n([\s\S]*?)(?=\n##\s|\s*$)/i);
  return (match?.[1] ?? '').toLowerCase();
}

/** Attack-action patterns that only a combatant should perform. */
const ATTACK_PATTERNS =
  /\battacks?\b|\bdive.bomb|\bdeals?\s+damage|\bclaws?\s+at\b|\bjoins?\s+the\s+fight|\bswoops?\s+(?:down|at)\b|\bstrikes?\b/i;

/**
 * Check the response text against the composition plan. Detects:
 * 1. Forbidden monster names in the text.
 * 2. "Monster Manual" citation.
 * 3. Missing required local names in ## Creatures / opposition.
 * 4. Count mismatch — plurals when composition says count: 1.
 * 5. Non-combatant creature described as attacking.
 */
export function checkCompositionViolations(
  text: string,
  plan: EncounterCompositionPlan,
): string[] {
  const violations: string[] = [];

  // 1. Forbidden monster names
  for (const forbidden of plan.forbiddenMonsterNames) {
    const escaped = forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\b${escaped}(?:'s|s)?\\b`, 'i');
    if (pattern.test(text)) {
      violations.push(`unallowed monster: "${forbidden}"`);
    }
  }

  // 2. Monster Manual citation
  if (/\bMonster\s+Manual\b/i.test(text)) {
    violations.push('"Monster Manual" citation (use "loaded SRD 5.1 base")');
  }

  const creaturesSection = extractCreaturesSectionLower(text);

  // 3. Required local names must appear in ## Creatures / opposition
  for (const local of plan.allowedLocalNames) {
    if (!creaturesSection.includes(local.localName.toLowerCase())) {
      violations.push(`local name "${local.localName}" missing from ## Creatures / opposition`);
    }
  }

  for (const creature of plan.selectedOpposition) {
    // Collect all names this creature may appear under (canonical + local)
    const localEntry = plan.allowedLocalNames.find(l => l.monsterId === creature.monsterId);
    const names = [creature.monsterName, localEntry?.localName].filter(Boolean) as string[];

    // 4. Count mismatch: composition says count: 1, but text uses plural form or "pack"
    if (creature.count === 1) {
      for (const name of names) {
        const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // "pack of Ogres", "several Ogres", "2 Ogres", "Ogres" (bare plural)
        const pluralPattern = new RegExp(
          `\\bpack\\s+of\\s+${esc}|\\bseveral\\s+${esc}|\\b\\d+\\s+${esc}|\\b${esc}s\\b`, 'i',
        );
        if (pluralPattern.test(text)) {
          violations.push(`count mismatch: composition says 1 × ${creature.monsterName} but text implies multiple`);
          break;
        }
      }
    }

    // 5. Non-combatant attack check: scan sentences in creatures section that name the creature.
    // Strip negated attack phrases first ("does NOT attack", "not attacks", "does not engage")
    // so that the scaffold's own prohibition wording doesn't false-positive.
    if (!creature.useAsCombatant) {
      for (const name of names) {
        const sentences = creaturesSection.split(/[.!?]/);
        for (const sentence of sentences) {
          const stripped = sentence
            .replace(/\b(?:does\s+)?not\s+attacks?\b/gi, '')
            .replace(/\bdoes\s+not\s+engage\b/gi, '')
            .replace(/\bnever\s+attacks?\b/gi, '');
          if (sentence.includes(name.toLowerCase()) && ATTACK_PATTERNS.test(stripped)) {
            violations.push(`non-combatant "${name}" described as attacking in ## Creatures / opposition`);
            break;
          }
        }
      }
    }
  }

  return violations;
}

export function checkNoMonsterViolations(text: string): string[] {
  const violations: string[] = [];
  if (!text.toLowerCase().includes(NO_MONSTER_DISCLAIMER)) {
    violations.push('missing mandatory disclaimer line');
  }
  for (const [pattern, label] of FORBIDDEN_MONSTER_PATTERNS) {
    if (pattern.test(text)) violations.push(label);
  }
  return violations;
}

export function checkHomebrewViolations(text: string): string[] {
  const violations: string[] = [];
  for (const [pattern, label] of HOMEBREW_VIOLATION_PATTERNS) {
    if (pattern.test(text)) violations.push(label);
  }
  return violations;
}

export function validateDesignResponse(
  text: string,
  noMonsterData = false,
  allowHomebrew = false,
  compositionPlan?: EncounterCompositionPlan | null,
): boolean {
  const lower = text.toLowerCase();
  if (!lower.trimStart().startsWith('## provisional encounter concept')) return false;
  if (!DESIGN_REQUIRED_HEADINGS.every(h => lower.includes(h))) return false;
  if (!lower.includes('provisional table material')) return false;
  if (noMonsterData && checkNoMonsterViolations(text).length > 0) return false;
  if (!allowHomebrew && checkHomebrewViolations(text).length > 0) return false;
  if (compositionPlan && checkCompositionViolations(text, compositionPlan).length > 0) return false;
  return true;
}

/**
 * Strip lines containing guardrail violations from a design response.
 * Section headings (## lines) are never removed. If a heading would be
 * followed by no content, a placeholder is inserted.
 */
export function stripViolatingContent(
  text: string,
  allowHomebrew: boolean,
  noMonsterData: boolean,
): { stripped: string; removed: string[] } {
  const removed: string[] = [];
  const lines = text.split('\n');
  const clean: string[] = [];
  let prevWasHeading = false;

  for (const line of lines) {
    const isHeading = /^#{1,6}\s/.test(line);
    if (isHeading) {
      prevWasHeading = true;
      clean.push(line);
      continue;
    }

    const hasNoMonsterViolation =
      noMonsterData && FORBIDDEN_MONSTER_PATTERNS.some(([p]) => p.test(line));
    const hasHomebrewViolation =
      !allowHomebrew && HOMEBREW_VIOLATION_PATTERNS.some(([p]) => p.test(line));

    if (hasNoMonsterViolation || hasHomebrewViolation) {
      removed.push(line.trim());
      if (prevWasHeading) {
        clean.push('  *(content removed — unsupported mechanical modification)*');
      }
    } else {
      prevWasHeading = false;
      clean.push(line);
    }
  }

  return { stripped: clean.join('\n'), removed };
}
