import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Remove setup files temporarily to avoid issues
    // setupFiles: ['./test/setup.ts']
  }
})
