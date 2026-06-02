# Karsac DM Assistant

A registry-guided domain AI runtime for the Karsac D&D campaign.

## Architecture Summary

Markdown corpus
-> deterministic registry
-> router
-> profile-specific context assembly
-> task brief compiler
-> model provider
-> validation / repair / fallback

Important principle:
The user prompt is evidence.
The compiled brief is the instruction.

## Profiles

- `canon`: strict canon lookup and comparison
- `prose`: player-safe prose, boxed text, dialogue
- `deep-lore`: DM-only hidden structure
- `rules`: D&D 5e 2014 / SRD 5.1 and Karsac mechanics
- `design`: provisional encounter / NPC / adversary design

Generated design output is provisional until it is canonised into the corpus.

## Folders

- `karsac-registry/` - TypeScript registry/runtime code
- `corpus/collections/` - Markdown canon, rules, monsters, adversaries, and design source material
- `corpus/rules-data/` - structured JSON lookup data
- `corpus/reports/` - generated data/index reports
- `scripts/` - corpus generation scripts
- `docs/` - architecture notes

## Setup

1. Copy config:

```bash
cp .env.example .env
```

2. Edit values if needed:

```bash
OLLAMA_HOST=http://172.18.64.1:11434
```

3. Pull the creative treatment model:

```bash
ollama pull qwen3:14b
```

4. Install dependencies:

```bash
npm install
npm run install:registry
```

## Commands

```bash
npm run karsac:ask -- "Tell me about Brynja"
npm run karsac:lookup -- "brynja"
npm run karsac:show -- "npcs/brynja-thorgrimsdotter"
npm run karsac:gateway
npm test
```

Proposal generation now uses a two-pass flow:

- draft generation with the configured draft model
- creative treatment with `qwen3:14b` by default for doctrine, cultural identity, story beat, thematic movement, and rich preview polish
- deterministic validation and write-back

## Open WebUI Integration

Open WebUI should connect to Karsac through the local gateway, not by bypassing the registry runtime.

1. Start Ollama.
2. Start the gateway:

```bash
npm run karsac:gateway
```

3. In Open WebUI, add an OpenAI-compatible connection:

```text
Base URL: http://host.docker.internal:3210/v1
API Key: local-karsac-dev-key
```

If `host.docker.internal` is not reachable from Docker on your setup, use the host IP that the container can reach instead.

The gateway exposes:

- `GET /v1/models`
- `POST /v1/chat/completions`

The first model id is `karsac-dm-assistant`. Open WebUI handles chat history and model selection; Karsac remains responsible for routing, corpus retrieval, proposals, validation, and write-back.
