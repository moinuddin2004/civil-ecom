import { NestFactory } from '@nestjs/core';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { parseArgs } from 'node:util';
import { AppModule } from '../app.module.js';
import { flattenValidationErrors } from '../common/validation/validation.js';
import { IsNormalizedEmail, IsPersonName, IsStrongPassword } from '../common/validation/validators.js';
import { AppConfig } from '../config/app-config.service.js';
import { PasswordHasher } from '../modules/auth/password-hasher.service.js';
import { UsersRepository } from '../modules/users/users.repository.js';

/**
 * `pnpm --filter api seed:admin` (SPEC §19): creates the first ADMIN account. Never changes an
 * existing account, so running it twice is safe.
 *
 *   pnpm --filter api seed:admin -- --email admin@aricon.com.pk --password '…' [--name 'Admin']
 *
 * or set ADMIN_EMAIL / ADMIN_PASSWORD in the environment (remove them afterwards).
 */

class SeedAdminInput {
  @IsPersonName()
  name!: string;

  @IsNormalizedEmail()
  email!: string;

  @IsStrongPassword()
  password!: string;
}

function print(line: string): void {
  process.stdout.write(`${line}\n`);
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { email: { type: 'string' }, password: { type: 'string' }, name: { type: 'string' } },
    allowPositionals: false,
  });

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  try {
    const config = app.get(AppConfig);
    const input = plainToInstance(SeedAdminInput, {
      name: values.name ?? 'Admin',
      email: values.email ?? config.get('ADMIN_EMAIL'),
      password: values.password ?? config.get('ADMIN_PASSWORD'),
    });
    const issues = flattenValidationErrors(await validate(input));
    if (issues.length > 0) {
      for (const issue of issues) print(`  - ${issue.path}: ${issue.message}`);
      throw new Error('Fix the values above (pass --email/--password, or set ADMIN_EMAIL/ADMIN_PASSWORD).');
    }

    const users = app.get(UsersRepository);
    if (await users.activeEmailExists(input.email)) {
      print(`An account with the email ${input.email} already exists. Nothing was changed.`);
      return;
    }

    const passwordHash = await app.get(PasswordHasher).hash(input.password);
    await users.create({ name: input.name, email: input.email, passwordHash, role: 'ADMIN', emailVerified: true });
    print(`Admin account created for ${input.email}.`);
    print(`Sign in at ${config.get('APP_URL')}/admin/login.`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
