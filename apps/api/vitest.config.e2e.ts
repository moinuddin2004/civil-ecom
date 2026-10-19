import { defineConfig } from 'vitest/config';

/**
 * End-to-end tests (`test/**\/*.e2e-spec.ts`): the real app over HTTP (Supertest) on an in-memory
 * MongoDB replica set. The first run downloads a MongoDB binary, hence the long hook timeout.
 */
export default defineConfig({
  test: {
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    environment: 'node',
    hookTimeout: 180_000,
    testTimeout: 30_000,
    // Each file starts its own database and app; keep them from competing for CPU on small machines.
    fileParallelism: false,
  },
});
