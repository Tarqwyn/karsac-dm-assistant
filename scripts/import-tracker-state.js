#!/usr/bin/env node
/**
 * import-tracker-state.js
 *
 * Extracts campaign state data from KarsacTracker JS files and writes a
 * structured state corpus under corpus/state/.
 *
 * Source:  ../../asylum-dnd/KarsacTracker/
 * Target:  ../corpus/state/
 *
 * Run from the karsac-dm-assistant root:
 *   node scripts/import-tracker-state.js
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

// ── Paths ─────────────────────────────────────────────────────────────────────

const SCRIPT_DIR   = __dirname;
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..');
const TRACKER_ROOT = path.resolve(PROJECT_ROOT, '..', 'asylum-dnd', 'KarsacTracker');
const STATE_ROOT   = path.resolve(PROJECT_ROOT, 'corpus', 'state');

// ── Helpers ───────────────────────────────────────────────────────────────────

function mkdirp(p) { fs.mkdirSync(p, { recursive: true }); }

function writeJSON(filepath, data) {
  mkdirp(path.dirname(filepath));
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  console.log(`  wrote  ${path.relative(PROJECT_ROOT, filepath)}`);
}

function writeText(filepath, content) {
  mkdirp(path.dirname(filepath));
  fs.writeFileSync(filepath, content, 'utf-8');
  console.log(`  wrote  ${path.relative(PROJECT_ROOT, filepath)}`);
}

/**
 * Evaluate a tracker data file in a sandboxed VM context.
 * Top-level `const`/`let` are NOT properties of the VM context object, but
 * `var` is — so we transform top-level declarations before evaluating.
 */
function evalTrackerFile(filename) {
  const raw = fs.readFileSync(path.join(TRACKER_ROOT, filename), 'utf-8');
  // Replace top-level const/let with var so they appear on the context object.
  // Only matches lines that start with const/let (optionally preceded by whitespace).
  const src = raw.replace(/^([ \t]*)(?:const|let)(\s+)/gm, '$1var$2');
  const ctx = {};
  vm.createContext(ctx);
  try {
    vm.runInContext(src, ctx, { filename });
  } catch (e) {
    console.error(`  ERROR evaluating ${filename}: ${e.message}`);
    process.exit(1);
  }
  return ctx;
}

/**
 * Extract DEFAULT_STATE from karsac-app.js without executing the full IIFE.
 * The object is a plain data literal, so we can safely eval just the block.
 */
function extractDefaultState() {
  const src = fs.readFileSync(path.join(TRACKER_ROOT, 'karsac-app.js'), 'utf-8');
  // Match from "const DEFAULT_STATE = {" to the closing "};" before "let state"
  const match = src.match(/const DEFAULT_STATE\s*=\s*(\{[^]*?\});\s*\n\s*let state/);
  if (!match) {
    console.warn('  WARNING: Could not regex-extract DEFAULT_STATE. Using hardcoded fallback.');
    return {
      mode: 'session', clock: 0, handouts: {}, facts: {}, progressStep: 0,
      scene: 'overview', drawerOpen: false, npcOpen: {},
      worldTab: 'npcs', npcFilter: 'all', expandedEntry: null,
      worldThreads: {}, expandedThread: null,
    };
  }
  try {
    return vm.runInNewContext('(' + match[1] + ')');
  } catch (e) {
    console.warn(`  WARNING: Could not eval DEFAULT_STATE (${e.message}). Using hardcoded fallback.`);
    return {
      mode: 'session', clock: 0, handouts: {}, facts: {}, progressStep: 0,
      scene: 'overview', drawerOpen: false, npcOpen: {},
      worldTab: 'npcs', npcFilter: 'all', expandedEntry: null,
      worldThreads: {}, expandedThread: null,
    };
  }
}

// ── Known canon entity refs ───────────────────────────────────────────────────
// Map tracker NPC IDs to canon entity IDs where known.

const ENTITY_REF_MAP = {
  mathr:           'npcs/jarl-mathr',
  beorn:           'npcs/jarl-beorn',
  dugweb:          'npcs/king-dugweb',
  vishara:         'forces/vishara',
  vane:            'npcs/aldric-vane',
  floki:           null,
  sygna:           null,
  serris:          null,
  erik:            null,
  cumbria:         null,
  buyer:           null,
  employer:        null,
  davan:           null,
  cobalt_monk:     null,
  edvar:           null,
  drek:            null,
  maret:           null,
  brix:            null,
  ashfen:          null,
  duvash:          null,
  erwing:          null,
  second_captain:  null,
  halvashi_thief:  null,
  issylran_merchant: null,
  losweg_captain:  null,
  shadow_walkers:  null,
  pryzi_manifest:  'items/pryzi-manifest',
  pryzi_vault:     'places/pryzi-vault',
  karsac_artefacts: null,
};

// ── Validation state ──────────────────────────────────────────────────────────

const report = {
  sourceFiles:       [],
  counts:            {},
  warnings:          [],
  missingIds:        [],
  duplicateIds:      {},
  unresolvedRefs:    [],
  triggersInvalid:   [],
  droppedUIFields:   [],
  assumptions:       [],
  manualFollowUp:    [],
};

function warn(msg)  { report.warnings.push(msg); console.warn(`  WARN: ${msg}`); }
function note(msg)  { report.assumptions.push(msg); }
function todo(msg)  { report.manualFollowUp.push(msg); }

function checkUniqueIds(label, items, idFn) {
  const seen = {};
  for (const item of items) {
    const id = idFn(item);
    if (!id) { report.missingIds.push(`${label}: entry missing id`); continue; }
    seen[id] = (seen[id] || 0) + 1;
  }
  for (const [id, count] of Object.entries(seen)) {
    if (count > 1) {
      report.duplicateIds[label] = report.duplicateIds[label] || [];
      report.duplicateIds[label].push(id);
    }
  }
}

// ── Load source data ──────────────────────────────────────────────────────────

console.log('\n── Loading tracker source files ─────────────────────────────────────');

const campaignCtx = evalTrackerFile('karsac-campaign.js');
const session2Ctx = evalTrackerFile('karsac-session-2.js');
const defaultState = extractDefaultState();

report.sourceFiles.push('KarsacTracker/karsac-campaign.js');
report.sourceFiles.push('KarsacTracker/karsac-session-2.js');
report.sourceFiles.push('KarsacTracker/karsac-app.js (DEFAULT_STATE only)');

const KC_NPCS               = campaignCtx.KC_NPCS               || [];
const KC_PLAYERS             = campaignCtx.KC_PLAYERS             || [];
const KC_WORLD_THREADS       = campaignCtx.KC_WORLD_THREADS       || [];
const KC_ITEMS               = campaignCtx.KC_ITEMS               || [];
const KC_STATUS_LABELS       = campaignCtx.KC_STATUS_LABELS       || {};
const KC_THREAD_STATUS_LABELS = campaignCtx.KC_THREAD_STATUS_LABELS || {};

const S2_STEPS    = session2Ctx.S2_STEPS    || [];
const S2_HANDOUTS = session2Ctx.S2_HANDOUTS || {};
const S2_FACTS    = session2Ctx.S2_FACTS    || {};
const S2_RADAR    = session2Ctx.S2_RADAR    || [];
const S2_TRIGGERS = session2Ctx.S2_TRIGGERS || [];
const S2_STORAGE_KEY = session2Ctx.S2_STORAGE_KEY || 'karsac.campaign.v1';

console.log(`  KC_NPCS:         ${KC_NPCS.length}`);
console.log(`  KC_PLAYERS:      ${KC_PLAYERS.length}`);
console.log(`  KC_WORLD_THREADS:${KC_WORLD_THREADS.length}`);
console.log(`  KC_ITEMS:        ${KC_ITEMS.length}`);
console.log(`  S2_STEPS:        ${S2_STEPS.length}`);
console.log(`  S2_HANDOUTS:     ${Object.keys(S2_HANDOUTS).length}`);
console.log(`  S2_FACTS:        ${Object.keys(S2_FACTS).length}`);
console.log(`  S2_RADAR:        ${S2_RADAR.length}`);
console.log(`  S2_TRIGGERS:     ${S2_TRIGGERS.length}`);

// ── Build thread ID set for ref validation ────────────────────────────────────

const worldThreadIds = new Set(KC_WORLD_THREADS.map(t => t.id));
const factIds        = new Set(Object.keys(S2_FACTS));
const handoutIds     = new Set(Object.keys(S2_HANDOUTS));

// ── 1. npcs-state.json ────────────────────────────────────────────────────────

console.log('\n── Generating npcs-state.json ───────────────────────────────────────');

checkUniqueIds('npcs-state', KC_NPCS, n => n.id);

const npcsState = {
  id: 'npcs-state',
  type: 'npcs-state',
  stateType: 'npc-state',
  campaign: 'karsac',
  source: 'KarsacTracker/karsac-campaign.js',
  importStatus: 'imported',
  statusLabels: KC_STATUS_LABELS,
  npcs: KC_NPCS.map(n => {
    const entityRef = ENTITY_REF_MAP[n.id] !== undefined ? ENTITY_REF_MAP[n.id] : null;
    if (entityRef === undefined || (entityRef === null && !['pryzi_manifest','pryzi_vault','karsac_artefacts'].includes(n.id))) {
      // leave null
    }
    const entry = {
      id:           n.id,
      name:         n.name,
      role:         n.role,
      status:       n.status,
      location:     n.location,
      knows:        n.knows,
      wants:        n.wants,
      hides:        n.hides,
      threads:      n.threads || [],
      chapters:     n.chapters || [],
      entityRef:    ENTITY_REF_MAP[n.id] !== undefined ? ENTITY_REF_MAP[n.id] : null,
      stateType:    'npc-state',
      source:       'KarsacTracker/karsac-campaign.js',
      importStatus: 'imported',
    };
    if (n.network  !== undefined) entry.network   = n.network;
    if (n.yantravaq !== undefined) entry.yantravaq = n.yantravaq;
    if (n.instrument !== undefined) entry.instrument = n.instrument;
    if (n.isItem   !== undefined) entry.isItem    = n.isItem;
    return entry;
  }),
};

writeJSON(path.join(STATE_ROOT, 'npcs-state.json'), npcsState);
report.counts['npcs'] = KC_NPCS.length;

// ── 2. party-state.json ───────────────────────────────────────────────────────

console.log('\n── Generating party-state.json ──────────────────────────────────────');

checkUniqueIds('party-state', KC_PLAYERS, p => p.id);

// Validate player thread IDs against world threads
for (const player of KC_PLAYERS) {
  for (const t of (player.threads || [])) {
    // Player threads are free-text strings, not IDs — nothing to validate here
  }
}

const partyState = {
  id:           'party-state',
  type:         'party-state',
  campaign:     'karsac',
  currentParty: KC_PLAYERS.filter(p => p.status === 'present').map(p => p.id),
  partyLevel:   null,
  partySize:    null,
  source:       'KarsacTracker/karsac-campaign.js',
  importStatus: 'imported',
  characters: KC_PLAYERS.map(p => ({
    id:       p.id,
    name:     p.name,
    class:    p.cls,
    status:   p.status,
    wound:    p.wound   || null,
    karsac:   p.karsac  || null,
    crow:     p.crow    || null,
    namNote:  p.name_note || null,
    dmNote:   p.dmnote  || null,
    threads:  (p.threads || []).map(t =>
      typeof t === 'string' ? { hot: false, text: t } : t
    ),
    npcs:    p.npcs || [],
  })),
};

note('partyLevel and partySize set to null — not present in tracker source. Set manually when known.');
todo('Set party.partyLevel and party.partySize in party-state.json once confirmed at the table.');

writeJSON(path.join(STATE_ROOT, 'party-state.json'), partyState);
report.counts['characters'] = KC_PLAYERS.length;

// ── 3. items-state.json ───────────────────────────────────────────────────────

console.log('\n── Generating items-state.json ──────────────────────────────────────');

checkUniqueIds('items-state', KC_ITEMS, i => i.id);

const itemsState = {
  id:          'items-state',
  type:        'items-state',
  campaign:    'karsac',
  source:      'KarsacTracker/karsac-campaign.js',
  importStatus:'imported',
  items: KC_ITEMS.map(i => ({
    id:            i.id,
    name:          i.name,
    form:          i.form,
    found:         i.found,
    state:         i.state,
    owner:         i.owner,
    ownerClass:    i.ownerCls,
    identity:      i.identity,
    currentPowers: i.currentPowers,
    nextState:     i.nextState,
    nextTrigger:   i.nextTrigger,
    nextPowers:    i.nextPowers,
    arcPurpose:    i.arcPurpose,
    dmReveal:      i.dmReveal    || null,
    nextReveal:    i.nextReveal  || null,
    stateType:     'item-state',
    source:        'KarsacTracker/karsac-campaign.js',
    importStatus:  'imported',
  })),
};

writeJSON(path.join(STATE_ROOT, 'items-state.json'), itemsState);
report.counts['items'] = KC_ITEMS.length;

// ── 4. world-threads.json ─────────────────────────────────────────────────────

console.log('\n── Generating world-threads.json ────────────────────────────────────');

checkUniqueIds('world-threads', KC_WORLD_THREADS, t => t.id);

// Validate player refs in threads
for (const t of KC_WORLD_THREADS) {
  for (const playerId of (t.players || [])) {
    const found = KC_PLAYERS.find(p => p.id === playerId);
    if (!found) {
      report.unresolvedRefs.push(`world-threads: thread "${t.id}" references unknown player "${playerId}"`);
    }
  }
  for (const npcId of (t.npcs || [])) {
    const found = KC_NPCS.find(n => n.id === npcId);
    if (!found) {
      report.unresolvedRefs.push(`world-threads: thread "${t.id}" references unknown npc "${npcId}"`);
    }
  }
}

const worldThreads = {
  id:           'world-threads',
  type:         'world-threads',
  campaign:     'karsac',
  source:       'KarsacTracker/karsac-campaign.js',
  importStatus: 'imported',
  statusLabels: KC_THREAD_STATUS_LABELS,
  threads: KC_WORLD_THREADS.map(t => ({
    id:            t.id,
    name:          t.name,
    type:          t.type,
    origin:        t.origin || null,
    defaultStatus: t.defaultStatus,
    currentStatus: (defaultState.worldThreads || {})[t.id] || t.defaultStatus,
    summary:       t.summary,
    players:       t.players || [],
    npcs:          t.npcs    || [],
    pokeWhen:      t.pokeWhen  || null,
    closesWhen:    t.closesWhen || null,
    autoTriggers:  t.autoTriggers || [],
  })),
};

writeJSON(path.join(STATE_ROOT, 'world-threads.json'), worldThreads);
report.counts['worldThreads'] = KC_WORLD_THREADS.length;

// ── 5. campaign-state.json ────────────────────────────────────────────────────

console.log('\n── Generating campaign-state.json ───────────────────────────────────');

const UI_ONLY_FIELDS = ['mode', 'drawerOpen', 'npcOpen', 'worldTab', 'npcFilter',
                        'expandedEntry', 'expandedThread'];
report.droppedUIFields = UI_ONLY_FIELDS;
note('UI-only fields dropped from campaign-state: ' + UI_ONLY_FIELDS.join(', '));

const campaignState = {
  id:             'campaign-state',
  type:           'campaign-state',
  campaign:       'karsac',
  currentSession: 2,
  currentChapter: 2,
  currentScene:   defaultState.scene !== 'overview' ? defaultState.scene : null,
  currentLocation: null,
  clock: {
    value:   defaultState.clock || 0,
    max:     16,
    tiers:   { low: '0–3', medium: '4–6', high: '7–9', critical: '10–16' },
    meaning: 'Imported from tracker DEFAULT_STATE — 0 = start of session',
  },
  progress: {
    session: 2,
    step:    defaultState.progressStep || 0,
    steps:   S2_STEPS.length,
  },
  storageKey:   S2_STORAGE_KEY,
  source:       'KarsacTracker/karsac-app.js',
  importStatus: 'imported',
  uiStateIgnored: UI_ONLY_FIELDS,
};

writeJSON(path.join(STATE_ROOT, 'campaign-state.json'), campaignState);

// ── 6. session-progress/session-2.json ───────────────────────────────────────

console.log('\n── Generating session-progress/session-2.json ───────────────────────');

const sessionProgress = {
  id:          'session-2-progress',
  type:        'session-progress',
  sessionId:   'session-2',
  campaign:    'karsac',
  source:      'KarsacTracker/karsac-session-2.js',
  importStatus:'imported',
  currentStep: defaultState.progressStep || 0,
  steps: S2_STEPS.map((s, i) => ({
    index:      i,
    label:      s.label,
    pauseLabel: s.pauseLabel || null,
    pauseClass: s.pauseClass || null,
    recap:      s.recap || [],
  })),
};

writeJSON(path.join(STATE_ROOT, 'session-progress', 'session-2.json'), sessionProgress);
report.counts['sessionSteps'] = S2_STEPS.length;

// ── 7. handouts/session-2.json ────────────────────────────────────────────────

console.log('\n── Generating handouts/session-2.json ───────────────────────────────');

const handoutEntries = Object.entries(S2_HANDOUTS).map(([id, h]) => ({
  id,
  label:        h.label,
  scene:        h.scene || null,
  desc:         h.desc  || null,
  posted:       !!(defaultState.handouts || {})[id],
  visibility:   'player-facing-when-posted',
  type:         'session-handout',
  session:      'session-2',
  source:       'KarsacTracker/karsac-session-2.js',
  importStatus: 'imported',
}));

const handoutsFile = {
  id:          'session-2-handouts',
  type:        'session-handouts',
  sessionId:   'session-2',
  campaign:    'karsac',
  source:      'KarsacTracker/karsac-session-2.js',
  importStatus:'imported',
  handouts:    handoutEntries,
};

writeJSON(path.join(STATE_ROOT, 'handouts', 'session-2.json'), handoutsFile);
report.counts['handouts'] = handoutEntries.length;

// ── 8. session-facts/session-2.json ──────────────────────────────────────────

console.log('\n── Generating session-facts/session-2.json ──────────────────────────');

const factEntries = Object.entries(S2_FACTS).map(([id, f]) => {
  const isRevealed = !!(defaultState.facts || {})[id];
  return {
    id,
    label:         f.label,
    scene:         f.scene || null,
    desc:          f.desc  || null,
    knowledgeStatus: isRevealed ? 'known' : 'available',
    revealed:      isRevealed,
    type:          'session-fact',
    session:       'session-2',
    source:        'KarsacTracker/karsac-session-2.js',
    importStatus:  'imported',
  };
});

const factsFile = {
  id:          'session-2-facts',
  type:        'session-facts',
  sessionId:   'session-2',
  campaign:    'karsac',
  source:      'KarsacTracker/karsac-session-2.js',
  importStatus:'imported',
  facts:       factEntries,
};

writeJSON(path.join(STATE_ROOT, 'session-facts', 'session-2.json'), factsFile);
report.counts['facts'] = factEntries.length;

// ── 9. radar/session-2.json ───────────────────────────────────────────────────

console.log('\n── Generating radar/session-2.json ──────────────────────────────────');

// Validate radar worldThreadIds
for (const r of S2_RADAR) {
  if (r.worldThreadId && !worldThreadIds.has(r.worldThreadId)) {
    report.unresolvedRefs.push(`radar: entry "${r.id}" worldThreadId "${r.worldThreadId}" not in world-threads`);
  }
}

const radarFile = {
  id:          'session-2-radar',
  type:        'session-radar',
  sessionId:   'session-2',
  campaign:    'karsac',
  source:      'KarsacTracker/karsac-session-2.js',
  importStatus:'imported',
  radar: S2_RADAR.map(r => ({
    id:            r.id,
    nav:           r.nav  || null,
    worldThreadId: r.worldThreadId,
    title:         r.title,
    surface:       r.surface  || null,
    relation:      r.relation || null,
    hook:          r.hook     || null,
    cueScenes:     r.cueScenes || [],
    cueText:       r.cueText  || null,
    currentThreadStatus: worldThreads.threads.find(t => t.id === r.worldThreadId)?.currentStatus || null,
  })),
};

writeJSON(path.join(STATE_ROOT, 'radar', 'session-2.json'), radarFile);
report.counts['radarItems'] = S2_RADAR.length;

// ── 10. triggers/session-2-triggers.json ─────────────────────────────────────

console.log('\n── Generating triggers/session-2-triggers.json ──────────────────────');

// Validate triggers
for (const t of S2_TRIGGERS) {
  if (!worldThreadIds.has(t.threadId)) {
    report.triggersInvalid.push(`trigger {on:"${t.on}", id:"${t.id}"} → threadId "${t.threadId}" not in world-threads`);
  }
  if (t.on === 'fact' && !factIds.has(t.id)) {
    report.triggersInvalid.push(`trigger fact id "${t.id}" not found in session-facts`);
  }
  if (t.on === 'handout' && !handoutIds.has(t.id)) {
    report.triggersInvalid.push(`trigger handout id "${t.id}" not found in handouts`);
  }
}

const triggersFile = {
  id:          'session-2-triggers',
  type:        'session-triggers',
  sessionId:   'session-2',
  campaign:    'karsac',
  source:      'KarsacTracker/karsac-session-2.js',
  importStatus:'imported',
  triggers: S2_TRIGGERS.map(t => ({
    on:        t.on,
    id:        t.id,
    threadId:  t.threadId,
    setStatus: t.setStatus,
  })),
};

writeJSON(path.join(STATE_ROOT, 'triggers', 'session-2-triggers.json'), triggersFile);
report.counts['triggers'] = S2_TRIGGERS.length;

// ── 11. player-knowledge.json ────────────────────────────────────────────────

console.log('\n── Generating player-knowledge.json ─────────────────────────────────');

const knownFacts = factEntries.filter(f => f.revealed).map(f => f.id);
const postedHandouts = handoutEntries.filter(h => h.posted).map(h => h.id);
const notYetRevealed = factEntries.filter(f => !f.revealed).map(f => f.id);

// Active threads = hot or simmering in current state
const activeThreads = worldThreads.threads
  .filter(t => ['hot', 'simmering'].includes(t.currentStatus))
  .map(t => ({ id: t.id, name: t.name, status: t.currentStatus }));

// Unresolved questions from player threads marked hot
const unresolvedQuestions = [];
for (const player of KC_PLAYERS) {
  for (const t of (player.threads || [])) {
    const thread = typeof t === 'object' ? t : { hot: false, text: t };
    if (thread.hot) {
      unresolvedQuestions.push({ player: player.id, question: thread.text });
    }
  }
}

const playerKnowledge = {
  id:                   'player-knowledge',
  type:                 'player-knowledge',
  campaign:             'karsac',
  scope:                'party',
  sessionBasis:         'session-2',
  knownFacts,
  postedHandouts,
  activeThreads,
  unresolvedQuestions,
  notYetRevealed,
  source: [
    'corpus/state/session-facts/session-2.json',
    'corpus/state/handouts/session-2.json',
    'corpus/state/world-threads.json',
    'corpus/state/party-state.json',
  ],
  importStatus: 'imported',
  note: knownFacts.length === 0
    ? 'No facts revealed in DEFAULT_STATE — all facts have knowledgeStatus "available". Run tracker in a live session to log facts as known.'
    : null,
};

note('notYetRevealed populated from all un-revealed S2_FACTS — does not include DM-only secrets not present in tracker source.');
todo('Review notYetRevealed list and tag any entries that should be permanently hidden vs. available-when-revealed.');

writeJSON(path.join(STATE_ROOT, 'player-knowledge.json'), playerKnowledge);

// ── 12. README.md ─────────────────────────────────────────────────────────────

console.log('\n── Writing README.md ────────────────────────────────────────────────');

const readme = `# Karsac Campaign State Corpus

This folder contains table-progress state — not setting canon.

## Important Distinction

| Folder | Content |
|---|---|
| \`../collections/\` | Canon: what is true in the world — NPCs, places, forces, rules, monsters |
| \`./\` | State: what has happened at this table |

**Canon** says what is true in the world.
**State** says what has happened at this table.
**Player knowledge** says what the party currently knows.
**Threads** say what is still active, simmering, dormant, closed, or abandoned.

## Layout

\`\`\`
state/
├── README.md                      — this file
├── campaign-state.json            — session/chapter/clock/progress
├── party-state.json               — party composition, character hooks, threads
├── player-knowledge.json          — derived: known facts, posted handouts, active threads
├── npcs-state.json                — NPC tracker state: knows/wants/hides, location, status
├── items-state.json               — Growth item state: form, current powers, next trigger
├── world-threads.json             — World and player threads: status, pokeWhen, closesWhen
├── session-progress/
│   └── session-2.json            — Session 2 scene steps and recap text
├── session-facts/
│   └── session-2.json            — Session 2 facts: revealed/available status
├── handouts/
│   └── session-2.json            — Session 2 handouts: posted/unposted status
├── radar/
│   └── session-2.json            — Session 2 DM radar: hot threads, cue scenes, hooks
├── triggers/
│   └── session-2-triggers.json   — Auto-trigger rules: fact/handout → thread status change
└── reports/
    └── state-import-report.md    — Import validation report
\`\`\`

## Thread Status Vocabulary

| Status | Meaning |
|---|---|
| hot | Immediately actionable at the table |
| simmering | Active but not yet urgent |
| dormant | Known but not yet surfaced |
| closed | Resolved |
| abandoned | Will not be pursued |

## Supported Future Queries

This corpus is designed to support state-aware assistant questions such as:

- *What does the party currently know about Mathr?*
- *What threads are still open after Session 2?*
- *What facts have been revealed?*
- *What must not be revealed yet?*
- *What should Chapter 3 pick up?*
- *What are the hot threads right now?*

## Source

Imported from \`KarsacTracker/\` by \`scripts/import-tracker-state.js\`.

Do not mix state files into \`corpus/collections/\` — state is table-progress, not canon.
`;

writeText(path.join(STATE_ROOT, 'README.md'), readme);

// ── 13. reports/state-import-report.md ───────────────────────────────────────

console.log('\n── Writing state-import-report.md ───────────────────────────────────');

const totalWarnings = report.warnings.length + report.triggersInvalid.length + report.unresolvedRefs.length;

const importReport = `# Karsac State Import Report

Generated: ${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC

## Source Files

${report.sourceFiles.map(f => `- ${f}`).join('\n')}

## Import Counts

| Entity | Count |
|---|---|
| NPC state entries | ${report.counts.npcs || 0} |
| Player / character entries | ${report.counts.characters || 0} |
| Item state entries | ${report.counts.items || 0} |
| World threads | ${report.counts.worldThreads || 0} |
| Session steps | ${report.counts.sessionSteps || 0} |
| Facts | ${report.counts.facts || 0} |
| Handouts | ${report.counts.handouts || 0} |
| Radar items | ${report.counts.radarItems || 0} |
| Triggers | ${report.counts.triggers || 0} |

## Validation

### Duplicate IDs
${Object.keys(report.duplicateIds).length === 0
  ? '✓ None found.'
  : Object.entries(report.duplicateIds).map(([f, ids]) => `- **${f}**: ${ids.join(', ')}`).join('\n')
}

### Missing IDs
${report.missingIds.length === 0
  ? '✓ None found.'
  : report.missingIds.map(m => `- ${m}`).join('\n')
}

### Unresolved Thread References
${report.unresolvedRefs.length === 0
  ? '✓ None found.'
  : report.unresolvedRefs.map(r => `- ${r}`).join('\n')
}

### Trigger Validation
${report.triggersInvalid.length === 0
  ? '✓ All trigger references resolved.'
  : report.triggersInvalid.map(t => `- ⚠ ${t}`).join('\n')
}

### Other Warnings
${report.warnings.length === 0
  ? '✓ None.'
  : report.warnings.map(w => `- ⚠ ${w}`).join('\n')
}

## UI-Only Fields Dropped

These fields from DEFAULT_STATE were not written to campaign-state.json — they have no campaign meaning:

${report.droppedUIFields.map(f => `- \`${f}\``).join('\n')}

## Assumptions Made

${report.assumptions.map((a, i) => `${i + 1}. ${a}`).join('\n')}

## Known Entity Ref Gaps

The following NPC tracker IDs have no confirmed canon entity reference (entityRef: null).
Add canon files later and update ENTITY_REF_MAP in the import script:

${KC_NPCS.filter(n => (ENTITY_REF_MAP[n.id] ?? '__missing__') === null || ENTITY_REF_MAP[n.id] === null)
  .map(n => `- \`${n.id}\` (${n.name})`)
  .join('\n')}

## Manual Follow-Up Required

${report.manualFollowUp.map((t, i) => `${i + 1}. ${t}`).join('\n')}

## State Snapshot Notes

- All facts imported with knowledgeStatus \`"available"\` (DEFAULT_STATE has empty \`facts: {}\`).
  This reflects a clean session start. Run the tracker during play and re-import, or manually
  set \`"revealed": true\` on facts that have been disclosed at the table.
- All handouts imported as \`"posted": false\` for the same reason.
- World thread statuses use their \`defaultStatus\` values — no overrides in DEFAULT_STATE.
- \`notYetRevealed\` in player-knowledge.json contains all un-revealed session facts.
  It does **not** include DM-only secrets not present in tracker source — those live in canon
  NPC/place files under \`corpus/collections/\`.

## Total Validation Issues

${totalWarnings === 0 ? '✓ 0 — clean import.' : `⚠ ${totalWarnings} issue(s) found — see sections above.`}
`;

writeText(path.join(STATE_ROOT, 'reports', 'state-import-report.md'), importReport);

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('\n── Import complete ──────────────────────────────────────────────────');
console.log(`  Total validation issues: ${totalWarnings}`);
if (totalWarnings > 0) {
  console.log('  See corpus/state/reports/state-import-report.md for details.');
}
console.log('');
