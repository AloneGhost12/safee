import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    exclude: [
      'test/**/*.integration.test.ts',
      'test/**/__tests__/**',
      'node_modules/**',
      'dist/**',
      'build/**',
    ],
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html', 'json'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/**/test/**',
        'src/**/tests/**',
        'src/**/__tests__/**',
        'src/**/__mocks__/**',
        'src/index.ts',
        'node_modules/**',
        'dist/**',
        'build/**',
      ],
      all: true,
      skipFull: false,
      thresholds: {
        global: {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85,
        },
        'src/routes/**': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
        'src/utils/**': {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95,
        },
        'src/middleware/**': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
      },
      watermarks: {
        statements: [85, 95],
        functions: [85, 95],
        branches: [85, 95],
        lines: [85, 95],
      },
    },
  },
})
