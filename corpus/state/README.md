# Karsac Campaign State Corpus

This folder contains table-progress state — not setting canon.

## Important Distinction

| Folder | Content |
|---|---|
| `../collections/` | Canon: what is true in the world — NPCs, places, forces, rules, monsters |
| `./` | State: what has happened at this table |

**Canon** says what is true in the world.
**State** says what has happened at this table.
**Player knowledge** says what the party currently knows.
**Threads** say what is still active, simmering, dormant, closed, or abandoned.

## Layout

```
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
```

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

Imported from `KarsacTracker/` by `scripts/import-tracker-state.js`.

Do not mix state files into `corpus/collections/` — state is table-progress, not canon.
