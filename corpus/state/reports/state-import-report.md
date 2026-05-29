# Karsac State Import Report

Generated: 2026-05-29 13:58:49 UTC

## Source Files

- KarsacTracker/karsac-campaign.js
- KarsacTracker/karsac-session-2.js
- KarsacTracker/karsac-app.js (DEFAULT_STATE only)

## Import Counts

| Entity | Count |
|---|---|
| NPC state entries | 29 |
| Player / character entries | 5 |
| Item state entries | 4 |
| World threads | 18 |
| Session steps | 8 |
| Facts | 44 |
| Handouts | 12 |
| Radar items | 4 |
| Triggers | 37 |

## Validation

### Duplicate IDs
✓ None found.

### Missing IDs
✓ None found.

### Unresolved Thread References
✓ None found.

### Trigger Validation
✓ All trigger references resolved.

### Other Warnings
✓ None.

## UI-Only Fields Dropped

These fields from DEFAULT_STATE were not written to campaign-state.json — they have no campaign meaning:

- `mode`
- `drawerOpen`
- `npcOpen`
- `worldTab`
- `npcFilter`
- `expandedEntry`
- `expandedThread`

## Assumptions Made

1. partyLevel and partySize set to null — not present in tracker source. Set manually when known.
2. UI-only fields dropped from campaign-state: mode, drawerOpen, npcOpen, worldTab, npcFilter, expandedEntry, expandedThread
3. notYetRevealed populated from all un-revealed S2_FACTS — does not include DM-only secrets not present in tracker source.

## Known Entity Ref Gaps

The following NPC tracker IDs have no confirmed canon entity reference (entityRef: null).
Add canon files later and update ENTITY_REF_MAP in the import script:

- `erik` (Erik)
- `cobalt_monk` (The Cobalt Monk)
- `buyer` (The Buyer)
- `employer` (The Employer)
- `cumbria` (Captain Cumbria)
- `second_captain` (The Second Captain)
- `davan` (Davan Reish)
- `serris` (Serris)
- `erwing` (Erwing Smallfoot)
- `edvar` (Edvar Solm)
- `drek` (D'rek)
- `floki` (Floki)
- `sygna` (Sygna)
- `maret` (Maret)
- `brix` (Brix)
- `ashfen` (Tor Ashfen)
- `duvash` (Pell Duvash)
- `halvashi_thief` (The Halvashi Thief)
- `issylran_merchant` (The Issylran Merchant)
- `losweg_captain` (The Lösweg Captain)
- `shadow_walkers` (The Yngondi Shadow-Walkers)
- `karsac_artefacts` (Karsac Artefacts (Exandria))

## Manual Follow-Up Required

1. Set party.partyLevel and party.partySize in party-state.json once confirmed at the table.
2. Review notYetRevealed list and tag any entries that should be permanently hidden vs. available-when-revealed.

## State Snapshot Notes

- All facts imported with knowledgeStatus `"available"` (DEFAULT_STATE has empty `facts: {}`).
  This reflects a clean session start. Run the tracker during play and re-import, or manually
  set `"revealed": true` on facts that have been disclosed at the table.
- All handouts imported as `"posted": false` for the same reason.
- World thread statuses use their `defaultStatus` values — no overrides in DEFAULT_STATE.
- `notYetRevealed` in player-knowledge.json contains all un-revealed session facts.
  It does **not** include DM-only secrets not present in tracker source — those live in canon
  NPC/place files under `corpus/collections/`.

## Total Validation Issues

✓ 0 — clean import.
