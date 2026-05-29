---
id: adversaries/valweg-informants
type: adversary
visibility: dm-only
canonical: provisional
ruleset: dnd-5e-2014
tags: [adversary, valweg, informant, mathr, social-obstacle, chapter-3, information-control]
opposition_type: [informant, social-obstacle, faction-agent]
encounter_roles: [informant, social-pressure, clue-carrier, deceiver, watcher]
campaign_use: [information-control, social-obstruction, chapter-3, valweg-operations, council-access]
mechanical_base:
  - npc-bases/srd-2014/spy
  - npc-bases/srd-2014/commoner
  - npc-bases/srd-2014/noble
mechanical_status: provisional-adaptation
homebrew_adjustments:
  status: provisional
  notes: "No canon stat block. Valweg informants are the embedded layer of Mathr's network inside the council city. They may be innkeepers, minor council scribes, market traders, or servants in noble houses. Their role is to track the party's presence in Valweg and relay it to Mathr's operation. A subset may also feed the party false information or misdirection. The Maret reference (sourcebook: 'the archive Maret directs them toward') suggests a named Valweg contact — this NPC may exist in the informant layer or may be a genuine ally; DM should decide."
can_know:
  - their embedded position and cover role
  - who to report to and through what channel
  - basic description of the party if provided in advance
  - local Valweg knowledge appropriate to their cover role
must_not_know:
  - Mathr's full hidden nature
  - Vishara's purpose or the Yantravaq
  - that they are part of a larger surveillance network
  - the cosmological significance of what the party carries
  - the full purpose of the information they are collecting
tactics:
  - maintain cover in their embedded role (innkeeper, scribe, trader, servant)
  - observe and report; do not engage
  - if approached with questions, give slightly wrong or vague information without appearing to do so
  - do not fight; a compromised informant withdraws and reports the breach
  - the most dangerous informant is one who appears to be helping the party
escalation:
  low: "The innkeeper knows which room they are in. The scribe noted their names in the wrong ledger. Someone is watching the council gate."
  medium: "A source who seemed helpful gave information that sent the party the wrong way. The misdirection was smooth enough to be convincing."
  high: "The party's entire Valweg operation has been visible to Mathr since they arrived. The council meeting they needed was quietly moved. Beorn has been told something about them that is not quite accurate."
player_safe_reveal:
  - "In a city this size, someone is always watching the arrivals board."
  - "The innkeeper was very interested in how long they planned to stay."
  - "The information they received was accurate in form and wrong in a way that was hard to identify."
  - "Someone knew they had asked to see Beorn before Beorn received the request."
dm_only:
  - "Valweg informants are the city-layer equivalent of Törweg watchers. The same network, operating in a more complex environment."
  - "The most sophisticated use: an informant who is genuinely helpful on minor things and then misdirects on the one thing that matters. The party has no reason to distrust them until the misdirection resolves."
  - "Maret (sourcebook reference) may be a genuine ally, an informant, or a test of the party's judgment. DM should decide and be consistent."
  - "Mathr has managed Dugweb's annual visit for sixty years from this city. His information network here is the most developed of any location in the campaign."
related:
  factions:
    - id: factions/house-mathr
    - id: factions/losweg-council-inner
candidate_links:
  places:
    - id: places/valweg
      confidence: high
      reason: "Valweg is Mathr's council seat. Informants here are the core of his urban intelligence network."
      status: suggested
  npcs:
    - id: npcs/maret
      confidence: medium
      reason: "Sourcebook reference to Maret as a Valweg archive contact. May be ally, informant, or ambiguous."
      status: suggested
summary: "Provisional adversary type: Mathr's embedded informants inside Valweg. Innkeepers, scribes, traders, servants. They observe, report, and occasionally misdirect. The most dangerous are the ones who appear helpful. Canon basis: Mathr has controlled Valweg's information environment for sixty years."
---

# Valweg Informants

## Adversary Summary

Mathr's embedded information network inside Valweg — the city where the party needs to reach Jarl Beorn before Dugweb's annual visit. Innkeepers who note arrivals. Scribes who track council request logs. Market traders who report unusual purchases. Minor servants who know which rooms have been asked for. They do not fight. They watch, and they relay, and the most dangerous among them appear to be helping.

## Campaign Purpose

Valweg informants make the party's time in the council city feel observed and managed without making the source of that management obvious. They create the texture of a compromised information environment: things the party planned in private becoming known, misdirections that are smooth enough to be convincing, a council meeting that was quietly moved before they could attend it. Mathr has managed this city's information for sixty years. The party is new here.

## What They Are

Ordinary-seeming Valweg residents and minor officials in Mathr's information network. Most do not think of themselves as spies — they have simply received a reliable stream of small payments for small pieces of information. Some are more deliberate. A few are planted.

## What They Know

Their embedded cover role, their reporting contact, their assignment. Local Valweg knowledge appropriate to their position.

## What They Do Not Know

Mathr's full nature. Vishara's purpose. That they are part of a network rather than an isolated arrangement.

## Tactics

Cover maintenance. Observation and relay. Misdirection when needed, delivered through helpfulness rather than obstruction. A compromised informant withdraws and reports rather than fights. The most effective informant is the one who helps the party find three true things and then redirects them on the fourth.

## Escalation Levels

**Low** — Ambient. The innkeeper is too interested. The council scribe asked a question they should not know to ask.

**Medium** — Misdirection resolved. The party went to the wrong building, the wrong official, the wrong time. The information was correct in form.

**High** — The party's full Valweg operation has been visible since arrival. Beorn has been given a framing for them that is slightly wrong. The meeting is harder to obtain than it should be.

## Mechanical Base

No combat stat block intended. Use `npc-bases/srd-2014/commoner` for embedded locals, `npc-bases/srd-2014/spy` for active operatives, `npc-bases/srd-2014/noble` for a planted minor council official.

## Karsac Adaptation Notes

The key design principle: never make informants obviously hostile. Their adversarial function is entirely invisible until it resolves. Run them as helpful NPCs with a subtly wrong detail, and let the party discover the wrong detail naturally or on an Insight check (DC 15).

The Maret question (sourcebook reference) is a DM decision point. If Maret is an ally, the party has a genuine resource in Valweg. If Maret is an informant, the betrayal should be specific and painful but not arbitrary — their helpfulness should be real on everything except the one thing that mattered.

## Player-Safe Use

Players may perceive: too much interest in their plans, information that was accurate and then wasn't, the sense that someone knew they were coming before they arrived, the difficulty of getting to Beorn that feels slightly managed rather than bureaucratic. Players must not be told the scope of Mathr's Valweg network or how long it has been in place.

## Canon Status

**Provisional.** Mathr's sixty-year management of Valweg's political environment is canon (Ch2 BETA, Sourcebook). An informant network in Valweg follows logically but is not named or instantiated. Mark as provisional until Chapter 3 material confirms.
