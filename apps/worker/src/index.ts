import { cors } from 'hono/cors';
import { Hono } from 'hono';

import { parseEnv } from './env';
import { runPriceCheck } from './lib/checker';
import authRouter from './routes/auth';
import pricesRouter from './routes/prices';
import publicRouter from './routes/public';
import subscriptionsRouter from './routes/subscriptions';
import type { AppEnv, WorkerBindings } from './types';

const app = new Hono<AppEnv>();

const normalizeOriginRule = (value: string) => value.trim().replace(/\/+$/, '');

const isWildcardRule = (rule: string) => {
  return (
    rule.startsWith('*.') ||
    rule.startsWith('http://*.') ||
    rule.startsWith('https://*.')
  );
};

const parseCorsRules = (value?: string) => {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((item) => normalizeOriginRule(item))
    .filter(Boolean);
};

const matchWildcardOrigin = (requestOrigin: string, wildcardRule: string) => {
  let normalizedRule = normalizeOriginRule(wildcardRule).toLowerCase();
  let protocol: 'http:' | 'https:' | null = null;

  if (normalizedRule.startsWith('http://*.')) {
    protocol = 'http:';
    normalizedRule = normalizedRule.slice('http://'.length);
  } else if (normalizedRule.startsWith('https://*.')) {
    protocol = 'https:';
    normalizedRule = normalizedRule.slice('https://'.length);
  }

  if (!normalizedRule.startsWith('*.')) {
    return false;
  }

  try {
    const parsed = new URL(requestOrigin);

    if (protocol && parsed.protocol !== protocol) {
      return false;
    }

    const host = parsed.hostname.toLowerCase();
    const suffix = normalizedRule.slice(2).toLowerCase();
    return host === suffix || host.endsWith(`.${suffix}`);
  } catch {
    return false;
  }
};

const resolveCorsOrigin = (requestOrigin: string | undefined, configuredOrigin?: string) => {
  const rules = parseCorsRules(configuredOrigin);
  const normalizedOrigin = requestOrigin ? normalizeOriginRule(requestOrigin) : undefined;

  if (rules.length === 0) {
    return normalizedOrigin ?? '*';
  }

  if (rules.includes('*')) {
    return '*';
  }

  if (!normalizedOrigin) {
    const fallback = rules.find((rule) => !isWildcardRule(rule));
    return fallback ?? '*';
  }

  const exactMatched = rules.includes(normalizedOrigin);
  const wildcardMatched = rules.some((rule) => matchWildcardOrigin(normalizedOrigin, rule));

  if (exactMatched || wildcardMatched) {
    return normalizedOrigin;
  }

  return 'null';
};

app.use('/api/*', async (c, next) => {
  try {
    const config = parseEnv(c.env);
    c.set('config', config);
    await next();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid environment';
    return c.json({ error: message }, 500);
  }
});

app.use(
  '/api/*',
  cors({
    origin: (origin, c) => resolveCorsOrigin(origin, c.get('config').CORS_ORIGIN),
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'x-cron-secret'],
  }),
);

app.get('/api/health', (c) => {
  return c.json({ ok: true, now: new Date().toISOString() });
});

app.route('/api/auth', authRouter);
app.route('/api/public', publicRouter);
app.route('/api/subscriptions', subscriptionsRouter);
app.route('/api/prices', pricesRouter);

app.post('/api/jobs/check', async (c) => {
  const config = c.get('config');

  if (config.CRON_SECRET) {
    const token = c.req.header('x-cron-secret');

    if (token !== config.CRON_SECRET) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
  }

  const report = await runPriceCheck(config);
  return c.json(report);
});

app.notFound((c) => c.json({ error: 'Not Found' }, 404));

app.onError((error, c) => {
  console.error(error);
  return c.json({ error: error.message || 'Internal Server Error' }, 500);
});

const worker: ExportedHandler<WorkerBindings> = {
  fetch: app.fetch,
  scheduled: async (_event, env, ctx) => {
    let config;

    try {
      config = parseEnv(env);
    } catch (error) {
      console.error('Invalid worker env for scheduled job', error);
      return;
    }

    ctx.waitUntil(
      runPriceCheck(config)
        .then((report) => {
          console.log('scheduled check report', report);
        })
        .catch((error) => {
          console.error('scheduled check failed', error);
        }),
    );
  },
};

export default worker;
