import { drizzle } from 'drizzle-orm/neon-http';
import { describe, expect, it } from 'vitest';

import * as schema from '../src/db/schema';
import { buildPublicDropsQuery } from '../src/services/public';

describe('public drops SQL builder', () => {
  it('builds the dedupe query with an aliased submissionCount field', () => {
    const db = drizzle.mock({ schema });
    const query = buildPublicDropsQuery(db, {
      dedupe: true,
      limit: 10,
    });

    expect(() => query.toSQL()).not.toThrow();
    expect(query.toSQL().sql).toContain('as "submissionCount"');
  });
});
