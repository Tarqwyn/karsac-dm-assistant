import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Exclude LLM-dependent tests from the default run — they require a live Ollama instance.
    // Run retrieval tests with:  npm run test:retrieval
    // Run scenario tests with:   npm run test:scenarios
    // Run snapshot tests with:   npm run test:snapshots
    exclude: ['tests/retrieval/**', 'tests/scenarios/**', 'tests/snapshots/**', 'node_modules/**'],
  },
})
