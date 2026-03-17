// @env worker

import { cors } from 'hono/cors';
import { Hono } from 'hono';

import { parseEnv } from './env';
import { runPriceCheck } from './lib/checker';
import { resolveCorsOrigin } from './lib/cors';
import authRouter from './routes/auth';
import pricesRouter from './routes/prices';
import publicRouter from './routes/public';
import subscriptionsRouter from './routes/subscriptions';
import type { AppEnv, WorkerBindings } from './types';

const app = new Hono<AppEnv>();

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
