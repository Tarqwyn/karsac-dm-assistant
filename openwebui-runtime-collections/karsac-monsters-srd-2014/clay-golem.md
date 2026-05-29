---
id: "monsters/srd-2014/clay-golem"
type: "monster"
ruleset: "dnd-5e-2014"
canonical: "srd-5.1"
visibility: "dm-and-player"
name: "Clay Golem"
size: "Large"
creature_type: "construct"
alignment: "unaligned"
armour_class: "14 (natural armor)"
hit_points: "133 (14d10 + 56)"
speed: "20 ft."
ability_scores:
  str:
    score: 20
    modifier: 5
  dex:
    score: 9
    modifier: -1
  con:
    score: 18
    modifier: 4
  int:
    score: 3
    modifier: -4
  wis:
    score: 8
    modifier: -1
  cha:
    score: 1
    modifier: -5
senses: "darkvision 60 ft., passive Perception 9"
languages: "understands the languages of its creator but can't speak"
challenge_rating: "9"
xp: 5000
terrain:
  - "ruins"
  - "vault"
  - "stronghold"
  - "manor"
climate:
  - "any"
encounter_roles:
  - "guardian"
  - "attrition"
  - "shock-assault"
  - "frontline-pressure"
combat_role:
  - "guardian"
  - "attrition"
  - "shock-assault"
social_use:
  - "guard duty"
  - "silent evidence"
  - "inheritance complications"
displacement:
  native_to:
    - "vault"
    - "stronghold"
    - "ruins"
  can_move_to:
    - "settlement-edge"
    - "harbor"
    - "archive"
  reasons:
    - "reactivation"
    - "theft"
    - "wizard command"
    - "ward failure"
karsac_fit:
  regions:
    - "torweg"
    - "valweg"
    - "pryzi-mountain-vault"
    - "great-library"
  tone:
    - "crafted-danger"
    - "cold"
    - "artifact-adjacent"
  notes: "Use Clay Golem as a guardian, attrition, shock-assault option when you need pressure around torweg, valweg, pryzi-mountain-vault. Treat this as crafted-danger, cold, artifact-adjacent adaptation guidance rather than canon setting ecology."
traits:
  - "Acid Absorption. Whenever the golem is subjected to acid damage, it takes no damage and instead regains a number of hit points equal to the acid damage dealt."
  - "Berserk. Whenever the golem starts its turn with 60 hit points or fewer, roll a d6. On a 6, the golem goes berserk. On each of its turns while berserk, the golem attacks the nearest creature it can see. If no creature is near enough to move to and attack, the golem attacks an object, with preference for an object smaller than itself. Once the golem goes berserk, it continues to do so until it is destroyed or regains all its hit points."
  - "Immutable Form. The golem is immune to any spell or effect that would alter its form."
  - "Magic Resistance. The golem has advantage on saving throws against spells and other magical effects."
  - "Magic Weapons. The golem's weapon attacks are magical."
actions:
  - "Multiattack. The golem makes two slam attacks."
  - "Slam. Melee Weapon Attack: +8 to hit, reach 5 ft., one target. Hit: 16 (2d10 + 5) bludgeoning damage. If the target is a creature, it must succeed on a DC 15 Constitution saving throw or have its hit point maximum reduced by an amount equal to the damage taken. The target dies if this attack reduces its hit point maximum to 0. The reduction lasts until removed by the greater restoration spell or other magic."
  - "Haste (Recharge 5-6). Until the end of its next turn, the golem magically gains a +2 bonus to its AC, has advantage on Dexterity saving throws, and can use its slam attack as a bonus action."
reactions:
  []
bonus_actions:
  []
legendary_actions:
  []
tags:
  - "monster"
  - "srd"
  - "clay-golem"
  - "construct"
  - "guardian"
  - "attrition"
  - "ruins"
  - "vault"
summary: "Clay Golem is a CR 9 large construct with AC 14 (natural armor), 133 hp, and a guardian, attrition, shock-assault profile; signature actions include Multiattack, Slam."
source:
  title: "D&D SRD 5.1"
  licence: "SRD 5.1 / OGL 1.0a source used by project"
last_updated: "2026-05-28"
damage_immunities: "acid, poison, psychic; bludgeoning, piercing, and slashing from nonmagical attacks that aren't adamantine"
condition_immunities: "charmed, exhaustion, frightened, paralyzed, petrified, poisoned"
---

# Clay Golem

**Rule ID:** `monsters/srd-2014/clay-golem`
**Retrieval Summary:** Clay Golem is a CR 9 large construct with AC 14 (natural armor), 133 hp, and a guardian, attrition, shock-assault profile; signature actions include Multiattack, Slam.

## Mechanical Summary

Clay Golem is a Large construct (unaligned) at CR 9 worth 5000 XP. It has AC 14 (natural armor), 133 (14d10 + 56) hit points, and speed 20 ft.. In play it fits guardian, attrition, shock-assault use, with key traits such as Acid Absorption, Berserk, Immutable Form and actions such as Multiattack, Slam, Haste (Recharge 5-6).

## Stat Block

- **Size/Type/Alignment:** Large construct, unaligned
- **Armor Class:** 14 (natural armor)
- **Hit Points:** 133 (14d10 + 56)
- **Speed:** 20 ft.
- **Ability Scores:** STR 20 (+5), DEX 9 (-1), CON 18 (+4), INT 3 (-4), WIS 8 (-1), CHA 1 (-5)
- **Damage Immunities:** acid, poison, psychic; bludgeoning, piercing, and slashing from nonmagical attacks that aren't adamantine
- **Condition Immunities:** charmed, exhaustion, frightened, paralyzed, petrified, poisoned
- **Senses:** darkvision 60 ft., passive Perception 9
- **Languages:** understands the languages of its creator but can't speak
- **Challenge:** 9 (5000 XP)

### Traits

- **Acid Absorption.** Whenever the golem is subjected to acid damage, it takes no damage and instead regains a number of hit points equal to the acid damage dealt.
- **Berserk.** Whenever the golem starts its turn with 60 hit points or fewer, roll a d6. On a 6, the golem goes berserk. On each of its turns while berserk, the golem attacks the nearest creature it can see. If no creature is near enough to move to and attack, the golem attacks an object, with preference for an object smaller than itself. Once the golem goes berserk, it continues to do so until it is destroyed or regains all its hit points.
- **Immutable Form.** The golem is immune to any spell or effect that would alter its form.
- **Magic Resistance.** The golem has advantage on saving throws against spells and other magical effects.
- **Magic Weapons.** The golem's weapon attacks are magical.

### Actions

- **Multiattack.** The golem makes two slam attacks.
- **Slam.** Melee Weapon Attack: +8 to hit, reach 5 ft., one target. Hit: 16 (2d10 + 5) bludgeoning damage. If the target is a creature, it must succeed on a DC 15 Constitution saving throw or have its hit point maximum reduced by an amount equal to the damage taken. The target dies if this attack reduces its hit point maximum to 0. The reduction lasts until removed by the greater restoration spell or other magic.
- **Haste (Recharge 5-6).** Until the end of its next turn, the golem magically gains a +2 bonus to its AC, has advantage on Dexterity saving throws, and can use its slam attack as a bonus action.

## Encounter Use

Use Clay Golem when you need a guardian, attrition, shock-assault presence in ruins, vault, stronghold, manor spaces. Outside combat it can support scenes built around guard duty, silent evidence.

## Karsac Use Notes

These notes are inferential rather than new canon. In Karsac terms, Clay Golem fits best around torweg, valweg, pryzi-mountain-vault, great-library. Use Clay Golem as a guardian, attrition, shock-assault option when you need pressure around torweg, valweg, pryzi-mountain-vault. Treat this as crafted-danger, cold, artifact-adjacent adaptation guidance rather than canon setting ecology.

## Displacement Logic

Clay Golem reads most naturally as native to vault, stronghold, ruins. It can plausibly be pushed toward settlement-edge, harbor, archive by reactivation, theft, wizard command, ward failure.
