---
id: proposals/mountain-ambush
proposal_type: encounter
title: Pryzi Mountain Ambush
status: promoted
canonical: provisional
visibility: dm-only
created_at: '2026-06-18T17:17:51.893Z'
gateway_build: 'karsac-registry@1.0.0#2026-06-18T15:48:31.553Z'
corpus_named: null
corpus_anchor_entity: null
corpus_stub_level: null
corpus_coverage_level: null
corpus_policy_id: null
source_prompt: >-
  Propose an encounter that can only be resolved by combat using shadow walkers
  as adversaries
route_profile: encounter-design
validation:
  status: fail
  issues:
    - >-
      FAIL: Named NPC boundary: "Lead Shadow-Walker (Enforcer)" is not in the
      NPC registry. Use a separate NPC proposal path or mark it provisional.
    - >-
      FAIL: Named NPC boundary: "Shadow-Walker (Scout)" is not in the NPC
      registry. Use a separate NPC proposal path or mark it provisional.
    - >-
      FAIL: Named NPC boundary: "Shadow-Walker (Brute)" is not in the NPC
      registry. Use a separate NPC proposal path or mark it provisional.
    - >-
      FAIL: Named NPC boundary: "Success" is not in the NPC registry. Use a
      separate NPC proposal path or mark it provisional.
    - >-
      FAIL: Named NPC boundary: "Partial Success" is not in the NPC registry.
      Use a separate NPC proposal path or mark it provisional.
    - >-
      FAIL: Named NPC boundary: "Costly Success" is not in the NPC registry. Use
      a separate NPC proposal path or mark it provisional.
    - >-
      FAIL: Named NPC boundary: "Failure" is not in the NPC registry. Use a
      separate NPC proposal path or mark it provisional.
    - >-
      FAIL: Named NPC boundary: "Fail-Forward" is not in the NPC registry. Use a
      separate NPC proposal path or mark it provisional.
    - >-
      FAIL: Named NPC boundary: "This" is not in the NPC registry. Use a
      separate NPC proposal path or mark it provisional.
    - >-
      WARN: Cosmological claim: proposal introduces a causal or directional
      relationship involving a force and should be DM-reviewed.
repair_log:
  pruned_sections: []
  auto_repairs: []
  false_positives_suppressed: []
related:
  chapters:
    - chapter-3
  sessions: []
  factions:
    - shadow-walkers
  places:
    - valweg
  npcs:
    - jarl-beorn
    - jarl-mathr
  items:
    - the-pryzi-key
    - the-bone-disc
  scenes:
    - scene-6
  adversaries:
    - shadow-walkers
  threads:
    - pryzi-key-gone-east
    - maw-named
  events:
    - south-dock-confrontation
promote_target: corpus/planning/scenes
summary: Mountain Ambush
promoted_from: corpus/proposals/encounters/mountain-ambush.proposed.md
promoted_at: '2026-06-18T18:20:53.414Z'
---

# Encounter: Mountain Ambush

## Encounter Type

Procedural Delay & Information Extraction

## Campaign Purpose

To directly advance the "Pryzi key — gone east" hot thread by forcing a confrontation with Shadow-Walkers attempting to retrieve the Pryzi manifest and bone disc from the party. This encounter also introduces a tangible threat related to the Pryzi vault and hints at the wider scope of Vishara's influence.

## Cast

* **Lead Shadow-Walker (Enforcer):** Karsac adversary source: Spy. Mechanical Base: Spy. Wants: Retrieve the Pryzi manifest, eliminate witnesses. Knows: The manifest's importance, the party's possession of it, basic Shadow-Walker combat tactics. Must not know: The party's connection to Vane or their knowledge of Mathr.
* **Shadow-Walker (Scout):** Karsac adversary source: Scout. Mechanical Base: Scout. Wants: Provide reconnaissance and support for the Enforcer. Knows: Local terrain, party movements. Must not know: The full scope of the Enforcer’s orders.
* **Shadow-Walker (Brute):** Karsac adversary source: Veteran. Mechanical Base: Veteran. Wants: Engage and disable the party. Knows: Basic combat tactics. Must not know: The manifest's contents or the Enforcer's identity.

## Opening Beat

The party is traveling along a narrow, winding road north of Akrafjall, heading towards Valweg. The terrain is rocky and sparsely forested. As they round a bend, they are abruptly blocked by three figures clad in dark, practical clothing, clearly not local to the region. They stand in a defensive posture, blocking the road.

## What the Opposition Wants

The Shadow-Walkers' primary objective is to retrieve the Pryzi manifest and Bone Disc from the party. They are prepared to use force to achieve this. A secondary objective is to eliminate any witnesses who might report the incident.

## What the Players Can Notice

* **"They are professionals from somewhere far to the east, dressed for a climate that is not here."** (DC 10 - Obvious)
* **"They move with absolute economy. Nothing wasted, nothing performed."** (DC 12 - Useful)
* **"Their weapons are a dark reddish-black metal that does not reflect light normally."** (DC 15 - Deep Suspicion)
* **"They are connected to a larger operation. They did not come alone."** (DC 18+ - Operational Detail - requires observation of subtle communication signals)

## Pressure Ladder

Low: Shadow-Walkers block the road, demand the manifest.
Medium: Shadow-Walkers become more aggressive, attempting to seize the manifest by force.
High: Combat erupts. The Shadow-Walkers demonstrate coordinated tactics and superior skill.

## Checks and Mechanics

* **Perception:** (DC 12) To notice the Shadow-Walkers before they block the road. Success: Party gains initiative. Partial Success: Party gains advantage on first attack. Failure: Shadow-Walkers gain initiative.
* **Insight:** (DC 15) To discern the Shadow-Walkers' motivations and assess their level of threat. Success: Understand they are professionals, not locals. Partial Success: Recognize their disciplined demeanor. Failure: Misinterpret their intentions, potentially leading to a disastrous negotiation attempt.
* **Investigation:** (DC 18) To identify the origin of their weapons or clothing. Success: Determine they are from the east, possibly linked to Pryzi Mountain.
* **Stealth:** (DC 15) To attempt to bypass the Shadow-Walkers. Success: Party successfully avoids combat. Partial Success: Party gains advantage on their first attack if combat is unavoidable. Failure: Shadow-Walkers detect the attempt and become immediately hostile.

## Player Choices

* **Comply:** Hand over the Pryzi manifest. The Shadow Walkers will still attack
* **Split Group:** Attempt to distract the Shadow-Walkers while another group escapes with the manifest. (Risky, requires coordination and Stealth checks)
* **Attack:** Initiate combat. (Direct confrontation, high risk of casualties)

## Outcomes

* **Success:** Party kills all the Shadow walkers and acquire both clues
* **Partial Success:** Party kills some shadow walkers and acquire one cluw
* **Costly Success:** Party defeats the Shadow-Walkers but suffers casualties and loses valuable equipment. (Victory, but with significant losses)
* **Failure:** Party is overwhelmed and the manifest and disc are stolen. (Loss of manifest, potential capture or injury)


## Combat Fallback

If combat is unavoidable, the Shadow-Walkers will fight as a coordinated unit, utilizing flanking maneuvers and coordinated attacks. The Enforcer will focus on the party member carrying the manifest. The Scout will harass and provide ranged support. The Brute will engage in melee combat.

## State Updates

* **"The Pryzi key — gone east"** thread advances – the Shadow-Walkers' presence confirms the key's importance and the urgency of the situation.
* **"The Maw — Vishara's tooth in Torweg"** thread deepens – the Shadow-Walkers’ involvement suggests a wider, coordinated effort.
* **"Operation Mathr — building the case"** thread progresses – the encounter provides another piece of evidence linking powerful forces to suspicious activity.

## Follow-up Hooks

1. A coded message on the body they will need to use the resources in Valweg to work this one out.
2. Another bone disc but slightly different

## Story Beat

The narrow road is flanked by jagged rock faces and skeletal trees, the air sharp with the scent of iron and pine. As the party rounds the bend, the Shadow-Walkers emerge from the shadows with practiced precision—three figures in dark, layered garments that seem to absorb the light. The Enforcer steps forward, their voice calm but edged with urgency: *"You carry something that does not belong to you. Surrender it, and you may yet leave this place whole."* Their eyes flick to the manifest, and the tension in the air thickens. The Scout’s hand hovers near their weapon, while the Brute’s stance is a coiled spring, ready to erupt. The road behind the party is blocked, but the path ahead is unclear—will this be a fight, a negotiation, or something worse?

## Pressure

**Low:** The Enforcer’s demand is clinical, their tone devoid of emotion. They gesture to the manifest, offering a choice: surrender it or face consequences. The Scout scans the terrain, eyes alert for signs of reinforcements.  
**Medium:** The Enforcer’s patience frays. They snap, *"You have one minute to decide,"* and the Brute advances, weapons drawn. The Scout’s arrows nocked, their stance shifting to intercept any escape.  
**High:** The Brute lunges, claws unsheathed, and the Scout looses an arrow at a party member. The Enforcer’s voice booms, *"Enough talk!"* as the Shadow-Walkers close ranks, their movements a lethal dance of flanking and coordinated strikes.

## Player Choice

* **Comply:** Handing over the manifest is not a simple act—it requires a moment of vulnerability. The Enforcer’s expression remains unreadable, but their eyes betray a flicker of triumph. The party is left with the bitter taste of betrayal.  
* **Challenge:** Negotiation is a gamble. The Enforcer’s words are sharp, *"We do not bargain with amateurs,"* but a high Persuasion check might reveal a sliver of leverage—perhaps a hint about the manifest’s true purpose. Intimidation could backfire, provoking the Brute into immediate violence.  
* **Bribe:** Offering a valuable item (e.g., a magical artifact or rare resource) risks revealing the party’s wealth. The Enforcer’s greed may be tempered by suspicion—*"Where did you get this?"*—forcing the party to lie or concede more than they intended.  
* **Split Group:** Dividing the party risks fragmentation. The Scout’s keen eyes might spot a fleeing group, but the Brute’s pursuit is relentless. Success requires a daring escape, but failure means the Shadow-Walkers will hunt them down.  
* **Attack:** Combat is inevitable, but the Shadow-Walkers’ tactics are ruthless. The Enforcer will target the manifest-bearer, the Scout will pepper the party with arrows, and the Brute will close the distance, seeking to overwhelm.

## Complication

If the party attempts to bribe, the Enforcer demands a second item—a secret the party possesses, not a material object. If the party splits, the Scout’s tracking skills are uncanny, and they’ll intercept the escapees with a warning: *"You cannot outrun the Shadow-Walkers."* During combat, the Enforcer may use a **"Shadow Veil"** ability (described in the stat block) to obscure the manifest’s location, forcing the party to fight through disorientation. Additionally, the rocky terrain favors the Shadow-Walkers’ stealth, granting them advantage on initiative if the party fails a Perception check.

## Consequence

* **Success:** The Shadow-Walkers retreat, but their parting words linger: *"This is not the end."* The party loses the manifest, and the encounter leaves them shaken, with a lingering sense of being hunted.  
* **Partial Success:** The Shadow-Walkers agree to a truce, but their presence is a constant reminder of the threat. The Enforcer leaves a cryptic message: *"The vault is not secure."*  
* **Costly Success:** The Shadow-Walkers are defeated, but the Brute’s final blow cripples a party member. The manifest is recovered, but the encounter leaves scars—both physical and psychological.  
* **Failure:** The manifest is stolen, and the party is captured. The Enforcer’s final words are a cold warning: *"The Vishara will not forget this."*  
* **Fail-Forward:** Captured but resourceful, the party sabotages the Shadow-Walkers’ communication by leaving a hidden tracker in the Enforcer’s gear. Though the manifest is lost, Serris later receives an anonymous tip about the Shadow-Walkers’ movements, offering a chance to strike first.

## Fail-Forward Path

While imprisoned, the party discovers the Shadow-Walkers’ communication relies on a **"Whispered Cipher"**—a system of subtle gestures and coded signals. Using a stolen token, the party alters the cipher’s meaning, causing the Shadow-Walkers to misinterpret their orders. When the Enforcer reports to their superiors, they receive conflicting directives, delaying their next move. This error buys Serris critical time to mobilize, setting the stage for a future confrontation where the party can reclaim the manifest.
