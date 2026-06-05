import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Exclude retrieval tests from the default run — they require a live Ollama instance.
    // Run them with: npm run test:retrieval
    exclude: ['tests/retrieval/**', 'node_modules/**'],
  },
})
