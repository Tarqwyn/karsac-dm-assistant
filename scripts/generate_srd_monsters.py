from __future__ import annotations

import json
import re
import subprocess
import unicodedata
import xml.etree.ElementTree as ET
from collections import Counter
from datetime import date
from pathlib import Path
from typing import Any


SCRIPT_DIR = Path(__file__).resolve().parent
RAG_ROOT = SCRIPT_DIR.parent
ASYLUM_ROOT = RAG_ROOT.parent.parent
PDF_PATH = ASYLUM_ROOT / "SRD-OGL_V5.1.pdf"
BBOX_CACHE = Path("/tmp/srd51-bbox.html")
COLLECTIONS_ROOT = RAG_ROOT / "openwebui-runtime-collections"
SRD_MONSTER_DIR = COLLECTIONS_ROOT / "karsac-monsters-srd-2014"
KARSAC_MONSTER_DIR = COLLECTIONS_ROOT / "karsac-monsters-karsac"
RULES_DATA_DIR = RAG_ROOT / "rules-data"
MONSTERS_JSON_PATH = RULES_DATA_DIR / "monsters.json"
REPORT_PATH = RAG_ROOT / "karsac-registry" / ".karsac-index" / "monster-data-report.md"

NS = {"h": "http://www.w3.org/1999/xhtml"}
SIZES = ("Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan")
FIELD_LABELS = [
    "Saving Throws",
    "Skills",
    "Damage Vulnerabilities",
    "Damage Resistances",
    "Damage Immunities",
    "Condition Immunities",
    "Senses",
    "Languages",
    "Challenge",
]
SECTION_LABELS = {
    "Actions": "actions",
    "Reactions": "reactions",
    "Legendary Actions": "legendary_actions",
    "Bonus Actions": "bonus_actions",
}


def main() -> None:
    ensure_bbox_cache()
    lines = load_monster_lines()
    entries = split_entries(lines)
    monsters = [parse_entry(entry_lines) for entry_lines in entries]

    SRD_MONSTER_DIR.mkdir(parents=True, exist_ok=True)
    KARSAC_MONSTER_DIR.mkdir(parents=True, exist_ok=True)
    RULES_DATA_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)

    for file_path in SRD_MONSTER_DIR.glob("*.md"):
        file_path.unlink()

    for monster in monsters:
        write_monster_markdown(monster)

    write_karsac_placeholder()
    write_monsters_json(monsters)
    write_report(monsters)

    print(f"Generated {len(monsters)} SRD monster files")
    print(f"Wrote {MONSTERS_JSON_PATH}")


def ensure_bbox_cache() -> None:
    if BBOX_CACHE.exists() and BBOX_CACHE.stat().st_mtime >= PDF_PATH.stat().st_mtime:
        return

    subprocess.run(
        ["pdftotext", "-bbox-layout", str(PDF_PATH), str(BBOX_CACHE)],
        check=True,
    )


def load_monster_lines() -> list[str]:
    root = ET.parse(BBOX_CACHE).getroot()
    pages = root.findall(".//h:page", NS)
    lines: list[str] = []
    started = False

    for page in pages:
        words = " ".join((word.text or "") for word in page.findall(".//h:word", NS))
        if "Monsters (A)" in words:
            started = True
        if not started:
            continue

        blocks: list[tuple[float, float, str]] = []
        for block in page.findall(".//h:block", NS):
            text = " ".join((word.text or "") for word in block.findall(".//h:word", NS))
            text = normalize_text(text)
            if not text:
                continue
            if text.startswith("Not for resale."):
                continue
            if text.startswith("System Reference Document 5.1"):
                continue
            if text.startswith("Appendix MM-A:"):
                continue
            if re.match(r"^Monsters \([A-Z]\)$", text):
                continue
            if text.isdigit():
                continue
            blocks.append(
                (
                    float(block.attrib.get("xMin", "0")),
                    float(block.attrib.get("yMin", "0")),
                    text,
                )
            )

        left = sorted((b for b in blocks if b[0] < 300), key=lambda item: (item[1], item[0]))
        right = sorted((b for b in blocks if b[0] >= 300), key=lambda item: (item[1], item[0]))
        for _, _, text in left + right:
            lines.append(text)

    return lines


def split_entries(lines: list[str]) -> list[list[str]]:
    starts: list[int] = []

    for index in range(len(lines) - 2):
        if is_entry_start(lines, index):
            starts.append(index)

    entries: list[list[str]] = []
    for idx, start in enumerate(starts):
        end = starts[idx + 1] if idx + 1 < len(starts) else len(lines)
        entries.append(trim_entry_lines(lines[start:end]))
    return entries


def is_entry_start(lines: list[str], index: int) -> bool:
    descriptor = lines[index + 1]
    return (
        any(descriptor.startswith(size + " ") for size in SIZES)
        and lines[index + 2].startswith("Armor Class ")
    )


def trim_entry_lines(lines: list[str]) -> list[str]:
    trimmed = list(lines)
    while trimmed and is_taxonomy_header(trimmed[-1]):
        trimmed.pop()
    return trimmed


def is_taxonomy_header(line: str) -> bool:
    if line in SECTION_LABELS:
        return False
    if any(line.startswith(size + " ") for size in SIZES):
        return False
    if detect_field_label(line):
        return False
    if re.search(r"[0-9:,.()]", line):
        return False
    return bool(re.fullmatch(r"[A-Z][A-Za-z'/-]*(?: [A-Z][A-Za-z'/-]*){0,3}", line))


def parse_entry(lines: list[str]) -> dict[str, Any]:
    name = clean_name(lines[0])
    slug = slugify(name)
    monster_id = f"monsters/srd-2014/{slug}"
    size, creature_type, alignment = parse_descriptor(lines[1])

    armour_class = lines[2].removeprefix("Armor Class ").strip()
    hit_points = lines[3].removeprefix("Hit Points ").strip()
    speed = lines[4].removeprefix("Speed ").strip()

    idx = 5
    if idx < len(lines) and lines[idx] == "STR DEX CON INT WIS CHA":
        idx += 1

    ability_line = lines[idx]
    while count_ability_scores(ability_line) < 6 and idx + 1 < len(lines):
        idx += 1
        ability_line = f"{ability_line} {lines[idx]}"
    ability_scores = parse_ability_scores(ability_line)
    idx += 1

    field_values: dict[str, str] = {}
    current_field: str | None = None
    while idx < len(lines):
        line = lines[idx]
        if line in SECTION_LABELS:
            break
        field_label = detect_field_label(line)
        if field_label:
            current_field = field_label
            field_values[field_label] = line[len(field_label) :].strip()
            idx += 1
            continue
        if current_field and not looks_like_feature_start(line):
            field_values[current_field] = f"{field_values[current_field]} {line}".strip()
            idx += 1
            continue
        break

    sections: dict[str, list[str]] = {
        "traits": [],
        "actions": [],
        "reactions": [],
        "legendary_actions": [],
        "bonus_actions": [],
    }
    section_notes: dict[str, str] = {}
    current_section = "traits"
    current_feature: str | None = None

    while idx < len(lines):
        line = lines[idx]
        if line in SECTION_LABELS:
            if current_feature:
                sections[current_section].append(current_feature.strip())
                current_feature = None
            current_section = SECTION_LABELS[line]
            idx += 1
            continue

        if current_section == "legendary_actions" and is_legendary_note(line):
            existing = section_notes.get(current_section, "")
            section_notes[current_section] = f"{existing} {line}".strip()
            idx += 1
            continue

        if looks_like_feature_start(line):
            if current_feature:
                sections[current_section].append(current_feature.strip())
            current_feature = line
        else:
            if current_feature:
                current_feature = f"{current_feature} {line}".strip()
            else:
                existing = section_notes.get(current_section, "")
                section_notes[current_section] = f"{existing} {line}".strip()
        idx += 1

    if current_feature:
        sections[current_section].append(current_feature.strip())

    challenge_rating, xp = parse_challenge(field_values.get("Challenge", ""))
    ecology = infer_ecology(name, size, creature_type, alignment, speed, challenge_rating, sections)

    summary = build_summary(name, size, creature_type, challenge_rating, armour_class, hit_points, ecology["roles"], sections)
    mechanical_summary = build_mechanical_summary(
        name, size, creature_type, alignment, challenge_rating, xp, armour_class, hit_points, speed, ecology["roles"], sections
    )
    encounter_use = build_encounter_use(name, ecology)
    karsac_notes = build_karsac_notes(name, ecology)
    displacement_logic = build_displacement_logic(name, ecology)

    monster = {
        "id": monster_id,
        "slug": slug,
        "name": name,
        "size": size,
        "creature_type": creature_type,
        "alignment": alignment,
        "armour_class": armour_class,
        "hit_points": hit_points,
        "speed": speed,
        "ability_scores": ability_scores,
        "saving_throws": field_values.get("Saving Throws"),
        "skills": field_values.get("Skills"),
        "damage_vulnerabilities": field_values.get("Damage Vulnerabilities"),
        "damage_resistances": field_values.get("Damage Resistances"),
        "damage_immunities": field_values.get("Damage Immunities"),
        "condition_immunities": field_values.get("Condition Immunities"),
        "senses": field_values.get("Senses", ""),
        "languages": field_values.get("Languages", ""),
        "challenge_rating": challenge_rating,
        "xp": xp,
        "traits": sections["traits"],
        "actions": sections["actions"],
        "reactions": sections["reactions"],
        "bonus_actions": sections["bonus_actions"],
        "legendary_actions": sections["legendary_actions"],
        "legendary_actions_note": section_notes.get("legendary_actions"),
        "terrain": ecology["terrain"],
        "climate": ecology["climate"],
        "encounter_roles": ecology["roles"],
        "combat_role": ecology["combat_role"],
        "social_use": ecology["social_use"],
        "displacement": ecology["displacement"],
        "karsac_fit": ecology["karsac_fit"],
        "tags": build_tags(slug, creature_type, ecology["roles"], ecology["terrain"]),
        "summary": summary,
        "mechanical_summary": mechanical_summary,
        "encounter_use": encounter_use,
        "karsac_notes": karsac_notes,
        "displacement_logic": displacement_logic,
        "source": {
            "title": "D&D SRD 5.1",
            "licence": "SRD 5.1 / OGL 1.0a source used by project",
        },
    }
    return monster


def parse_descriptor(descriptor: str) -> tuple[str, str, str]:
    match = re.match(rf"^({'|'.join(SIZES)}) (.+), ([^,]+(?: [^,]+)*)$", descriptor)
    if not match:
        raise ValueError(f"Unable to parse descriptor: {descriptor}")
    return match.group(1), match.group(2), match.group(3)


def count_ability_scores(line: str) -> int:
    return len(re.findall(r"\d+\s*\([+-]\d+\)", line))


def parse_ability_scores(line: str) -> dict[str, dict[str, int]]:
    matches = re.findall(r"(\d+)\s*\(([+-]\d+)\)", line)
    if len(matches) != 6:
        raise ValueError(f"Unable to parse ability scores from: {line}")
    keys = ["str", "dex", "con", "int", "wis", "cha"]
    return {
        key: {"score": int(score), "modifier": int(modifier)}
        for key, (score, modifier) in zip(keys, matches, strict=True)
    }


def detect_field_label(line: str) -> str | None:
    for label in FIELD_LABELS:
        if line.startswith(label + " "):
            return label
    return None


def parse_challenge(challenge_text: str) -> tuple[str, int]:
    match = re.match(r"^([0-9/]+)\s*\(([\d,]+)\s*XP\)$", challenge_text)
    if not match:
        raise ValueError(f"Unable to parse challenge line: {challenge_text}")
    return match.group(1), int(match.group(2).replace(",", ""))


def looks_like_feature_start(line: str) -> bool:
    return bool(re.match(r"^[A-Z][A-Za-z0-9'(),/ -]+\. ", line))


def is_legendary_note(line: str) -> bool:
    lower = line.lower()
    return lower.startswith("the ") and "legendary actions" in lower


def build_summary(
    name: str,
    size: str,
    creature_type: str,
    challenge_rating: str,
    armour_class: str,
    hit_points: str,
    roles: list[str],
    sections: dict[str, list[str]],
) -> str:
    headline_roles = ", ".join(roles[:3])
    action_names = ", ".join(feature_name(action) for action in sections["actions"][:2])
    if action_names:
        return (
            f"{name} is a CR {challenge_rating} {size.lower()} {creature_type} with AC {armour_class}, "
            f"{hit_points.split(' ')[0]} hp, and {indefinite_article(headline_roles)} {headline_roles} profile; "
            f"signature actions include {action_names}."
        )
    return (
        f"{name} is a CR {challenge_rating} {size.lower()} {creature_type} with AC {armour_class}, "
        f"{hit_points.split(' ')[0]} hp, and {indefinite_article(headline_roles)} {headline_roles} profile."
    )


def build_mechanical_summary(
    name: str,
    size: str,
    creature_type: str,
    alignment: str,
    challenge_rating: str,
    xp: int,
    armour_class: str,
    hit_points: str,
    speed: str,
    roles: list[str],
    sections: dict[str, list[str]],
) -> str:
    trait_names = ", ".join(feature_name(trait) for trait in sections["traits"][:3]) or "its base stat block features"
    action_names = ", ".join(feature_name(action) for action in sections["actions"][:3]) or "its listed actions"
    role_text = ", ".join(roles[:3])
    return (
        f"{name} is a {size} {creature_type} ({alignment}) at CR {challenge_rating} worth {xp} XP. "
        f"It has AC {armour_class}, {hit_points} hit points, and speed {speed}. "
        f"In play it fits {role_text} use, with key traits such as {trait_names} and actions such as {action_names}."
    )


def build_encounter_use(name: str, ecology: dict[str, Any]) -> str:
    terrains = ", ".join(ecology["terrain"][:4])
    roles = ", ".join(ecology["roles"][:3])
    social_use = ", ".join(ecology["social_use"][:2])
    return (
        f"Use {name} when you need {indefinite_article(roles)} {roles} presence in {terrains} spaces. "
        f"Outside combat it can support scenes built around {social_use}."
    )


def build_karsac_notes(name: str, ecology: dict[str, Any]) -> str:
    regions = ", ".join(ecology["karsac_fit"]["regions"][:4])
    notes = ecology["karsac_fit"]["notes"]
    return (
        f"These notes are inferential rather than new canon. In Karsac terms, {name} fits best around {regions}. "
        f"{notes}"
    )


def build_displacement_logic(name: str, ecology: dict[str, Any]) -> str:
    native_to = ", ".join(ecology["displacement"]["native_to"][:4])
    can_move_to = ", ".join(ecology["displacement"]["can_move_to"][:4])
    reasons = ", ".join(ecology["displacement"]["reasons"][:4])
    return (
        f"{name} reads most naturally as native to {native_to}. "
        f"It can plausibly be pushed toward {can_move_to} by {reasons}."
    )


def build_tags(slug: str, creature_type: str, roles: list[str], terrain: list[str]) -> list[str]:
    tags = ["monster", "srd", slug]
    base_type = creature_type.split("(", 1)[0].strip().replace(" ", "-")
    tags.append(base_type)
    tags.extend(roles[:2])
    tags.extend(terrain[:2])
    deduped: list[str] = []
    for tag in tags:
        clean = slugify(tag).replace("/", "-")
        if clean and clean not in deduped:
            deduped.append(clean)
    return deduped


def infer_ecology(
    name: str,
    size: str,
    creature_type: str,
    alignment: str,
    speed: str,
    challenge_rating: str,
    sections: dict[str, list[str]],
) -> dict[str, Any]:
    lower_name = name.lower()
    lower_type = creature_type.lower()
    roles: list[str] = []
    terrain: list[str] = []
    climate: list[str] = []
    native_to: list[str] = []
    can_move_to: list[str] = []
    reasons: list[str] = []
    regions: list[str] = []
    tone: list[str] = []
    social_use: list[str] = []

    def add_many(target: list[str], values: list[str]) -> None:
        for value in values:
            if value and value not in target:
                target.append(value)

    if "dragon" in lower_type or "dragon" in lower_name:
        add_many(roles, ["apex-predator", "siege", "territorial-threat"])
        add_many(terrain, ["mountain", "ruins", "coast", "sky"])
        add_many(climate, ["temperate", "cold", "arid"])
        add_many(native_to, ["mountain", "ruins", "cavern", "coast"])
        add_many(can_move_to, ["settlement-edge", "road", "harbor", "highland"])
        add_many(reasons, ["territorial pressure", "hoard disruption", "magical disturbance", "scarcity"])
        add_many(regions, ["stormwatch-mountains", "the-maw", "bay-of-whales", "sea-of-karsac"])
        add_many(tone, ["mythic", "weather-shaped", "ruin-heavy"])
        add_many(social_use, ["tribute politics", "omens", "territorial bargaining"])
        if "white dragon" in lower_name or "silver dragon" in lower_name or "remorhaz" in lower_name:
            add_many(terrain, ["tundra"])
            add_many(climate, ["cold"])
        if "black dragon" in lower_name or "green dragon" in lower_name:
            add_many(terrain, ["swamp", "forest"])
        if "blue dragon" in lower_name or "brass dragon" in lower_name:
            add_many(terrain, ["desert"])
            add_many(climate, ["arid"])
        if "bronze dragon" in lower_name or "dragon turtle" in lower_name:
            add_many(terrain, ["sea", "coast"])
            add_many(regions, ["bay-of-whales", "sea-of-karsac", "torweg"])
    elif "fiend" in lower_type or "devil" in lower_type or "demon" in lower_type or lower_name in {
        "balor",
        "dretch",
        "glabrezu",
        "hezrou",
        "marilith",
        "nalfeshnee",
        "quasit",
        "vrock",
        "barbed devil",
        "bearded devil",
        "bone devil",
        "chain devil",
        "erinyes",
        "horned devil",
        "ice devil",
        "imp",
        "lemure",
        "pit fiend",
        "nightmare",
        "rakshasa",
        "succubus/incubus",
    }:
        add_many(roles, ["shock-assault", "controller", "corruptor"])
        add_many(terrain, ["ruins", "stronghold", "shrine", "battlefield"])
        add_many(climate, ["any"])
        add_many(native_to, ["planar-breach", "stronghold", "ritual-site"])
        add_many(can_move_to, ["settlement-edge", "harbor", "road", "court"])
        add_many(reasons, ["ritual breach", "pact-binding", "war", "magical disturbance"])
        add_many(regions, ["the-maw", "torweg", "valweg", "prizober"])
        add_many(tone, ["uncanny", "moral-corrosion", "high-danger"])
        add_many(social_use, ["temptation", "interrogation", "bargain scenes"])
    elif "undead" in lower_type or lower_name in {
        "ghost",
        "ghast",
        "ghoul",
        "lich",
        "mummy",
        "mummy lord",
        "skeleton",
        "minotaur skeleton",
        "warhorse skeleton",
        "specter",
        "shadow",
        "wight",
        "will-o'-wisp",
        "wraith",
        "zombie",
        "ogre zombie",
        "vampire",
        "vampire spawn",
    }:
        add_many(roles, ["attrition", "fear-pressure", "night-threat"])
        add_many(terrain, ["graveyard", "ruins", "crypt", "settlement-edge"])
        add_many(climate, ["cold", "temperate"])
        add_many(native_to, ["graveyard", "crypt", "ruins"])
        add_many(can_move_to, ["road", "coast", "village-edge", "harbor"])
        add_many(reasons, ["restless dead", "necromancy", "unburied war dead", "fog-bound nights"])
        add_many(regions, ["the-maw", "torweg", "valweg", "stormwatch-mountains"])
        add_many(tone, ["bleak", "haunting", "practical-danger"])
        add_many(social_use, ["omens", "burial complications", "memory echoes"])
    elif "beast" in lower_type:
        add_many(roles, ["ambusher", "pursuit", "territorial-threat"])
        add_many(terrain, ["forest", "hills", "grassland"])
        add_many(climate, ["temperate"])
        add_many(native_to, ["forest", "hills", "grassland"])
        add_many(can_move_to, ["road", "settlement-edge", "coast"])
        add_many(reasons, ["hunger", "winter", "territorial pressure", "storm disruption"])
        add_many(regions, ["losweg", "stormwatch-mountains", "torweg"])
        add_many(tone, ["grounded", "weather-shaped", "practical-danger"])
        add_many(social_use, ["tracking signs", "hunting pressure", "livestock threat"])
        if any(word in lower_name for word in ["wolf", "worg", "hyena", "jackal", "lion", "tiger", "panther", "bear", "ape", "cat"]):
            add_many(roles, ["pack-predator", "ambusher"])
        if any(word in lower_name for word in ["eagle", "hawk", "owl", "vulture", "bat", "hippogriff", "griffon"]):
            add_many(terrain, ["mountain", "sky", "coast"])
            add_many(roles, ["aerial-hunter", "scout"])
        if any(word in lower_name for word in ["shark", "whale", "sea horse", "octopus", "quipper", "plesiosaurus", "crocodile", "reef"]):
            add_many(terrain, ["sea", "coast", "river", "marsh"])
            add_many(climate, ["coastal", "temperate"])
            add_many(native_to, ["sea", "coast", "river"])
            add_many(can_move_to, ["harbor", "fjord", "shoreline"])
            add_many(regions, ["bay-of-whales", "sea-of-karsac", "torweg"])
            add_many(social_use, ["fishing pressure", "omens", "wreck scenes"])
        if any(word in lower_name for word in ["spider", "scorpion", "snake", "toad", "frog", "lizard"]):
            add_many(terrain, ["swamp", "cavern", "ruins"])
            add_many(roles, ["lurker", "area-denial"])
        if any(word in lower_name for word in ["polar", "mammoth", "winter"]):
            add_many(terrain, ["tundra", "mountain"])
            add_many(climate, ["cold"])
            add_many(regions, ["stormwatch-mountains", "losweg", "bay-of-whales"])
        if "swarm" in lower_name:
            add_many(roles, ["swarm", "attrition"])
            add_many(social_use, ["filth signal", "panic pressure"])
    elif "humanoid" in lower_type:
        add_many(roles, ["skirmisher", "raider", "sentry"])
        add_many(terrain, ["road", "forest", "hills", "settlement-edge"])
        add_many(climate, ["temperate", "cold"])
        add_many(native_to, ["road", "forest", "hills"])
        add_many(can_move_to, ["village-edge", "harbor", "ruins"])
        add_many(reasons, ["raiding pressure", "migration", "hunger", "command pressure"])
        add_many(regions, ["losweg", "torweg", "valweg", "stormwatch-mountains"])
        add_many(tone, ["grounded", "violent", "practical-danger"])
        add_many(social_use, ["negotiation", "prisoners", "local politics"])
        if any(word in lower_name for word in ["archmage", "mage", "priest", "druid", "cult fanatic", "acolyte"]):
            add_many(roles, ["spellcaster", "support", "leader"])
            add_many(social_use, ["ritual scenes", "faction leverage", "counsel"])
        if any(word in lower_name for word in ["assassin", "spy", "scout", "bandit"]):
            add_many(roles, ["infiltrator", "ambusher", "scout"])
    elif "giant" in lower_type or "giant" in lower_name or lower_name in {"ettin", "ogre", "oni", "troll", "cyclops"}:
        add_many(roles, ["bruiser", "siege", "territorial-threat"])
        add_many(terrain, ["mountain", "hills", "forest", "coast"])
        add_many(climate, ["cold", "temperate"])
        add_many(native_to, ["mountain", "hills", "forest"])
        add_many(can_move_to, ["road", "village-edge", "harbor"])
        add_many(reasons, ["scarcity", "tribute pressure", "territorial pressure", "storm damage"])
        add_many(regions, ["stormwatch-mountains", "the-maw", "losweg", "bay-of-whales"])
        add_many(tone, ["mythic", "weather-shaped", "hard-country"])
        add_many(social_use, ["tribute demands", "trail signs", "structural damage"])
        if "storm giant" in lower_name:
            add_many(terrain, ["sea", "sky"])
            add_many(regions, ["sea-of-karsac", "bay-of-whales"])
    elif "aberration" in lower_type or lower_name in {
        "aboleth",
        "chuul",
        "gibbering mouther",
        "grick",
        "otyugh",
        "roper",
    }:
        add_many(roles, ["controller", "lurker", "uncanny-predator"])
        add_many(terrain, ["cavern", "deep-water", "ruins", "swamp"])
        add_many(climate, ["cold", "temperate", "subterranean"])
        add_many(native_to, ["cavern", "deep-water", "ruins"])
        add_many(can_move_to, ["coast", "fjord", "sewer", "roadside-ruin"])
        add_many(reasons, ["magical disturbance", "earth-shift", "flooding", "pressure from below"])
        add_many(regions, ["the-maw", "stormwatch-mountains", "bay-of-whales", "torweg"])
        add_many(tone, ["uncanny", "pressure-from-below", "wrongness"])
        add_many(social_use, ["omens", "disturbing evidence", "madness traces"])
    elif "construct" in lower_type or lower_name in {
        "animated armor",
        "flying sword",
        "rug of smothering",
        "shield guardian",
        "homunculus",
    }:
        add_many(roles, ["guardian", "attrition", "shock-assault"])
        add_many(terrain, ["ruins", "vault", "stronghold", "manor"])
        add_many(climate, ["any"])
        add_many(native_to, ["vault", "stronghold", "ruins"])
        add_many(can_move_to, ["settlement-edge", "harbor", "archive"])
        add_many(reasons, ["reactivation", "theft", "wizard command", "ward failure"])
        add_many(regions, ["torweg", "valweg", "pryzi-mountain-vault", "great-library"])
        add_many(tone, ["crafted-danger", "cold", "artifact-adjacent"])
        add_many(social_use, ["guard duty", "silent evidence", "inheritance complications"])
    elif "elemental" in lower_type or lower_name in {
        "djinni",
        "efreeti",
        "invisible stalker",
        "magmin",
        "salamander",
        "xorn",
        "azer",
        "mephit",
    }:
        add_many(roles, ["controller", "hazard", "shock-assault"])
        add_many(terrain, ["storm", "mountain", "coast", "volcanic-vent"])
        add_many(climate, ["any"])
        add_many(native_to, ["storm-front", "deep-earth", "forge", "sea-cave"])
        add_many(can_move_to, ["harbor", "road", "watchtower", "mine"])
        add_many(reasons, ["binding failure", "ritual breach", "industrial disturbance", "unnatural weather"])
        add_many(regions, ["stormwatch-mountains", "torweg", "bay-of-whales", "the-maw"])
        add_many(tone, ["volatile", "weather-shaped", "high-danger"])
        add_many(social_use, ["omens", "trade disruption", "ritual leverage"])
    elif "fey" in lower_type or lower_name in {
        "dryad",
        "green hag",
        "night hag",
        "sea hag",
        "satyr",
        "sprite",
        "unicorn",
    }:
        add_many(roles, ["controller", "social-threat", "skirmisher"])
        add_many(terrain, ["forest", "swamp", "coast", "standing-stone"])
        add_many(climate, ["temperate", "cold"])
        add_many(native_to, ["forest", "swamp", "coast"])
        add_many(can_move_to, ["village-edge", "road", "harbor"])
        add_many(reasons, ["bargain gone wrong", "blighted woods", "shoreline disturbance", "fog pressure"])
        add_many(regions, ["zorsdkog", "losweg", "bay-of-whales", "torweg"])
        add_many(tone, ["uncanny", "folkloric", "weather-shaped"])
        add_many(social_use, ["bargains", "omens", "curse hooks"])
    elif "ooze" in lower_type or lower_name in {"black pudding", "gelatinous cube", "gray ooze", "ochre jelly"}:
        add_many(roles, ["attrition", "hazard", "area-denial"])
        add_many(terrain, ["sewer", "ruins", "cavern", "dungeon"])
        add_many(climate, ["subterranean", "cold"])
        add_many(native_to, ["cavern", "ruins", "dungeon"])
        add_many(can_move_to, ["cellar", "harbor-warehouse", "mine"])
        add_many(reasons, ["waste buildup", "cave collapse", "neglect", "magical seepage"])
        add_many(regions, ["torweg", "the-maw", "pryzi-mountain-vault"])
        add_many(tone, ["filthy", "industrial", "claustrophobic"])
        add_many(social_use, ["cleanup failure", "missing workers", "contaminated stores"])
    elif "plant" in lower_type or "fungus" in lower_type or lower_name in {"shambling mound", "treant", "awakened shrub", "awakened tree"}:
        add_many(roles, ["guardian", "area-denial", "ambusher"])
        add_many(terrain, ["forest", "swamp", "ruins"])
        add_many(climate, ["temperate", "cold", "humid"])
        add_many(native_to, ["forest", "swamp", "ruins"])
        add_many(can_move_to, ["road", "village-edge", "graveyard"])
        add_many(reasons, ["blight", "woodcutting pressure", "magical disturbance", "flooding"])
        add_many(regions, ["zorsdkog", "losweg", "stormwatch-mountains"])
        add_many(tone, ["ancient", "folkloric", "slow-danger"])
        add_many(social_use, ["blighted groves", "omens", "resource pressure"])
    else:
        add_many(roles, ["skirmisher", "hazard", "ambusher"])
        add_many(terrain, ["ruins", "forest", "coast"])
        add_many(climate, ["temperate", "cold"])
        add_many(native_to, ["ruins", "forest", "coast"])
        add_many(can_move_to, ["road", "settlement-edge", "harbor"])
        add_many(reasons, ["scarcity", "magical disturbance", "territorial pressure", "migration"])
        add_many(regions, ["losweg", "torweg", "stormwatch-mountains"])
        add_many(tone, ["practical-danger", "uncertain", "weather-shaped"])
        add_many(social_use, ["omens", "local rumor", "travel hazard"])

    if "swim" in speed.lower():
        add_many(terrain, ["sea", "coast", "river"])
        add_many(native_to, ["sea", "coast", "river"])
        add_many(can_move_to, ["harbor", "fjord", "shoreline"])
        add_many(regions, ["bay-of-whales", "sea-of-karsac", "torweg"])
    if "fly" in speed.lower():
        add_many(terrain, ["sky", "cliff", "mountain"])
        add_many(can_move_to, ["watchtower", "harbor", "road"])
        add_many(roles, ["aerial-pressure"])
    if fraction_to_float(challenge_rating) >= 10:
        add_many(tone, ["set-piece"])
        add_many(social_use, ["regional fear", "major omens"])
    if any(feature_name(action).lower() == "multiattack" for action in sections["actions"]):
        add_many(roles, ["frontline-pressure"])
    if "any alignment" in alignment.lower():
        add_many(social_use, ["mercenary use", "variable motives"])

    combat_role = roles[:3]
    return {
        "terrain": terrain[:6],
        "climate": climate[:4],
        "roles": roles[:6],
        "combat_role": combat_role,
        "social_use": social_use[:4],
        "displacement": {
            "native_to": native_to[:6],
            "can_move_to": can_move_to[:6],
            "reasons": reasons[:6],
        },
        "karsac_fit": {
            "regions": regions[:6],
            "tone": tone[:4],
            "notes": build_karsac_fit_note(name, roles, regions, tone),
        },
    }


def build_karsac_fit_note(name: str, roles: list[str], regions: list[str], tone: list[str]) -> str:
    role_text = ", ".join(roles[:3]) or "local threat"
    region_text = ", ".join(regions[:3]) or "the current chapter map"
    tone_text = ", ".join(tone[:3]) or "provisional"
    return (
        f"Use {name} as {indefinite_article(role_text)} {role_text} option when you need pressure around {region_text}. "
        f"Treat this as {tone_text} adaptation guidance rather than canon setting ecology."
    )


def feature_name(feature: str) -> str:
    return feature.split(". ", 1)[0].strip()


def indefinite_article(text: str) -> str:
    return "an" if text[:1].lower() in {"a", "e", "i", "o", "u"} else "a"


def fraction_to_float(value: str) -> float:
    if "/" in value:
        left, right = value.split("/", 1)
        return float(left) / float(right)
    return float(value)


def clean_name(name: str) -> str:
    name = normalize_text(name)
    name = name.replace(" / ", "/")
    name = name.replace(",  ", ", ")
    name = name.replace("- ", "-")
    return name


def normalize_text(text: str) -> str:
    replacements = {
        "\xa0": " ",
        "‐": "-",
        "‑": "-",
        "–": "-",
        "—": "-",
        "−": "-",
        "“": '"',
        "”": '"',
        "’": "'",
        "‘": "'",
        "\u00ad": "",
    }
    for src, dest in replacements.items():
        text = text.replace(src, dest)
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    return " ".join(text.split())


def slugify(text: str) -> str:
    text = normalize_text(text).lower()
    text = text.replace("/", "-")
    text = text.replace(",", "")
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def yaml_quote(text: str) -> str:
    return json.dumps(text, ensure_ascii=True)


def yaml_scalar(value: Any, indent: int = 0) -> list[str]:
    prefix = " " * indent
    if value is None:
        return [f"{prefix}null"]
    if isinstance(value, bool):
        return [f"{prefix}{str(value).lower()}"]
    if isinstance(value, (int, float)):
        return [f"{prefix}{value}"]
    if isinstance(value, str):
        return [f"{prefix}{yaml_quote(value)}"]
    if isinstance(value, list):
        if not value:
            return [f"{prefix}[]"]
        lines: list[str] = []
        for item in value:
            if isinstance(item, (dict, list)):
                lines.append(f"{prefix}-")
                lines.extend(yaml_scalar(item, indent + 2))
            else:
                rendered = yaml_scalar(item, 0)[0]
                lines.append(f"{prefix}- {rendered}")
        return lines
    if isinstance(value, dict):
        if not value:
            return [f"{prefix}{{}}"]
        lines: list[str] = []
        for key, item in value.items():
            if isinstance(item, (dict, list)):
                lines.append(f"{prefix}{key}:")
                lines.extend(yaml_scalar(item, indent + 2))
            else:
                rendered = yaml_scalar(item, 0)[0]
                lines.append(f"{prefix}{key}: {rendered}")
        return lines
    raise TypeError(f"Unsupported YAML value: {value!r}")


def render_frontmatter(monster: dict[str, Any]) -> str:
    ordered = {
        "id": monster["id"],
        "type": "monster",
        "ruleset": "dnd-5e-2014",
        "canonical": "srd-5.1",
        "visibility": "dm-and-player",
        "name": monster["name"],
        "size": monster["size"],
        "creature_type": monster["creature_type"],
        "alignment": monster["alignment"],
        "armour_class": monster["armour_class"],
        "hit_points": monster["hit_points"],
        "speed": monster["speed"],
        "ability_scores": monster["ability_scores"],
        "saving_throws": monster["saving_throws"],
        "skills": monster["skills"],
        "senses": monster["senses"],
        "languages": monster["languages"],
        "challenge_rating": monster["challenge_rating"],
        "xp": monster["xp"],
        "terrain": monster["terrain"],
        "climate": monster["climate"],
        "encounter_roles": monster["encounter_roles"],
        "combat_role": monster["combat_role"],
        "social_use": monster["social_use"],
        "displacement": monster["displacement"],
        "karsac_fit": monster["karsac_fit"],
        "traits": monster["traits"],
        "actions": monster["actions"],
        "reactions": monster["reactions"],
        "bonus_actions": monster["bonus_actions"],
        "legendary_actions": monster["legendary_actions"],
        "tags": monster["tags"],
        "summary": monster["summary"],
        "source": monster["source"],
        "last_updated": str(date.today()),
    }

    for optional_key in ["damage_vulnerabilities", "damage_resistances", "damage_immunities", "condition_immunities", "legendary_actions_note"]:
        value = monster.get(optional_key)
        if value:
            ordered[optional_key] = value

    lines = ["---"]
    for key, value in ordered.items():
        if value is None:
            continue
        lines.extend(yaml_scalar({key: value}))
    lines.append("---")
    return "\n".join(lines)


def write_monster_markdown(monster: dict[str, Any]) -> None:
    frontmatter = render_frontmatter(monster)
    body_lines = [
        f"# {monster['name']}",
        "",
        f"**Rule ID:** `{monster['id']}`",
        f"**Retrieval Summary:** {monster['summary']}",
        "",
        "## Mechanical Summary",
        "",
        monster["mechanical_summary"],
        "",
        "## Stat Block",
        "",
        f"- **Size/Type/Alignment:** {monster['size']} {monster['creature_type']}, {monster['alignment']}",
        f"- **Armor Class:** {monster['armour_class']}",
        f"- **Hit Points:** {monster['hit_points']}",
        f"- **Speed:** {monster['speed']}",
        f"- **Ability Scores:** {format_ability_scores(monster['ability_scores'])}",
    ]

    if monster["saving_throws"]:
        body_lines.append(f"- **Saving Throws:** {monster['saving_throws']}")
    if monster["skills"]:
        body_lines.append(f"- **Skills:** {monster['skills']}")
    if monster["damage_vulnerabilities"]:
        body_lines.append(f"- **Damage Vulnerabilities:** {monster['damage_vulnerabilities']}")
    if monster["damage_resistances"]:
        body_lines.append(f"- **Damage Resistances:** {monster['damage_resistances']}")
    if monster["damage_immunities"]:
        body_lines.append(f"- **Damage Immunities:** {monster['damage_immunities']}")
    if monster["condition_immunities"]:
        body_lines.append(f"- **Condition Immunities:** {monster['condition_immunities']}")
    body_lines.extend(
        [
            f"- **Senses:** {monster['senses']}",
            f"- **Languages:** {monster['languages']}",
            f"- **Challenge:** {monster['challenge_rating']} ({monster['xp']} XP)",
            "",
        ]
    )

    add_feature_section(body_lines, "Traits", monster["traits"])
    add_feature_section(body_lines, "Actions", monster["actions"])
    if monster["bonus_actions"]:
        add_feature_section(body_lines, "Bonus Actions", monster["bonus_actions"])
    if monster["reactions"]:
        add_feature_section(body_lines, "Reactions", monster["reactions"])
    if monster["legendary_actions"]:
        body_lines.append("### Legendary Actions")
        body_lines.append("")
        if monster["legendary_actions_note"]:
            body_lines.append(monster["legendary_actions_note"])
            body_lines.append("")
        for feature in monster["legendary_actions"]:
            body_lines.append(f"- **{feature_name(feature)}.** {feature.split('. ', 1)[1] if '. ' in feature else feature}")
        body_lines.append("")

    body_lines.extend(
        [
            "## Encounter Use",
            "",
            monster["encounter_use"],
            "",
            "## Karsac Use Notes",
            "",
            monster["karsac_notes"],
            "",
            "## Displacement Logic",
            "",
            monster["displacement_logic"],
            "",
        ]
    )

    out_path = SRD_MONSTER_DIR / f"{monster['slug']}.md"
    out_path.write_text(frontmatter + "\n\n" + "\n".join(body_lines), encoding="utf-8")


def add_feature_section(body_lines: list[str], heading: str, features: list[str]) -> None:
    body_lines.append(f"### {heading}")
    body_lines.append("")
    if not features:
        body_lines.append("- None.")
        body_lines.append("")
        return
    for feature in features:
        if ". " in feature:
            name, text = feature.split(". ", 1)
            body_lines.append(f"- **{name}.** {text}")
        else:
            body_lines.append(f"- {feature}")
    body_lines.append("")


def format_ability_scores(ability_scores: dict[str, dict[str, int]]) -> str:
    parts = []
    for key in ["str", "dex", "con", "int", "wis", "cha"]:
        data = ability_scores[key]
        parts.append(f"{key.upper()} {data['score']} ({data['modifier']:+d})")
    return ", ".join(parts)


def write_karsac_placeholder() -> None:
    text = """# Karsac Monsters

No Karsac-original monster conversions have been added yet.

This collection exists so Karsac-specific creatures can be added later without mixing them into the SRD 2014 monster corpus.
"""
    (KARSAC_MONSTER_DIR / "README.md").write_text(text, encoding="utf-8")


def write_monsters_json(monsters: list[dict[str, Any]]) -> None:
    payload: dict[str, Any] = {}
    for monster in monsters:
        payload[monster["slug"]] = {
            "id": monster["id"],
            "name": monster["name"],
            "ruleset": "dnd-5e-2014",
            "canonical": "srd-5.1",
            "cr": fraction_to_float(monster["challenge_rating"]),
            "xp": monster["xp"],
            "size": monster["size"],
            "type": monster["creature_type"],
            "alignment": monster["alignment"],
            "terrain": monster["terrain"],
            "climate": monster["climate"],
            "roles": monster["encounter_roles"],
            "combatRole": monster["combat_role"],
            "socialUse": monster["social_use"],
            "displacement": {
                "nativeTo": monster["displacement"]["native_to"],
                "canMoveTo": monster["displacement"]["can_move_to"],
                "reasons": monster["displacement"]["reasons"],
            },
            "karsacFit": {
                "regions": monster["karsac_fit"]["regions"],
                "tone": monster["karsac_fit"]["tone"],
                "notes": monster["karsac_fit"]["notes"],
            },
            "sourceRule": monster["id"],
        }
    MONSTERS_JSON_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def write_report(monsters: list[dict[str, Any]]) -> None:
    terrain_counter = Counter()
    role_counter = Counter()
    region_counter = Counter()
    for monster in monsters:
        terrain_counter.update(monster["terrain"])
        role_counter.update(monster["encounter_roles"])
        region_counter.update(monster["karsac_fit"]["regions"])

    report = "\n".join(
        [
            "# Monster Data Report",
            "",
            f"**Generated:** {date.today()}",
            f"**SRD monsters generated:** {len(monsters)}",
            "",
            "## Top Terrain Tags",
            "",
            "| Terrain | Count |",
            "|---|---|",
            *[f"| `{key}` | {value} |" for key, value in terrain_counter.most_common(12)],
            "",
            "## Top Encounter Roles",
            "",
            "| Role | Count |",
            "|---|---|",
            *[f"| `{key}` | {value} |" for key, value in role_counter.most_common(12)],
            "",
            "## Top Karsac Regions",
            "",
            "| Region | Count |",
            "|---|---|",
            *[f"| `{key}` | {value} |" for key, value in region_counter.most_common(12)],
            "",
        ]
    )
    REPORT_PATH.write_text(report, encoding="utf-8")


if __name__ == "__main__":
    main()
