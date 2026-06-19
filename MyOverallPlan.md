## Longer Term Vision — Generic Worldbuilding Tool

The engine is already world-agnostic. The proposal pipeline, validator, pruner, governance layer, lifecycle, REST API, UI, and tracker contain no Karsac-specific knowledge. All world-specific content lives in data:

- **Corpus** (`corpus/collections/`, `corpus/planning/`) — replace with a different world's lore
- **Registry YAML** (`corpus/registry/` — entity policies, factions, proposal contracts) — replace with a different world's rules
- **Map geometry** (`KarsacMapMaker/data.js`) — swap for a different world's geography
- **Campaign state** (`corpus/state/`) — seed with a different campaign

"Install a new world" = new corpus + new registry YAML + new map geometry + new state seed. Engine, API, UI, and tracker are unchanged.

**One thing to protect now:** proposal contracts and entity validators currently assume some Karsac-specific section names (e.g. `## What They Want`, `## What They Hide` in NPC schema, specific proposal types). These need to stay world-configurable — defined in registry YAML, not hardcoded in TypeScript — so they don't become a migration cost later. Every time a new schema section or proposal type is added, it should go in data, not code.

**Design principle to enforce:** if a rule is world-specific, it belongs in `corpus/registry/`. If it's in TypeScript, it's universal.

---

## Big Brain Stuff

So now we have a corpus.. what I want to be able to do is create and edit that corpus in a number of different ways

Using AI to create the proposals for any of the items described in the [schemas](/karsac-dm-assistant/schemas). Where the AI follows the deterministic routes we set and uses the schemas and context provided

Be able to review these in the ui and edit them in situ
Be able to promote from proposal to corpus in the UI
Be able to create the metadata links in the UI via the relationships set out in the schemas vai the UI
Be able to edit the Corpus in in the UI

To be able to matteralise the corpus in the the Tracker as a Chapter..
To be able to materlise global entities into the trackers by default if the metadata creates the link

Eventually be able to power the [Map](asylum-dnd/KarsacMapMaker) from the same corpus

For entire think to be deployable with corpus in s3

The aim is to have a unique homebrew worldbuilding tool aided by AI but constrained AI

when deployed the AI will probably have to use edge via console API so will need secure key holding but also way to see token usage in the UI

AI should not be required I should be able to create items by hand to the schema also..

we will need consider techinical and archtectural decisions.. We should record them here as ADRS so we remember why we did stuff..

We should run an Audit of current situation and append it to this file as matter of record.. and then ADRS can be appended to that

Questions for the audit

now that the tracker is data driven should we refactor in something like React.. which will also mean it will comply with the Map technology

Are we happy with data structure corpus as souce of truth in md.. directly editable from the UI

matterlised data to drive the tracker and map

Chapter state on completion of a sessions placed back into corpus -- ensuring that play state can be treated as dynamic.. This push back can be done from the UI

Should we draw an architecture diagram we can refer to in mermaid or puml

local dev can be against local llm in ollama to keep cost down.. but deployment may be againt bigger models.. 

should we re-factor or build from scratch against this design?

## NOTE FOR LLM
We will run the plan through both Claude and Codex.. each LLM should give an opinion.. we will then ask each to review.. so eack model should record its opnion in this doc..brevity is key here tho

If you are an LLM add you comments to the end of doc clearly indication which model you are.. don not start any work other than commenting here yet

---

## Opinion — Claude (Opus 4.8)

**Headline: refactor, don't rebuild. Build the UI/tracker/map as new front-ends on top of the existing registry — never rewrite the registry.** The hard, valuable part (constrained-AI proposals, deterministic routing, schema validation, promotion) already exists and is tested. That governance engine *is* the moat. A from-scratch rewrite throws it away to re-solve the easy part (rendering).

**Decisions, terse:**
- **Corpus-as-md = keep it.** Git-versioned, diffable, hand- *and* AI-editable — it directly serves "AI not required." Rule: md is the only source of truth; index/tracker/map are **derived, one-way (md → materialised)**. Never let the materialised layer become authoritative.
- **API boundary is the missing piece.** Today the registry is CLI + an OpenAI-chat-shaped gateway. A React UI doing review/edit/promote/relationship-linking needs a real HTTP CRUD API — the chat gateway is the wrong shape for that. Define that API as the contract between the md engine and *any* front-end. S3 then becomes a storage adapter behind it, not a rewrite.
- **Fix the corpus lifecycle before building UI promote.** Concrete gap found this session: promotion lands in `corpus/planning`, which **nothing indexes and the chat never reads** (retrieval = `collections` + live `adversary-corpus` only). There is no defined `planning → indexed canon` path. "Promote in the UI" sits directly on top of this — make the lifecycle (proposed → review → canonical/indexed) explicit and consistent *first*, or the UI will promote things into a void.
- **Two cheap abstractions now, expensive later:** (1) storage interface (fs ↔ S3), (2) model-provider interface (Ollama local ↔ Anthropic edge) with a token-usage hook. Design for both now; implement lazily.
- **React tracker refactor: yes, but sequence it after the API + lifecycle decisions**, and only if it shares the materialised-data schema + components with the Map. Aligning tracker and map on one schema is the actual payoff.
- **ADRs + a mermaid diagram: do it, it's cheap.** First ADRs I'd write: corpus-as-truth, md format, materialisation direction (one-way), API boundary, storage abstraction.

**Recommended first step (not started, per instructions):** the audit you flagged — but scope it tightly to *the corpus lifecycle and read/write paths* (what's indexed, what's read, where promotions go, where the seams are), since that's the foundation every UI feature depends on. Architecture diagram falls out of that audit.

**One caution:** don't let "deployable on S3 / edge models / token UI" pull effort forward. They're real but they're leaves; the trunk is md-engine + API + lifecycle. Get the trunk right and the leaves are adapters.

---

## Opinion — Codex

**Headline: refactor, do not rebuild. The registry/corpus pipeline is the asset; the next step is a real API and UI layer that edits the corpus directly through schema-validated operations.**

**Decisions, terse:**
- Keep the corpus in markdown as the source of truth.
- Keep materialised tracker/map data derived from the corpus, never the reverse.
- Add a CRUD API for proposals, promotion, metadata linking, and corpus edits; the current chat-shaped gateway is not enough for operator workflows.
- Make the lifecycle explicit: proposed -> reviewed -> promoted -> materialised -> tracked.
- Build tracker and map against the same schema-backed materialisation model.
- Add storage and model-provider abstraction points now so S3 and edge/local LLMs stay swap-in, not rewrites.
- Write the audit and ADRs before expanding the UI further.

**Recommended first step:** document the current read/write lifecycle and where each artifact lives, then use that as the contract for the UI and API.

---

## Cross-review — Claude (Opus 4.8) on Codex's opinion

**Agreed. We converge point-for-point and I'm happy to proceed:** refactor not rebuild; markdown corpus as source of truth; materialisation one-way (corpus → tracker/map); CRUD API (chat gateway insufficient); explicit lifecycle; tracker + map on one schema; storage + model-provider abstractions designed now; audit + ADRs before expanding the UI. Two models reaching the same architecture from different context is a strong de-risking signal — treat the direction as settled.

**Adopting from Codex:** the 5-stage lifecycle naming `proposed → reviewed → promoted → materialised → tracked` as canonical. It cleanly separates *promoted* (into corpus) from *materialised* (into tracker/map) from *tracked* (live play state), and it matches the seam already being built (the chapter-outline test derives `corpus/state/chapters/chapter-3/seed.json` — that is the `materialised → tracked` step).

**One constraint to carry into the audit:** today's `promoted` step is severed from retrieval — promotions land in `corpus/planning`, which `buildIndex` does not scan and the chat never reads (retrieval = `collections` + live `adversary-corpus` only). Codex's chain is the target state; this is the current break. The audit's job is to map each lifecycle stage to its on-disk location + reader, and mark where the chain is cut (`planning` → indexed canon).

**Shared first step (both agree):** scope the audit to the read/write lifecycle — where each artifact lives, who reads it, where the seams are — and use it as the contract for the API and UI. Architecture diagram + ADRs fall out of that audit.

## Recommendation — Under Consultation With Project Designer

**One corpus, two explicit read modes.**

- `live mode` reads only current canon and current chapter state.
- `planning mode` reads chapter-scoped future material on demand.

This is the best UX if we want to plan far ahead for future chapters without leaking future NPCs, places, adversaries, items, and threads into live play prompts.

Implementation intent:

- keep a single source of truth per artifact
- do not duplicate canon files
- make `canonical` meaningful at read time
- let the UI explicitly choose `live` vs `planning`
- default assistant/tracker reads to `live`

Status: **under consultation with project designer**

## ADR Note — Schema vs Folder Layout

The corpus should follow the schema in its content contract, but not necessarily mirror the schema 1:1 in folder structure.

- `schema` defines what the content means and what fields it must carry.
- `corpus layout` defines lifecycle and storage.
- `validation` enforces schema shape at each lifecycle stage.

Practical rule:

- proposals validate against schema
- promoted files preserve schema shape
- materialised state is derived from schema-backed sources
- legacy folders remain as adapters until intentionally retired

This keeps the system flexible without weakening the contract.

✅ Proceeding agreed by both Claude and Codex.
