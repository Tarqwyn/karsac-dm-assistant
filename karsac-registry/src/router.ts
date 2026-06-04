export type Profile = 'canon' | 'prose' | 'deep-lore' | 'rules' | 'design' | 'state' | 'encounter-design' | 'adversary-design';

import {
  getRulesTerms, getDesignTerms, getDeepLoreTerms,
  getStrongProseTerms, getWeakProseTerms, getStateTerms,
  getAdversaryDesignTerms, getEncounterDesignTerms, getCanonTerms,
  getExplicitEncounterScenePattern,
} from './routerConfigLoader.js'

export interface RouteResult {
  profile: Profile;
  reason: string;
  matchedTerms: string[];
  modeOverride?: 'player' | 'dm';
}

// ── Matching helpers ──────────────────────────────────────────────────────────

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Test whether the lowercased question contains the given term.
 * Uses \b word-boundary anchors so "save" does not match "savage".
 * Appends `s?` so entries handle common plurals automatically
 * (saving throw/throws, condition/conditions, rule/rules, etc.).
 */
function hasTerm(lq: string, term: string): boolean {
  const escaped = escapeRegExp(term);
  return new RegExp(`\\b${escaped}s?\\b`, 'i').test(lq);
}

function findMatchedTerms(lq: string, terms: readonly string[]): string[] {
  return terms.filter(t => hasTerm(lq, t));
}

// ── Router ────────────────────────────────────────────────────────────────────

/**
 * Deterministically choose a profile for the given question.
 *
 * Routing order (first match wins):
 *   1. player-facing guard   → prose  (mode=player)
 *   2. strong prose terms    → prose  (write/boxed text/dialogue — beats design)
 *   3. rules terms           → rules
 *   3.25 adversary-design    → adversary-design  (create/adapt a stat block — outranks encounter-design unless scene intent is explicit)
 *   3.5 encounter-design     → encounter-design  (social/non-monster encounter scene)
 *   4. design terms          → design
 *   4.5 state terms          → state  (table-progress, player knowledge, threads)
 *   5. deep-lore terms       → deep-lore
 *   6. weak prose terms      → prose  (describe/scene/narration)
 *   7. canon terms           → canon
 *   8. default               → canon
 *
 * Does not call Ollama. Does not perform entity lookup.
 */
export function routeQuestion(question: string): RouteResult {
  const lq = question.toLowerCase().replace(/\s+/g, ' ').trim();

  // Step 1: player-facing guard (overrides Vishara/design/any other signal)
  if (hasTerm(lq, 'player-facing') || lq.includes('player facing')) {
    return {
      profile: 'prose',
      reason: 'player-facing guard',
      matchedTerms: ['player-facing'],
      modeOverride: 'player',
    };
  }

  // Step 2: strong prose terms (write, boxed text, dialogue, what would — beats design)
  const strongProseMatched = findMatchedTerms(lq, getStrongProseTerms());
  if (strongProseMatched.length > 0) {
    return {
      profile: 'prose',
      reason: `matched prose terms: ${strongProseMatched.slice(0, 3).join(', ')}`,
      matchedTerms: strongProseMatched,
    };
  }

  // Step 3: rules terms
  const rulesMatched = findMatchedTerms(lq, getRulesTerms());
  if (rulesMatched.length > 0) {
    return {
      profile: 'rules',
      reason: `matched rules terms: ${rulesMatched.slice(0, 3).join(', ')}`,
      matchedTerms: rulesMatched,
    };
  }

  // Step 3.25: adversary-design terms — create/adapt a stat block (BEFORE encounter-design)
  // Exception: explicit encounter/scene intent wins over adversary intent.
  const EXPLICIT_ENCOUNTER_SCENE = getExplicitEncounterScenePattern()
  const adversaryDesignMatched = findMatchedTerms(lq, getAdversaryDesignTerms());
  if (adversaryDesignMatched.length > 0 && !EXPLICIT_ENCOUNTER_SCENE.test(lq)) {
    return {
      profile: 'adversary-design',
      reason: `matched adversary-design terms: ${adversaryDesignMatched.slice(0, 3).join(', ')}`,
      matchedTerms: adversaryDesignMatched,
    };
  }

  // Step 3.5: encounter-design terms — social/non-monster encounter scene design
  const encounterDesignMatched = findMatchedTerms(lq, getEncounterDesignTerms());
  if (encounterDesignMatched.length > 0) {
    return {
      profile: 'encounter-design',
      reason: `matched encounter-design terms: ${encounterDesignMatched.slice(0, 3).join(', ')}`,
      matchedTerms: encounterDesignMatched,
    };
  }

  // Step 4: design terms
  const designMatched = findMatchedTerms(lq, getDesignTerms());
  if (designMatched.length > 0) {
    return {
      profile: 'design',
      reason: `matched design terms: ${designMatched.slice(0, 3).join(', ')}`,
      matchedTerms: designMatched,
    };
  }

  // Step 4.5: state terms — table-progress questions (after design, before deep-lore)
  const stateMatched = findMatchedTerms(lq, getStateTerms());
  if (stateMatched.length > 0) {
    return {
      profile: 'state',
      reason: `matched state terms: ${stateMatched.slice(0, 3).join(', ')}`,
      matchedTerms: stateMatched,
    };
  }

  // Step 5: deep-lore terms
  const deepLoreMatched = findMatchedTerms(lq, getDeepLoreTerms());
  if (deepLoreMatched.length > 0) {
    return {
      profile: 'deep-lore',
      reason: `matched deep-lore terms: ${deepLoreMatched.slice(0, 3).join(', ')}`,
      matchedTerms: deepLoreMatched,
    };
  }

  // Step 6: weak prose terms (describe, scene, narration — checked after design)
  const weakProseMatched = findMatchedTerms(lq, getWeakProseTerms());
  if (weakProseMatched.length > 0) {
    return {
      profile: 'prose',
      reason: `matched prose terms: ${weakProseMatched.slice(0, 3).join(', ')}`,
      matchedTerms: weakProseMatched,
    };
  }

  // Step 7: canon terms
  const canonMatched = findMatchedTerms(lq, getCanonTerms());
  if (canonMatched.length > 0) {
    return {
      profile: 'canon',
      reason: `matched canon terms: ${canonMatched.slice(0, 3).join(', ')}`,
      matchedTerms: canonMatched,
    };
  }

  // Step 8: default
  return {
    profile: 'canon',
    reason: 'default',
    matchedTerms: [],
  };
}
