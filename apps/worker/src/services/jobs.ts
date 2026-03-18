import { and, eq, lte } from 'drizzle-orm';

import type { EnvConfig } from '../env';
import { getDb } from '../db/client';
import { jobLeases, priceCheckRuns } from '../db/schema';
import { runPriceCheck } from '../lib/checker';
import type { CheckReport } from '../lib/checker.types';

const PRICE_CHECK_LOCK_KEY = 'price-check';
const ERROR_SUMMARY_LIMIT = 5;

type RunProtectedPriceCheckParams = {
  trigger: 'scheduled' | 'manual';
};

type ProtectedPriceCheckSkipped = {
  kind: 'skipped';
  reason: 'price-check-already-running';
};

type ProtectedPriceCheckCompleted = {
  kind: 'completed';
  runId: string;
  report: CheckReport;
};

export type RunProtectedPriceCheckResult =
  | ProtectedPriceCheckSkipped
  | ProtectedPriceCheckCompleted;

const buildErrorSummaryFromReport = (errors: string[]): string => {
  if (errors.length === 0) {
    return '';
  }

  const lines = errors.slice(0, ERROR_SUMMARY_LIMIT);
  const rest = errors.length - lines.length;
  const suffix = rest > 0 ? ` (+${rest} more)` : '';
  return `${lines.join(' | ')}${suffix}`;
};

const buildErrorSummaryFromException = (error: unknown): string => {
  return error instanceof Error ? error.message : 'unknown error';
};

const tryAcquirePriceCheckLease = async (
  config: EnvConfig,
  runId: string,
): Promise<boolean> => {
  const db = getDb(config);
  const now = new Date();
  const lockTtlSeconds = config.PRICE_CHECK_LOCK_TTL_SECONDS ?? 900;
  const lockedUntil = new Date(now.getTime() + lockTtlSeconds * 1000);

  const [inserted] = await db
    .insert(jobLeases)
    .values({
      lockKey: PRICE_CHECK_LOCK_KEY,
      runId,
      lockedUntil,
      updatedAt: now,
    })
    .onConflictDoNothing()
    .returning({ lockKey: jobLeases.lockKey });

  if (inserted) {
    return true;
  }

  const [replaced] = await db
    .update(jobLeases)
    .set({
      runId,
      lockedUntil,
      updatedAt: now,
    })
    .where(
      and(
        eq(jobLeases.lockKey, PRICE_CHECK_LOCK_KEY),
        lte(jobLeases.lockedUntil, now),
      ),
    )
    .returning({ lockKey: jobLeases.lockKey });

  return Boolean(replaced);
};

const releasePriceCheckLease = async (
  config: EnvConfig,
  runId: string,
): Promise<void> => {
  const db = getDb(config);

  await db
    .delete(jobLeases)
    .where(and(eq(jobLeases.lockKey, PRICE_CHECK_LOCK_KEY), eq(jobLeases.runId, runId)));
};

export const runProtectedPriceCheck = async (
  config: EnvConfig,
  params: RunProtectedPriceCheckParams,
): Promise<RunProtectedPriceCheckResult> => {
  const db = getDb(config);
  const runId = crypto.randomUUID();
  const startedAt = new Date();

  const acquired = await tryAcquirePriceCheckLease(config, runId);
  if (!acquired) {
    return {
      kind: 'skipped',
      reason: 'price-check-already-running',
    };
  }

  await db.insert(priceCheckRuns).values({
    id: runId,
    trigger: params.trigger,
    status: 'running',
    startedAt,
    scanned: 0,
    succeeded: 0,
    skipped: 0,
    failed: 0,
    updated: 0,
    drops: 0,
    emailsSent: 0,
    errorSummary: '',
  });

  try {
    const report = await runPriceCheck(config);
    const finishedAt = new Date();

    await db
      .update(priceCheckRuns)
      .set({
        status: 'completed',
        finishedAt,
        scanned: report.scanned,
        succeeded: report.succeeded,
        skipped: report.skipped,
        failed: report.failed,
        updated: report.updated,
        drops: report.drops,
        emailsSent: report.emailsSent,
        errorSummary: buildErrorSummaryFromReport(report.errors),
      })
      .where(eq(priceCheckRuns.id, runId));

    return {
      kind: 'completed',
      runId,
      report,
    };
  } catch (error) {
    await db
      .update(priceCheckRuns)
      .set({
        status: 'failed',
        finishedAt: new Date(),
        errorSummary: buildErrorSummaryFromException(error),
      })
      .where(eq(priceCheckRuns.id, runId));

    throw error;
  } finally {
    await releasePriceCheckLease(config, runId);
  }
};
