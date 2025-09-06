import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/basic.test.ts', 'test/simple.test.ts', 'test/health.test.ts'],
    exclude: ['test/auth.test.ts', 'test/routes/**', 'test/auth-simple.test.ts'],
    testTimeout: 5000,
    hookTimeout: 5000,
    teardownTimeout: 1000,
    coverage: {
      enabled: false
    },
    reporters: ['basic'],
    setupFiles: ['./test/setup.ts']
  }
})
