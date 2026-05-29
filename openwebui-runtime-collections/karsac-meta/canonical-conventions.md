---
id: meta/canonical-conventions
type: meta
visibility: player-safe
canonical: reference
tags: [meta, spelling, conventions, normalisation]
related:
  meta: [meta/glossary, meta/style-guide]
summary: "Locked canonical spellings for all Karsac proper nouns. Every file in this corpus uses these forms; source variants are noise, not alternatives"
last_updated: 2026-05-26
---

# Canonical Conventions

**Canon File ID:** `meta/canonical-conventions`
**Retrieval Summary:** Locked canonical spellings for all Karsac proper nouns. Every file in this corpus uses these forms; source variants are noise, not alternatives.

> Locked canonical spellings. Every file in this corpus uses these forms regardless of how the source document spells them. Source variants are listed here for reference so that incoming text can be normalised.

## Overview

The Karsac source corpus uses inconsistent spellings across documents of different ages and authorship. This file locks the canonical form for each disputed term and records the decision rationale. All entity files use the canonical form. When the Karsac AI reads source material containing non-canonical spellings, it normalises silently.

---

## Locked Spelling Table

| Canonical Form | Non-Canonical Variants | Authority | Rationale |
|---|---|---|---|
| **Lösweg** | Losweg | 
| **Löswegiann** | Loswegiann | 
| **Törweg** | Torweg | 
| **Maharuq** | Marahuq | 
| **Xyrrathh** | Xyrrath | [source document] | Background document (player-owned source of record for PC name) uses double-h; transcript form is colloquial shorthand |
| **Yantravaq** | yantravaq, Yantrabaq | 
| **Dhurvaq** | Durvaq | 

---

## Ragnfrid Decision (User-Confirmed)

| Canonical Form | Non-Canonical Variant | Decision Source |
|---|---|---|
| **Ragnfrid** | Ragnfridd | User instruction, 2026-05-26 |

**Rationale:** The character's background file (rank-5 source) uses the single-d form. In-play content and the storyarch use the double-d form. The user confirmed the background file form as canonical. All files in this corpus use **Ragnfrid** (single d). The storyarch's use of *Ragnfridd* is treated as the same normalisation error as *Torweg* for *Törweg*.

---

## Bysaes Tyl

Appears once in the corpus (Ch 2 BETA context). Preserved as-is — no variant form exists. Cross-references to Wildemount geography (external Exandrian setting, not a Karsac-native term). Not normalised; not a candidate for the spelling table.

---

## Spelling Check Protocol

Before any file is declared complete, check the text against this non-canonical list. Zero occurrences of the following in any file:

- `Losweg` (without umlaut)
- `Loswegiann` (without umlaut)
- `Torweg` (without umlaut)
- `Marahuq` (wrong vowel order)
- `Xyrrath` (missing second h)
- `yantravaq` (lowercase)
- `Yantrabaq` (wrong final consonant)
- `Durvaq` (missing h)
- `Ragnfridd` (double d)

---

## Future Decisions

The following terms have not yet required normalisation but should be watched:

- **Korvann / Korvaan** — only one form observed to date; no conflict yet.
- **Halvash** — consistent across sources; no action needed.
- **Vushhiri / Vushiri** — only the double-h form observed in rank-1 sources; treat single-h as noise if it appears.
- **Zörsdkog / Zorsdkog** — umlaut form used in rank-1 Sourcebook; consistent with Lösweg convention; no variant yet observed.

Any new spelling decision made during production is recorded in `production_log.md` and, if recurring, added to this table.

---
