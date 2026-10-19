import type { INestApplication, Type } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export interface TestApp {
  app: INestApplication;
  close: () => Promise<void>;
}

export interface TestAppOptions {
  /** Extra controllers mounted next to the real app (e.g. probes for cross-cutting behaviour). */
  controllers?: Type[];
  /** Environment overrides applied before the app's config is read (e.g. `RATE_LIMIT_ENABLED`). */
  env?: Record<string, string>;
}

/**
 * A MongoDB **replica set** for the test (transactions need one, exactly like production —
 * CLAUDE.md §37), with a database of its own:
 *
 * - `TEST_MONGODB_URI` set (e.g. the local Docker replica set from infra/docker-compose.yml): a
 *   fresh, uniquely named database on that server, dropped afterwards. Fast, no download.
 * - otherwise: an in-memory replica set from mongodb-memory-server (downloads a MongoDB binary on
 *   first use).
 */
async function startDatabase(): Promise<{ uri: string; stop: () => Promise<void> }> {
  const external = process.env.TEST_MONGODB_URI;
  if (external) {
    const url = new URL(external);
    url.pathname = `/aricon-test-${randomUUID().slice(0, 8)}`;
    const uri = url.toString();
    return {
      uri,
      stop: async () => {
        const connection = await mongoose.createConnection(uri).asPromise();
        await connection.dropDatabase();
        await connection.close();
      },
    };
  }

  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  return { uri: replSet.getUri('aricon-test'), stop: async () => void (await replSet.stop()) };
}

/**
 * The real `AppModule` with the production HTTP pipeline (`configureApp`) on a test database.
 *
 * The app module is imported only after the environment is set: the config module reads and
 * validates it when it is first loaded (each test file runs in its own module context).
 */
export async function createTestApp(options: TestAppOptions = {}): Promise<TestApp> {
  const database = await startDatabase();
  process.env.MONGODB_URI = database.uri;
  // Uploaded files go to a folder of this test file's own, removed afterwards.
  const storageDir = await mkdtemp(path.join(tmpdir(), 'aricon-test-files-'));
  process.env.STORAGE_LOCAL_DIR = storageDir;
  Object.assign(process.env, options.env ?? {});

  const { AppModule } = await import('../../src/app.module.js');
  const { configureApp } = await import('../../src/app.setup.js');
  const { AppConfig } = await import('../../src/config/app-config.service.js');

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers: options.controllers ?? [],
  }).compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false, logger: false });
  configureApp(app, app.get(AppConfig));
  await app.init();

  return {
    app,
    close: async () => {
      await app.close();
      await database.stop();
      await rm(storageDir, { recursive: true, force: true });
    },
  };
}
