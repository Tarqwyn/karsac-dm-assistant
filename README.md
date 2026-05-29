# Karsac DM Assistant

Local domain-specific AI assistant for the Karsac D&D campaign.

Core architecture:
- Markdown canon/rules corpus
- deterministic registry
- profile router
- bounded context assembly
- local Ollama model calls
- validation and repair

Main command:

```bash
cd karsac-registry
npm run karsac:ask -- "Tell me about Brynja"
```

Profiles:
- canon
- prose
- deep-lore
- rules
- design
