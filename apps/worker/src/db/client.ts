import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

import type { EnvConfig } from '../env';
import * as schema from './schema';

export const getDb = (env: EnvConfig) => {
  const sql = neon(env.DATABASE_URL);
  return drizzle(sql, { schema });
};
