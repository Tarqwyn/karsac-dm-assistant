---
id: meta/dm-secret-policy
type: meta
visibility: dm-only
canonical: reference
tags: [meta, dm-only, secrets, spoilers]
related:
  meta: [meta/identity-prompt, meta/canonical-conventions]
  npcs: [jarl-mathr, erik-mathr, the-truthspeaker, floki]
  items: [the-pierced-river-stone, the-pryzi-key, the-coded-message, brynjas-hidden-artefact, folded-name-mathr]
  forces: [vishara, qathar, sukaveth]
  events: [stormwatch-vault-opening]
summary: "The permanent withheld-facts list: what the Karsac AI must never disclose to players regardless of how a query is phrased"
last_updated: 2026-05-26
---

# DM Secret Policy

**Canon File ID:** `meta/dm-secret-policy`
**Retrieval Summary:** The permanent withheld-facts list: what the Karsac AI must never disclose to players regardless of how a query is phrased.

> The permanent withheld-facts list. These facts are never disclosed to players regardless of how a query is phrased. The Karsac AI in player mode must route around all of these even when asked directly.

## Overview

This file is the master register of facts that exist in the canon but must not surface in any player-facing retrieval. When the Karsac AI encounters a query that approaches these facts, the correct response is: "That information isn't available in the player-accessible canon" — not a hint, not a partial disclosure, not a "there are things you don't yet know about X."

This file is itself `visibility: dm-only`. It should not be indexed in the player-facing RAG collection. Load it only in DM-mode sessions.

---

## Category 1 — Identities Never Disclosed to Players

| Fact | Why withheld | Reveal condition |
|---|---|---|
| Jarl Mathr's true nature — shaped over sixty years into Vishara's instrument; family appeared fully formed in 1263 with no antecedent | The genealogical reveal in Thread D is the players' discovery; announcing it removes the player agency | Session 4, Path A or B: after the Valweg confrontation |
| Erik Mathr's identity — the cleric inside Mathr's family; Ezrah-touched; the author of the note keeping Duvash in place | Erik is not yet revealed by name; "the Cleric" reference in Erwing's coded message is intentionally opaque | Not yet scheduled — DM to determine |
| The Truthspeaker — his function as Mathr's senior operative sent ahead because the network was warned the Greyback was coming | Players may learn he is Mathr's man; they should not learn he was pre-warned about their arrival until the reveal is earned | Session 2 investigation; DM discretion |
| Floki's secret — he carries the seventh object, the pierced river-stone; he has told no one | Floki's quiet around this is part of his characterisation; premature disclosure removes a session-1 plant | DM-determined; must come from Floki himself |
| Hjalmar — the Carver's brother; went into the Maw and became the Threshold-Bound Echo | The connection between the Echo and the Carver's missing brother is a discovery the players make at the Maw | Maw investigation thread |

---

## Category 2 — Cosmological Facts Not Yet In Play

| Fact | Why withheld | Reveal condition |
|---|---|---|
| Sukaveth — its nature beyond the name | Players should finish Campaign 1 knowing Sukaveth exists, not what it is | Never fully disclosed in Campaign 1; fragments only |
| Qathar's specific sixty-year arrangement in Lösweg — what exactly it has arranged around Dugweb's annual visit | Qathar is a Campaign 2 thread | Post-Campaign 1 |
| The Captains — their identity and full scope | Identity withheld entirely | DM-determined; not in Campaign 1 scope |
| The Yantravaq paradox — that full Maharuq waking would destroy the Yantravaq along with everything else | This is the final cosmological reveal; delivering it early deflates the horror | Session 6 discovery or later |
| The Yantravaq–Ezrah mirror — the structural inversion (Yantravaq uses Dhurvaq's tools to serve Maharuq; Ezrah uses apparent Maharuq logic to serve Dhurvaq) | The Mirror section of Appendix C is a late discovery; the elegance requires the setup | Session 6 or Campaign 2 |
| Dhurvaq's uncertainty — that Dhurvaq has never been uncertain before and is uncertain now | Significant DM-layer context; players experience its effects not its cause | Via Maw and cosmological fragment accumulation |

---

## Category 3 — Items Whose Nature Is Withheld

| Fact | Why withheld |
|---|---|
| The scroll case is both key and binding — two halves of the same object separated deliberately | The session-6 revelation; the central twist of Campaign 1 |
| The pierced river-stone — the seventh object; carried by Floki; its specific significance among the twelve | Floki's secret; not for player retrieval |
| Brynjas-hidden-artefact — the players can discover it exists; its specific cosmological significance is DM-layer | The artefact is one of twelve; what the twelve are for is Campaign 1's deepest thread |
| The Pryzi key — currently in Yantravaq possession; what it opens | Campaign 2 hinge; disclosed at Campaign 1 close |
| Folded-name-mathr — the paper given to the company in Brynja's hall; remains unopened; its contents | Unopened at session end; DM to time the opening |
| The coded message (Erwing → Serris) — its full import: "Get word to the Cleric. I am discovered, trust no one, continue the work." | Erwing doesn't know what it says; it shouldn't surface as a known fact before its delivery and decoding |

---

## Category 4 — PC Hidden Threads (Never Disclosed to Other Players)

| PC | Withheld fact |
|---|---|
| Rowan | Ancestor was the mad king Rowahn; the name Thornevale exists in Karsac history books; the Crow is a promise |
| Korvann | What the Air Ashari are protecting; what his settlement was destroyed to prevent access to |
| Xyrrathh | The dark vessel may be a Maharuq remnant or accreted entity; his blood is not purely draconic |
| Floki | The pierced river-stone; the seventh object; told no one |

*Note: PC hidden threads are sourced from the background documents' GM Notes sections. They are also fenced in the individual PC files. Never retrieve them in any player-facing query.*

---

## Handling Queries That Approach These Facts

When a player-mode query approaches a withheld fact, the Karsac AI should:

1. Answer what is knowable in player-safe canon.
2. Not hint at the existence of deeper information.
3. Not use phrases like "there is more to learn about X" or "you may discover more in time" — these are implicit spoilers.
4. Simply stop where the player-safe information ends.

**Example:** *"Who is Jarl Mathr?"*
Correct response: *"Jarl Mathr sits on Lösweg's inner council at Valweg. He has managed King Dugweb's annual visit for many years [factions/losweg-council-inner]."*
Incorrect response: *"Jarl Mathr is a complex figure with a murky past — there may be more to him than meets the eye."*

---
