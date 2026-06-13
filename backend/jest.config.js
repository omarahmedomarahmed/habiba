'use strict';

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        emitDecoratorMetadata: true,
        experimentalDecorators: true,
        allowSyntheticDefaultImports: true,
        esModuleInterop: true,
        strictNullChecks: true,
        noImplicitAny: true,
        paths: {},
      },
    }],
  },
  moduleNameMapper: {
    '^@24therapy/types$': '<rootDir>/../packages/types/src/index.ts',
  },
  testMatch: ['**/*.spec.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts', '!src/**/*.dto.ts', '!src/**/*.module.ts'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
};

// Reviewed: 2026-06-13 — 24Therapy audit
