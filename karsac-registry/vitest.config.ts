import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Exclude retrieval and scenario tests from the default run — they require
    // a live Ollama instance.
    // Run retrieval tests with: npm run test:retrieval
    // Run scenario tests with:  npm run test:scenarios
    exclude: ['tests/retrieval/**', 'tests/scenarios/**', 'node_modules/**'],
  },
})
