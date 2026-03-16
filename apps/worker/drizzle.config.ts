import { defineConfig } from 'drizzle-kit';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadEnv } from 'dotenv';

const configDir = dirname(fileURLToPath(import.meta.url));

const envCandidates = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '.dev.vars'),
  resolve(configDir, '.env'),
  resolve(configDir, '.dev.vars'),
  resolve(configDir, '../../.env'),
];

for (const envFile of envCandidates) {
  if (existsSync(envFile)) {
    loadEnv({ path: envFile, override: false });
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is required for drizzle-kit commands (checked .dev.vars/.env in apps/worker and repo root)',
  );
}

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
