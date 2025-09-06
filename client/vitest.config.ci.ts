import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['test/basic.test.ts', 'test/simple.test.ts'],
    exclude: ['node_modules/**', 'dist/**', 'build/**', 'e2e/**', 'server/**', 'test/crypto/**'],
    testTimeout: 5000,
    hookTimeout: 5000,
    teardownTimeout: 1000,
    coverage: {
      enabled: false
    },
    reporters: ['basic']
  }
})
