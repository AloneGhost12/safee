import { defineConfig } from 'vitest/config'
import { mergeConfig } from 'vite'
import vitestConfig from './vitest.config'

export default mergeConfig(
  vitestConfig,
  defineConfig({
    test: {
      coverage: {
        provider: 'v8',
        reporter: ['text', 'lcov', 'html', 'json'],
        reportsDirectory: './coverage',
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          'src/**/*.d.ts',
          'src/**/*.test.{ts,tsx}',
          'src/**/*.spec.{ts,tsx}',
          'src/**/test/**',
          'src/**/tests/**',
          'src/**/__tests__/**',
          'src/**/__mocks__/**',
          'src/main.tsx',
          'src/vite-env.d.ts',
          'node_modules/**',
          'dist/**',
          'build/**',
        ],
        all: true,
        skipFull: false,
        thresholds: {
          global: {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80,
          },
          'src/crypto/**': {
            branches: 95,
            functions: 95,
            lines: 95,
            statements: 95,
          },
          'src/lib/**': {
            branches: 85,
            functions: 85,
            lines: 85,
            statements: 85,
          },
        },
        watermarks: {
          statements: [80, 95],
          functions: [80, 95],
          branches: [80, 95],
          lines: [80, 95],
        },
      },
    },
  })
)
