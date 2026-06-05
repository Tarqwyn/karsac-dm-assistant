import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/snapshots/regression.test.ts'],
  },
})
