export type Profile = 'canon' | 'prose' | 'deep-lore' | 'rules' | 'design';

export interface RouteResult {
  profile: Profile;
  reason: string;
  matchedTerms: string[];
  modeOverride?: 'player' | 'dm';
}

// ── Term lists ────────────────────────────────────────────────────────────────
// Ordered: longer/more specific phrases come before shorter ones to avoid
// early partial matches shadowing the more precise entry.

const RULES_TERMS = [
  // D&D rule vocabulary
  'rule', 'rules', 'ruling',
  'mechanically', 'mechanic', 'mechanics',
  // Actions (long phrases first)
  'bonus action', 'help action', 'hide action', 'ready action',
  'reaction', 'action',
  'dash', 'disengage', 'dodge',
  // Rolls and checks (long phrases first)
  'death saving throw', 'saving throw',
  'ability check', 'attack roll', 'check',
  'death save',
  // Specific rules
  'opportunity attack', 'attack of opportunity',
  'grappling', 'grapple', 'shove',
  'concentration', 'spellcasting', 'damage',
  // Conditions
  'blinded', 'charmed', 'deafened', 'exhaustion',
  'frightened', 'grappled', 'incapacitated', 'invisible',
  'paralyzed', 'petrified', 'poisoned', 'prone',
  'restrained', 'stunned', 'unconscious',
  'condition',
  // Karsac-specific rule queries
  'karsac table', 'table rule', 'house rule',
] as const;

const DESIGN_TERMS = [
  // Explicit need/want + encounter
  'need an encounter', 'want an encounter',
  // Design/build/make/create + encounter
  'design an encounter', 'build an encounter', 'make an encounter', 'create an encounter',
  // Encounter-type phrases
  'encounter for the party', 'encounter on the road',
  'road encounter', 'travel encounter', 'random encounter',
  'combat encounter', 'non-combat encounter',
  'challenging encounter', 'balanced encounter', 'creature encounter',
  'encounter concept', 'encounter idea',
  // Help phrases
  'help me design', 'help me make', 'help me build', 'help me create',
  // Build/design + target (longer phrases first)
  'build me an', 'build me a',
  'design me an', 'design me a',
  'build a creature', 'design a creature',
  'build an npc', 'design an npc',
] as const;

const DEEP_LORE_TERMS = [
  // Strong phrase matches first
  'what is really happening', "what's really happening",
  'what is actually going on', "what's actually going on",
  'behind the scenes', 'explain the hidden',
  'thinning of the particular',
  'hidden truth', 'larger truth',
  'dm-only', 'dm only', 'deep lore',
  // Named cosmology terms
  'vishara', 'dhurvaq', 'maharuq', 'yantravaq',
  'the holding', 'the hiding', 'the thinning',
  'the instruments', 'the waking',
  // Broader qualifiers (after specific terms)
  'cosmology', 'hidden', 'secret', 'reveal',
] as const;

// Strong prose signals that override design (e.g. "write boxed text for an encounter")
const STRONG_PROSE_TERMS = [
  'boxed text', 'read-aloud', 'read aloud',
  'flavour text', 'flavor text',
  'intro text', 'opening text', 'arrival text',
  'dm narration',
  'give me lines',
  'make it more', 'make this sound',
  'what would',   // "what would X say"
  'dialogue',
  'rewrite', 'write',
] as const;

// Weaker prose signals checked after design
const WEAK_PROSE_TERMS = [
  'description', 'describe',
  'narration', 'scene', 'voice',
] as const;

const CANON_TERMS = [
  'tell me about', 'tell me',
  'who is', 'who are',
  'what is', 'what are',
  'what do we know',
  'list facts',
  'summarise', 'summarize',
  'extract facts',
  'difference between',
  'how are',
  'compare',
  'cite', 'sources',
  'player-known', 'ambiguities',
] as const;

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
 *   4. design terms          → design
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
  const strongProseMatched = findMatchedTerms(lq, STRONG_PROSE_TERMS);
  if (strongProseMatched.length > 0) {
    return {
      profile: 'prose',
      reason: `matched prose terms: ${strongProseMatched.slice(0, 3).join(', ')}`,
      matchedTerms: strongProseMatched,
    };
  }

  // Step 3: rules terms
  const rulesMatched = findMatchedTerms(lq, RULES_TERMS);
  if (rulesMatched.length > 0) {
    return {
      profile: 'rules',
      reason: `matched rules terms: ${rulesMatched.slice(0, 3).join(', ')}`,
      matchedTerms: rulesMatched,
    };
  }

  // Step 4: design terms
  const designMatched = findMatchedTerms(lq, DESIGN_TERMS);
  if (designMatched.length > 0) {
    return {
      profile: 'design',
      reason: `matched design terms: ${designMatched.slice(0, 3).join(', ')}`,
      matchedTerms: designMatched,
    };
  }

  // Step 5: deep-lore terms
  const deepLoreMatched = findMatchedTerms(lq, DEEP_LORE_TERMS);
  if (deepLoreMatched.length > 0) {
    return {
      profile: 'deep-lore',
      reason: `matched deep-lore terms: ${deepLoreMatched.slice(0, 3).join(', ')}`,
      matchedTerms: deepLoreMatched,
    };
  }

  // Step 6: weak prose terms (describe, scene, narration — checked after design)
  const weakProseMatched = findMatchedTerms(lq, WEAK_PROSE_TERMS);
  if (weakProseMatched.length > 0) {
    return {
      profile: 'prose',
      reason: `matched prose terms: ${weakProseMatched.slice(0, 3).join(', ')}`,
      matchedTerms: weakProseMatched,
    };
  }

  // Step 7: canon terms
  const canonMatched = findMatchedTerms(lq, CANON_TERMS);
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
