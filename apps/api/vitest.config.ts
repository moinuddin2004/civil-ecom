import { defineConfig } from 'vitest/config';

/** Unit tests: pure logic next to the code it tests (`src/**\/*.spec.ts`), no database. */
export default defineConfig({
  test: {
    root: './',
    include: ['src/**/*.spec.ts'],
    environment: 'node',
  },
});
