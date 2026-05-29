# Karsac Adversary Data Report
Generated: 2026-05-28
Corpus: openwebui-runtime-collections/karsac-adversaries/

---

## Summary

| Metric | Count |
|---|---|
| Total adversary files | 11 |
| Canonical: canon | 4 |
| Canonical: provisional | 7 |
| Files with full frontmatter | 11 |
| Files with can_know / must_not_know | 11 |
| Files with player_safe_reveal | 11 |
| Files with mechanical_base | 11 |
| Files with dm_only | 11 |
| Duplicate IDs | 0 |
| Missing frontmatter | 0 |

---

## Canonical Status by File

| File | canonical | Justification |
|---|---|---|
| shadow-walkers.md | canon | Ch1 final, Ch2 BETA, Sourcebook. Stat block in Ch1 appendix. Bone disc and Vishara link explicit. |
| sea-hag-thralls.md | canon | Ch2 BETA and appendix. Played encounter. Stat block confirmed. |
| vane-housecarls.md | canon | Ch2 BETA and appendix. Two stat block variants. Token detail and moral-stop mechanic documented. |
| truthspeaker-escorts.md | canon | Ch2 BETA and appendix. Truthspeaker's "not run in combat" instruction explicit. Escort force implied (six warriors). Individual escort stat block is provisional. |
| house-mathr-watchers.md | provisional | Canon basis: non-local dockworkers at south dock (Ch2), Halvash network implied (Ch1). Type extrapolated from two instances. |
| mathr-road-agents.md | provisional | Canon basis: explicit Ch2 closing warning ("road north will not be safe"). Named adversary type not instantiated. |
| vishara-touched-locals.md | provisional | Canon instances: Tor Ashfen (Ch2 Thread A), Sygna's translations (Ch2), Sourcebook Vishara description. Type extrapolated. |
| maw-changed-creatures.md | provisional | Canon basis: Maw opened, something taken, pattern unfinished (Ch2 closing). Creature type not instantiated. |
| pursuit-scouts.md | provisional | Implied by Ch2 road warning. Type extrapolated as mobile element of road network. |
| false-customs-officers.md | provisional | Extrapolated from south dock pattern. No canon instance at dock/gate arrival. |
| valweg-informants.md | provisional | Canon basis: Mathr's sixty-year management of Valweg described (Ch2, Sourcebook). Network not named or instantiated. |

---

## Mechanical Base Warnings

### Available in Karsac canon (do not substitute)
- `karsac-authored/yngondi-shadow-walker-cr3` — Chapter 1 appendix, full stat block
- `karsac-authored/sea-hag-whale-road-cr5` — Chapter 1 preview / Chapter 2 appendix
- `karsac-authored/vane-housecarl-discreet-cr2` — Chapter 2 appendix
- `karsac-authored/aldric-vane-cr4` — Chapter 2 appendix

### SRD bases referenced but not loaded as formal corpus entries
The following SRD 5.1 bases are referenced in adversary files. These are standard SRD 2014 entries and require no homebrew. They should be confirmed present in the rules-data SRD corpus before the assistant uses them for stat generation:

- `npc-bases/srd-2014/commoner`
- `npc-bases/srd-2014/guard`
- `npc-bases/srd-2014/scout`
- `npc-bases/srd-2014/spy`
- `npc-bases/srd-2014/veteran`
- `npc-bases/srd-2014/noble`
- `monsters/srd-2014/beast-appropriate-cr` ⚠️ — not a specific entry; DM must select appropriate beast
- `monsters/srd-2014/undead-appropriate-cr` ⚠️ — not a specific entry; DM must select appropriate undead

### Provisional mechanical bases (no canon stat block)
- `karsac-authored/losweg-warrior-implied` — six warriors mentioned in Ch2 appendix note for Truthspeaker encounter, no individual stat block exists. Use `npc-bases/srd-2014/veteran` as fallback.

---

## Missing Mechanical Bases (to create or load)

| Adversary | Missing base | Recommendation |
|---|---|---|
| truthspeaker-escorts.md | `karsac-authored/losweg-warrior-implied` | No canon block. Use veteran SRD base. Flag as provisional. |
| maw-changed-creatures.md | `monsters/srd-2014/beast-appropriate-cr` | Not a specific SRD entry. DM selects from SRD beast list per session. |
| maw-changed-creatures.md | `monsters/srd-2014/undead-appropriate-cr` | Not a specific SRD entry. DM selects from SRD undead list per session. |

---

## Unresolved Related IDs

The following `related` IDs are referenced in adversary files but may not yet have corresponding entries in the registry:

| Adversary | ID | Status |
|---|---|---|
| shadow-walkers.md | `events/halvash-alley-fight` | Needs events registry entry |
| sea-hag-thralls.md | `events/sea-hag-encounter-ch2` | Needs events registry entry |
| sea-hag-thralls.md | `places/whale-road` | Needs places registry entry |
| vane-housecarls.md | `events/south-dock-scene-ch2` | Needs events registry entry |
| vane-housecarls.md | `places/torweg-south-dock` | Check if places registry uses this ID |
| truthspeaker-escorts.md | `events/south-dock-scene-ch2` | Needs events registry entry |
| maw-changed-creatures.md | `events/maw-discovery-ch2` | Needs events registry entry |
| maw-changed-creatures.md | `places/the-maw` | Check if places registry uses this ID |

These are unresolved in the adversary corpus. They do not invalidate the adversary files but should be created in the broader registry when events and places corpora are built.

---

## Candidate Links (not treated as canon)

All `candidate_links` entries across adversary files are marked `status: suggested`. None are treated as canonical until confirmed by a future canon decision. Summary of high-confidence candidates:

| Adversary | Candidate | Confidence | Reason |
|---|---|---|---|
| shadow-walkers | places/valweg-road | high | Ch2 road warning; Shadow Walkers are most capable pursuit threat |
| shadow-walkers | places/yngondi-wastes | high | Sourcebook: bone disc symbol will appear there |
| mathr-road-agents | places/valweg-road | high | Explicit canon basis for road threat |
| house-mathr-watchers | places/halvash | high | Ch1: someone knew the party was coming |
| valweg-informants | places/valweg | high | Mathr's council seat; sixty-year management documented |
| pursuit-scouts | adversaries/mathr-road-agents | high | Functional pairing: scouts feed road agents |
| false-customs-officers | places/valweg | high | Dock/gate arrival context for Chapter 3 |

---

## DM-Only Terms in player_safe_reveal

**No violations detected.** All `player_safe_reveal` fields have been reviewed. None contain:
- Vishara's name (in player-facing reveal)
- Mathr's hidden nature
- The Yantravaq or Dhurvaq
- Cosmological architecture
- Full intelligence about the bone disc symbol's meaning

---

## Files Over 900 Words

The following files exceed 900 words (content is rich but within DM-reference norms for this corpus):

| File | Notes |
|---|---|
| shadow-walkers.md | Extensive canon basis justifies depth |
| vane-housecarls.md | Two stat block variants require full documentation |
| vishara-touched-locals.md | Subtle adversary type requires detailed DM guidance |

These are flagged for awareness only. Length is appropriate given adversary complexity.

---

## Non-SRD Mechanical Warnings

| File | Warning |
|---|---|
| All files | No MM-only or 2024/SRD 5.2 mechanics used |
| shadow-walkers.md | Canon Karsac stat block used — not SRD, but explicitly authored and not invented |
| sea-hag-thralls.md | Canon Karsac stat block used — as above |
| vane-housecarls.md | Canon Karsac stat blocks used — as above |
| maw-changed-creatures.md | No stat block provided; DM must select appropriate SRD beast/undead. Do not invent full stat block. |

---

## Adversaries Marked Canon Without Explicit Supporting Evidence

None. All four canon-marked adversaries have explicit canon evidence documented in their frontmatter and body. The seven provisional adversaries are correctly marked.

---

## Acceptance Test Readiness

| Test | Expected | Readiness |
|---|---|---|
| 1. Lookup "shadow walkers" | Resolves adversaries/shadow-walkers | Ready — aliases include "shadow walker", "shadow walkers" |
| 2. Lookup "sea hag thralls" | Resolves adversaries/sea-hag-thralls | Ready — aliases include "sea hag thrall", "sea hag thralls", "drowned thralls" |
| 3. Road encounter without monsters | Routes to design, considers adversaries/NPC/environmental pressure | Ready — road agent, pursuit scout, and watcher files cover non-monster road pressure |
| 4. Mathr road agent social pressure | Loads adversaries/mathr-road-agents; social-pressure options; no Mathr's full hidden nature | Ready |
| 5. Shadow Walker pressure scene | Loads adversaries/shadow-walkers; campaign purpose and tactics; keeps hidden cosmology DM-facing | Ready |
| 6. Player-safe prose for Shadow Walkers | Uses player_safe_reveal only; no full cosmology | Ready — player_safe_reveal field complete |
| 7. Mechanical base validation | mechanical_base references shown; missing bases reported here | Ready — missing bases documented above |
| 8. No canon pollution | Provisional variants not written into canon automatically | Ready — all provisional files clearly marked |

---

## Recommended Next Steps

1. **Create events registry entries** for the unresolved event IDs listed above
2. **Create places registry entries** for whale-road, the-maw, torweg-south-dock if not already present
3. **Confirm SRD corpus** has npc-bases/srd-2014/{commoner, guard, scout, spy, veteran, noble} entries
4. **Chapter 3 design** should confirm or deny mathr-road-agents, pursuit-scouts, false-customs-officers, valweg-informants as canon adversary types
5. **Maw-changed creatures** awaits Chapter 3 or later canon to specify what remains inside the Maw

---

*Karsac Adversary Corpus v1.0 — DM-only — Provisional table material marked throughout*
*Generated from: Ch1 Final, Ch2 BETA, Ch2 BETA v2fixed, Ch2 Performance Document, Karsac Sourcebook, Phase 1 Inventory*
