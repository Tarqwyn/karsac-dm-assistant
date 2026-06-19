# Chapter Authoring Workflow

This is the operator flow for taking a chapter from AI draft to tracker-ready state.

## Core rule

- AI proposes.
- Schema validates.
- You approve promotion.
- Promotion derives the chapter seed.
- Materialization turns the seed into runtime state.
- The tracker reads runtime state, not raw prose.

## CLI workflow

### 1. Start the gateway

```bash
npm run karsac:gateway
```

### 2. Generate the chapter outline

Use the chapter-outline prompt explicitly:

```bash
npm run karsac:propose:chapter -- "Propose a new chapter-outline for chapter 3"
```

What to check:
- the proposal type should be `chapter-outline`
- validation should pass or at least show only non-blocking warnings
- the proposal should include a structured `Scene Spine`
- the proposal frontmatter should carry `structured_outline`

### 3. Validate the proposal

```bash
npm run karsac:validate-proposals
```

If it fails, fix the proposal before promotion.

### 4. Promote the approved outline

```bash
npm run karsac:promote-proposal -- corpus/proposals/chapters/<proposal>.proposed.md
```

Promotion does three things:
- writes the approved chapter into `corpus/planning/chapters`
- preserves `promoted_from`
- auto-derives `corpus/state/chapters/<chapterId>/seed.json`

### 5. Materialize chapter state

```bash
npm run karsac:materialize-chapter-state -- --chapter=chapter-3
```

This regenerates:
- `progress.json`
- `facts.json`
- `handouts.json`
- `beats.json`
- `radar.json`
- `triggers.json`
- `scenes.json`

### 6. Validate the result

```bash
npm run validate
```

This covers:
- design schemas
- state schemas
- registry tests

### 7. Open the tracker

Open `KarsacTracker/index.html` while the gateway is running.

The tracker should hydrate from:
- `GET /api/state/campaign`
- `GET /api/state/chapters/chapter-<n>`

## Open WebUI workflow

Use this when you want the model to draft the outline conversationally but still land in the same pipeline.

### 1. Start the gateway

```bash
npm run karsac:gateway
```

### 2. Connect Open WebUI

Use the local gateway as the OpenAI-compatible endpoint:

```text
Base URL: http://host.docker.internal:3210/v1
API Key: local-karsac-dev-key
```

If `host.docker.internal` does not work in your environment, use the host IP the container can reach.

### 3. Ask for a chapter outline

Use the chapter-outline form explicitly:

```text
Propose a new chapter-outline for chapter 3.
```

What the model should return:
- `# Chapter Outline: ...`
- required chapter sections
- seed-ready `Scene Spine`
- no direct state file edits

### 4. Copy the result into a proposal

Save the generated outline as a proposal in:

```text
corpus/proposals/chapters/<slug>.proposed.md
```

The proposal frontmatter should include:
- `proposal_type: chapter-outline`
- `status: proposed`
- `canonical: provisional`
- `promote_target: corpus/planning/chapters`

### 5. Validate and promote

Use the same CLI steps as above:

```bash
npm run karsac:validate-proposals
npm run karsac:promote-proposal -- corpus/proposals/chapters/<proposal>.proposed.md
```

### 6. Materialize and use the tracker

```bash
npm run karsac:materialize-chapter-state -- --chapter=chapter-3
```

Then open the tracker and confirm the chapter state is loaded from the seed-derived runtime files.

## What counts as done

A chapter is ready for play when:
- the outline validates
- the proposal is promoted
- the seed is auto-derived
- the seed validates
- chapter state is materialized
- the tracker opens the intended chapter

## What not to do

- Do not promote a chapter-outline that fails the schema.
- Do not hand-edit runtime state as the primary authoring path.
- Do not let the AI write raw `seed.json` directly unless you are intentionally bypassing the outline workflow.

## UX blueprint

The frontend-facing version of this workflow is documented in [chapter-authoring-ux.md](chapter-authoring-ux.md).
