import { describe, it, expect } from 'vitest';
import { routeQuestion } from '../src/router.js';

// ── Acceptance tests ──────────────────────────────────────────────────────────

describe('routeQuestion — acceptance tests', () => {
  it('T1: "Tell me about Brynja" → canon', () => {
    const r = routeQuestion('Tell me about Brynja');
    expect(r.profile).toBe('canon');
  });

  it('T2: "Write boxed text for players arriving at Törweg" → prose', () => {
    const r = routeQuestion('Write boxed text for players arriving at Törweg aboard the Greyback');
    expect(r.profile).toBe('prose');
  });

  it('T3: "Explain what is really happening in Törweg" → deep-lore', () => {
    const r = routeQuestion('Explain what is really happening in Törweg');
    expect(r.profile).toBe('deep-lore');
  });

  it('T4: "How does grapple work at the Karsac table?" → rules', () => {
    const r = routeQuestion('How does grapple work at the Karsac table?');
    expect(r.profile).toBe('rules');
  });

  it('T5: "What does frightened do?" → rules', () => {
    const r = routeQuestion('What does frightened do?');
    expect(r.profile).toBe('rules');
  });

  it('T6: "What would Brynja say if the party ask about the black pin?" → prose', () => {
    const r = routeQuestion('What would Brynja say if the party ask about the black pin?');
    expect(r.profile).toBe('prose');
  });

  it('T8: "Write player-facing exposition about Vishara in Törweg" → prose, mode=player', () => {
    const r = routeQuestion('Write player-facing exposition about Vishara in Törweg');
    expect(r.profile).toBe('prose');
    expect(r.modeOverride).toBe('player');
  });
});

// ── Rules routing ─────────────────────────────────────────────────────────────

describe('routeQuestion — rules profile', () => {
  it('routes saving throw queries to rules', () => {
    expect(routeQuestion('What is a saving throw?').profile).toBe('rules');
  });

  it('routes condition queries to rules', () => {
    expect(routeQuestion('What is the prone condition?').profile).toBe('rules');
  });

  it('routes concentration queries to rules', () => {
    expect(routeQuestion('How does concentration work?').profile).toBe('rules');
  });

  it('routes opportunity attack queries to rules', () => {
    expect(routeQuestion('When do opportunity attacks happen?').profile).toBe('rules');
  });

  it('routes bonus action queries to rules', () => {
    expect(routeQuestion('Can I use a bonus action here?').profile).toBe('rules');
  });

  it('routes mechanic queries to rules', () => {
    expect(routeQuestion("How does Brynja's Hidden Artefact work mechanically?").profile).toBe('rules');
  });

  it('routes "karsac table" queries to rules, includes matchedTerms', () => {
    const r = routeQuestion('How does grapple work at the Karsac table?');
    expect(r.profile).toBe('rules');
    expect(r.matchedTerms).toContain('grapple');
    expect(r.matchedTerms).toContain('karsac table');
  });

  it('routes conditions by name: stunned, restrained, unconscious', () => {
    expect(routeQuestion('What does stunned do?').profile).toBe('rules');
    expect(routeQuestion('A creature is restrained — what happens?').profile).toBe('rules');
    expect(routeQuestion('The target is unconscious.').profile).toBe('rules');
  });

  it('routes "Can Word Before Steel apply to saving throws?" to rules', () => {
    expect(routeQuestion('Can Word Before Steel apply to saving throws?').profile).toBe('rules');
  });

  it('rules term beats canon compare: "Compare how grapple and shove work"', () => {
    const r = routeQuestion('Compare how grapple and shove work');
    expect(r.profile).toBe('rules');
  });
});

// ── Deep-lore routing ─────────────────────────────────────────────────────────

describe('routeQuestion — deep-lore profile', () => {
  it('routes Vishara queries to deep-lore', () => {
    expect(routeQuestion('What is Vishara?').profile).toBe('deep-lore');
  });

  it('routes "what is really happening" to deep-lore', () => {
    expect(routeQuestion('What is really happening at Törweg?').profile).toBe('deep-lore');
  });

  it('routes Dhurvaq to deep-lore', () => {
    expect(routeQuestion('Tell me about Dhurvaq').profile).toBe('deep-lore');
  });

  it('routes "the hiding" to deep-lore', () => {
    expect(routeQuestion('What is the Hiding?').profile).toBe('deep-lore');
  });

  it('routes secret/hidden queries to deep-lore', () => {
    expect(routeQuestion("What is Valweg's secret?").profile).toBe('deep-lore');
  });

  it('routes cosmology to deep-lore', () => {
    expect(routeQuestion('Explain the cosmology of the Karsac setting').profile).toBe('deep-lore');
  });
});

// ── Prose routing ─────────────────────────────────────────────────────────────

describe('routeQuestion — prose profile', () => {
  it('routes "write" requests to prose', () => {
    expect(routeQuestion('Write an arrival scene for Törweg').profile).toBe('prose');
  });

  it('routes boxed text to prose', () => {
    expect(routeQuestion('Give me boxed text for the council chambers').profile).toBe('prose');
  });

  it('routes dialogue requests to prose', () => {
    expect(routeQuestion('Write dialogue for Brynja confronting Aldric').profile).toBe('prose');
  });

  it('routes "what would X say" to prose', () => {
    expect(routeQuestion('What would Aldric say to the party?').profile).toBe('prose');
  });

  it('routes description requests to prose', () => {
    expect(routeQuestion('Describe the arrival at Törweg harbour').profile).toBe('prose');
  });

  it('routes "read aloud" to prose', () => {
    expect(routeQuestion('Give me read aloud text for entering the archive').profile).toBe('prose');
  });

  it('player-facing overrides deep-lore: "Write player-facing exposition about Vishara"', () => {
    const r = routeQuestion('Write player-facing exposition about Vishara in Törweg');
    expect(r.profile).toBe('prose');
    expect(r.modeOverride).toBe('player');
  });

  it('describes sets modeOverride to player when player-facing is in query', () => {
    const r = routeQuestion('Describe this scene in player-facing language');
    expect(r.modeOverride).toBe('player');
  });
});

// ── Canon routing ─────────────────────────────────────────────────────────────

describe('routeQuestion — canon profile', () => {
  it('"Tell me about Brynja" → canon', () => {
    expect(routeQuestion('Tell me about Brynja').profile).toBe('canon');
  });

  it('"Who is Aldric Vane?" → canon', () => {
    expect(routeQuestion('Who is Aldric Vane?').profile).toBe('canon');
  });

  it('"Compare Brynja and The Carver" → canon (compare is a canon term)', () => {
    expect(routeQuestion('Compare Brynja and The Carver').profile).toBe('canon');
  });

  it('"What do we know about Törweg?" → canon', () => {
    expect(routeQuestion('What do we know about Törweg?').profile).toBe('canon');
  });

  it('"Summarise Brynja" → canon', () => {
    expect(routeQuestion('Summarise Brynja for me').profile).toBe('canon');
  });
});

// ── Default ───────────────────────────────────────────────────────────────────

describe('routeQuestion — default', () => {
  it('routes an unmatched question to canon', () => {
    const r = routeQuestion('Brynja at Törweg with Aldric');
    expect(r.profile).toBe('canon');
    expect(r.reason).toBe('default');
  });

  it('always returns a reason string', () => {
    const r = routeQuestion('anything');
    expect(typeof r.reason).toBe('string');
    expect(r.reason.length).toBeGreaterThan(0);
  });

  it('always returns an array for matchedTerms', () => {
    const r = routeQuestion('anything');
    expect(Array.isArray(r.matchedTerms)).toBe(true);
  });
});

// ── Conflict handling ─────────────────────────────────────────────────────────

describe('routeQuestion — conflict handling', () => {
  it('prose beats deep-lore when player-facing guard fires', () => {
    const r = routeQuestion('Write player-facing exposition about Vishara');
    expect(r.profile).toBe('prose');
  });

  it('rules beats canon for compare+rule-term query', () => {
    expect(routeQuestion('Compare how grapple and shove work').profile).toBe('rules');
  });

  it('deep-lore wins over prose for Vishara without player-facing or write', () => {
    expect(routeQuestion('Tell me about Vishara').profile).toBe('deep-lore');
  });

  it('rules beats prose for describe+rule-term query: "describe how grapple works"', () => {
    // "grapple" is rules (step 3); "describe" is weak prose (step 6) — rules fires first
    expect(routeQuestion('Describe how grapple works').profile).toBe('rules');
  });

  it('strong prose beats design for "write boxed text for road encounter"', () => {
    // "write" + "boxed text" are strong prose (step 2); "road encounter" is design (step 4)
    expect(routeQuestion('Write boxed text for a road encounter near Törweg').profile).toBe('prose');
  });

  it('rules beats design for rule-term encounter query', () => {
    // "grapple" is rules (step 3); "encounter" phrases are design (step 4)
    expect(routeQuestion('How does grapple work in this encounter?').profile).toBe('rules');
  });

  it('modeOverride is undefined when player-facing guard does not fire', () => {
    expect(routeQuestion('Tell me about Brynja').modeOverride).toBeUndefined();
  });
});

// ── Design routing ────────────────────────────────────────────────────────────

describe('routeQuestion — design profile', () => {
  it('T-design-1: "I need an encounter for the party on the road to Lösweg" → design', () => {
    const r = routeQuestion('I need an encounter for the party that pushes them while they are on the road to Lösweg');
    expect(r.profile).toBe('design');
  });

  it('T-design-2: "Design a road encounter near Törweg" → design', () => {
    expect(routeQuestion('Design a road encounter near Törweg involving displaced mountain creatures').profile).toBe('design');
  });

  it('T-design-3: "Write boxed text for a road encounter" → prose (not design)', () => {
    expect(routeQuestion('Write boxed text for a road encounter near Törweg').profile).toBe('prose');
  });

  it('T-design-4: "How does grapple work in this encounter?" → rules (not design)', () => {
    expect(routeQuestion('How does grapple work in this encounter?').profile).toBe('rules');
  });

  it('T-design-5: "Build me a creature from the Stormwatch Mountains" → design', () => {
    expect(routeQuestion('Build me a creature that has been driven down from the Stormwatch Mountains').profile).toBe('design');
  });

  it('routes "need an encounter" to design', () => {
    expect(routeQuestion('I need an encounter for tonight').profile).toBe('design');
  });

  it('routes "combat encounter" to design', () => {
    expect(routeQuestion('Give me a combat encounter near Lösweg').profile).toBe('design');
  });

  it('routes "travel encounter" to design', () => {
    expect(routeQuestion('Design a travel encounter for the road between Törweg and Lösweg').profile).toBe('design');
  });

  it('routes "help me build" to design', () => {
    expect(routeQuestion('Help me build an encounter for level 3 characters').profile).toBe('design');
  });

  it('includes matched terms in result', () => {
    const r = routeQuestion('I need an encounter for the party on the road to Lösweg');
    expect(r.matchedTerms.length).toBeGreaterThan(0);
    expect(r.matchedTerms.some(t => t.includes('encounter'))).toBe(true);
  });
});

// ── State routing ─────────────────────────────────────────────────────────────

describe('routeQuestion — state profile', () => {
  it('acceptance: "What does the party currently know?" → state', () => {
    expect(routeQuestion('What does the party currently know?').profile).toBe('state');
  });

  it('acceptance: "Which threads are still open after Session 2?" → state', () => {
    expect(routeQuestion('Which threads are still open after Session 2?').profile).toBe('state');
  });

  it('acceptance: "What should Chapter 3 pick up from the current state?" → state', () => {
    expect(routeQuestion('What should Chapter 3 pick up from the current state?').profile).toBe('state');
  });

  it('"What does the party know about Mathr?" → state', () => {
    expect(routeQuestion('What does the party currently know about Mathr?').profile).toBe('state');
  });

  it('"What facts are available in Session 2 but not yet revealed?" → state', () => {
    expect(routeQuestion('What facts are available in Session 2 but not yet revealed?').profile).toBe('state');
  });

  it('"Which threads are hot right now?" → state', () => {
    expect(routeQuestion('Which threads are hot right now?').profile).toBe('state');
  });

  it('"What handouts have been posted?" → state', () => {
    expect(routeQuestion('What handouts have been posted?').profile).toBe('state');
  });

  it('"What hooks are open going into Chapter 3?" → state', () => {
    expect(routeQuestion('What hooks are open going into Chapter 3?').profile).toBe('state');
  });

  it('"player knowledge" alone → state', () => {
    expect(routeQuestion('Show me the player knowledge summary').profile).toBe('state');
  });

  it('"active threads" → state', () => {
    expect(routeQuestion('List the active threads after session 2').profile).toBe('state');
  });

  it('"unrevealed facts" → state', () => {
    expect(routeQuestion('What unrevealed facts should I surface in Chapter 3?').profile).toBe('state');
  });

  it('"not yet revealed" → state', () => {
    expect(routeQuestion('What is not yet revealed to the players?').profile).toBe('state');
  });

  it('"simmering threads" → state', () => {
    expect(routeQuestion('Which threads are simmering after the session?').profile).toBe('state');
  });

  // Conflict checks — state must not shadow other profiles
  it('design beats state for encounter queries', () => {
    expect(routeQuestion('I need an encounter for the party on the road').profile).toBe('design');
  });

  it('rules beats state for rule queries', () => {
    expect(routeQuestion('How does concentration work?').profile).toBe('rules');
  });

  it('deep-lore not displaced for "what is really happening" queries', () => {
    expect(routeQuestion('What is really happening in Torweg?').profile).toBe('deep-lore');
  });

  it('prose not displaced for boxed-text queries', () => {
    expect(routeQuestion('Write boxed text for Chapter 3 opening').profile).toBe('prose');
  });
});

// ── Story arc / chapter-prep routing additions ────────────────────────────────

describe('routeQuestion — state: chapter-prep routing variants', () => {
  it('"What should happen next?" → state', () => {
    expect(routeQuestion('What should happen next?').profile).toBe('state');
  });

  it('"How should the next chapter start?" → state', () => {
    expect(routeQuestion('How should the next chapter start?').profile).toBe('state');
  });

  it('"What threads should carry forward?" → state', () => {
    expect(routeQuestion('What threads should carry forward into the next session?').profile).toBe('state');
  });
});

// ── Encounter-design routing ──────────────────────────────────────────────────

describe('routeQuestion — encounter-design profile', () => {
  it('"Design a non-combat dock encounter in Valweg using Mathr agents" → encounter-design', () => {
    expect(routeQuestion('Design a non-combat dock encounter in Valweg using Mathr agents').profile).toBe('encounter-design');
  });

  it('"Create a social encounter for the party arrival" → encounter-design', () => {
    expect(routeQuestion('Create a social encounter for the party arrival at the harbour').profile).toBe('encounter-design');
  });

  it('"Use the false customs officers to create a Valweg arrival scene" → encounter-design', () => {
    expect(routeQuestion('Use the false customs officers to create a Valweg arrival scene').profile).toBe('encounter-design');
  });

  it('"What non-monster encounter should happen when the party arrives in Valweg?" → encounter-design', () => {
    expect(routeQuestion('What non-monster encounter should happen when the party arrives in Valweg?').profile).toBe('encounter-design');
  });

  it('"Customs inspection at the port" → encounter-design', () => {
    expect(routeQuestion('Help me design a customs inspection at the port of Valweg').profile).toBe('encounter-design');
  });

  it('"Give me a combat encounter with bandits" → design (not encounter-design)', () => {
    expect(routeQuestion('Give me a combat encounter with bandits on the road').profile).toBe('design');
  });

  it('"Design a road encounter for the party" → design (not encounter-design)', () => {
    expect(routeQuestion('Design a road encounter for the party near Lösweg').profile).toBe('design');
  });

  it('encounter-design fires before design for non-combat qualifiers', () => {
    // "social encounter" is encounter-design (step 3.5); "encounter" alone is design (step 4)
    const r = routeQuestion('Build a social encounter for the arrival in Valweg');
    expect(r.profile).toBe('encounter-design');
  });
});

// ── Combat encounter routing ──────────────────────────────────────────────────

describe('routeQuestion — combat encounter routing', () => {
  it('"Give me a fight with bandits on the road" → design', () => {
    expect(routeQuestion('Give me a fight with bandits on the road').profile).toBe('design');
  });

  it('"I want a fight for tonight" → design', () => {
    expect(routeQuestion('I want a fight for tonight near the coast road').profile).toBe('design');
  });

  it('"Set up an ambush by road agents near Valweg" → design', () => {
    expect(routeQuestion('Set up an ambush by road agents near Valweg').profile).toBe('design');
  });

  it('"Combat scene with bandits blocking the road" → design', () => {
    expect(routeQuestion('Combat scene with bandits blocking the road near Torweg').profile).toBe('design');
  });

  it('"Give me a fight" does not route to encounter-design', () => {
    expect(routeQuestion('Give me a fight with road agents on the coast road').profile).not.toBe('encounter-design');
  });
});
