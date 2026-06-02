---
id: proposals/astrid-half-stone
proposal_type: npc
title: Astrid Half-Stone
status: proposed
canonical: provisional
visibility: dm-only
created_at: '2026-06-02T18:18:41.924Z'
gateway_build: 'karsac-registry@1.0.0#2026-06-02T18:13:54.434Z'
source_prompt: |-
  Propose a new NPC: a Lösweg road warden stationed on the fjord road north of the Bay of Whales coast.  
  Context:
  
  *   Chapter context: Chapter 3 — encountered on the road to Valweg
      
  *   Role: enforces Lösweg road law; reports to the Valweg council structure
      
  *   Mathr controls the inner council; orders from Valweg have changed in character recently — more about watching certain travellers than protecting the road
      
  *   This warden is not corrupt. They are loyal to Lösweg as they understand it. They do not know what Mathr is.
      
  *   The party arrives with Brynja's letter of introduction and a Mathr token (taken from a housecarl at Törweg south dock)
      
  *   The Mathr token is a problem: it opens doors and raises questions simultaneously
      
  *   Dugweb's annual visit is approaching — road wardens have been told to expect the king's advance party  
      Required NPC elements:
      
  *   Name, role, physical bearing (brief)
      
  *   What they want / what they hide
      
  *   can_know and must_not_know fields
      
  *   3-4 lines to inhabit (voice)
      
  *   Dramatic utility: what makes this character useful at the table beyond an obstacle
      
  *   player_safe and dm_only sections  
      Use the standard NPC proposal format. Treat as provisional planning material.
      
  *
route_profile: npc-design
validation:
  status: pass
  issues: []
related:
  chapters: []
  sessions: []
  factions: []
  places: []
  npcs: []
  items: []
promote_target: corpus/planning/npcs
summary: Astrid Half-Stone
---

# NPC: Astrid Half-Stone

## Role
Lösweg Road Warden, stationed at the toll gate on the fjord road north of the Bay of Whales. Responsible for enforcing Lösweg law, collecting tolls, and reporting to the Valweg Council.

## Physical Bearing
A woman in her late thirties, built sturdy and broad from years of wind and work. Her face is weathered and scarred, with close-cropped, dark hair streaked with grey. She moves with a deliberate, watchful gait, and her hands are calloused and strong. She wears the standard Lösweg warden’s uniform – reinforced leather and chainmail over wool.

## What They Want
Right now: To efficiently process travellers and maintain order at the toll gate. If the situation escalates: To uphold Lösweg law and protect the road from genuine threats. What they are trying to protect: The integrity of Lösweg and its traditions.

## What They Hide
Astrid believes she is upholding a just and necessary system, but she is unknowingly a pawn in Mathr’s machinations. She has no idea that recent directives from Valweg are politically motivated and designed to target specific individuals. She is deeply uncomfortable with the increased scrutiny of travellers, but assumes it is for a vital, unseen reason.

## can_know
- The standard toll rates for each type of vehicle and passenger.
- The names and faces of frequent travellers along the fjord road.
- That Dugweb's advance party is expected soon and that extra vigilance is required.
- The contents of Brynja’s letter of introduction (she recognizes Brynja’s name and status).

## must_not_know
- That Mathr is manipulating the Valweg Council and using the road warden network for his own purposes.
- That the token the party possesses is a symbol of Mathr’s influence, not a legitimate marker of authority.
- The true reason for the increased surveillance of travellers – Mathr is specifically targeting individuals who oppose him.

## Lines to Inhabit
- "Papers, please. And state your business."
- "The road is open to those who pay their due."
- "Something about that token… I don’t recall seeing it before."
- "Valweg has been… particular about certain travellers lately."

## Dramatic Utility
Astrid presents a moral dilemma for the party. She is not inherently malicious, but her loyalty to Lösweg blinds her to the corruption around her. The token introduces immediate suspicion and potential conflict. Her adherence to protocol creates obstacles, but her genuine desire to do what’s right can be exploited. She can be a source of information, albeit potentially misleading, about movements along the road and the mood in Valweg.

## player_safe
Astrid is a stern but fair road warden. She is diligent in her duties and follows protocol. She seems genuinely concerned about upholding the law. She is visibly nervous about the approaching visit of Dugweb's advance party. She recognizes Brynja's name and shows her due respect.

## dm_only
Astrid is fiercely loyal to Lösweg and believes in its principles. She is uncomfortable with the recent changes in Valweg's directives but rationalizes them as necessary for the greater good. Under pressure, she will become increasingly rigid and defensive, clinging to procedure. She will report any unusual activity, especially regarding the token. She is susceptible to manipulation if presented with evidence that aligns with her existing beliefs about justice and order. She has a younger brother who is a skald in Valweg, which is a potential vulnerability.
```yaml
---
id: npcs/astrid-half-stone
type: npc
visibility: dm-only
canonical: provisional
tags: [npc, provisional, road-warden, valweg]
can_know:
  - "The standard toll rates for each type of vehicle and passenger."
  - "The names and faces of frequent travellers along the fjord road."
  - "That Dugweb's advance party is expected soon and that extra vigilance is required."
  - "The contents of Brynja’s letter of introduction (she recognizes Brynja’s name and status)."
must_not_know:
  - "That Mathr is manipulating the Valweg Council and using the road warden network for his own purposes."
  - "That the token the party possesses is a symbol of Mathr’s influence, not a legitimate marker of authority."
  - "The true reason for the increased surveillance of travellers – Mathr is specifically targeting individuals who oppose him."
dm_only:
  - "Fiercely loyal to Lösweg and believes in its principles. Rationalizes Valweg's directives as necessary. Rigid under pressure. Reports unusual activity. Susceptible to manipulation aligning with her beliefs. Has a younger brother who is a skald in Valweg (potential vulnerability)."
related:
  factions: [lowseg]
  places: [valweg, bay-of-whales]
summary: "A loyal Lösweg road warden who unknowingly serves Mathr's agenda, presenting an obstacle and potential source of information for the party."
---
```

## Public Face  
Astrid projects the image of a steadfast Lösweg sentinel—unbending, authoritative, and deeply invested in the road’s traditions. She greets travelers with a curt nod, her voice steady and measured, but her eyes flicker with quiet scrutiny. Her uniform is immaculate, a point of pride, and she carries herself with the rigid posture of someone who has long accepted that duty demands sacrifice. She is quick to cite toll rates and slower to yield, even when faced with appeals or delays.

## Private Want  
Beneath her duty, Astrid craves validation—specifically, the approval of her younger brother, a skald in Valweg who views her role as a relic of a bygone era. She secretly hopes that by upholding Lösweg’s traditions with unwavering resolve, she might prove her worth in his eyes. This desire fuels her strict adherence to protocol, even when it strains her patience or complicates her interactions with travelers.

## Fear  
Astrid fears the erosion of Lösweg’s autonomy. Though she does not yet know Mathr’s machinations, she senses a shift in Valweg’s directives that feels… unnatural. She dreads the possibility that her life’s work—protecting the road—might be reducing it to a tool for unseen forces. Worse still, she fears that her own rigid loyalty could make her complicit in something monstrous.

## Contradiction  
Astrid believes she is safeguarding Lösweg’s integrity by enforcing its laws, yet her actions unknowingly serve Mathr’s agenda. Her faith in tradition blinds her to the possibility that the traditions she upholds are being weaponized. She is both a guardian and a pawn, unaware that her duty to the road may be its undoing.

## Pressure Point  
The Mathr token is a knot she cannot untie. She must inspect it, yet doing so risks revealing her ignorance of its true nature. If she questions it openly, she risks appearing suspicious or disloyal; if she ignores it, she risks failing in her duty to report anomalies. Her loyalty to Valweg’s directives clashes with her instinct to trust her own judgment.

## What They Reveal Under Stress  
When overwhelmed, Astrid’s composure cracks into rigid defensiveness. She becomes hyper-focused on procedural correctness, refusing to entertain exceptions or deviations. Her voice sharpens, and she may even threaten travelers who challenge her authority. Under extreme pressure, she may begin to question her brother’s views or seek reassurance that her actions align with Lösweg’s “true” purpose, revealing a fragile faith in her own role.

