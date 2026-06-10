import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    include: ['tests/snapshots/regression.test.ts'],
    envDir: '..',
    env: {
      KARSAC_PROPOSALS_DIR: resolve(__dirname, '../corpus/proposals/_test'),
    },
  },
})
