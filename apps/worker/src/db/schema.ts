import {
  boolean,
  char,
  foreignKey,
  index,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', { length: 320 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    emailUniq: uniqueIndex('users_email_uniq').on(table.email),
  }),
);

export const userSessions = pgTable(
  'user_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(),
    tokenHash: char('token_hash', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'user_sessions_user_id_fkey',
    }).onDelete('cascade'),
    tokenHashUniq: uniqueIndex('user_sessions_token_hash_uniq').on(table.tokenHash),
    userIdx: index('user_sessions_user_idx').on(table.userId),
    expiresIdx: index('user_sessions_expires_idx').on(table.expiresAt),
  }),
);

export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(),
    tokenHash: char('token_hash', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'password_reset_tokens_user_id_fkey',
    }).onDelete('cascade'),
    tokenHashUniq: uniqueIndex('password_reset_tokens_token_hash_uniq').on(table.tokenHash),
    userIdx: index('password_reset_tokens_user_idx').on(table.userId),
    expiresIdx: index('password_reset_tokens_expires_idx').on(table.expiresAt),
  }),
);

export const loginCodes = pgTable(
  'login_codes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(),
    codeHash: char('code_hash', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'login_codes_user_id_fkey',
    }).onDelete('cascade'),
    userCodeIdx: index('login_codes_user_code_idx').on(table.userId, table.codeHash),
    expiresIdx: index('login_codes_expires_idx').on(table.expiresAt),
  }),
);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', { length: 320 }).notNull(),
    userId: uuid('user_id').notNull(),
    appId: varchar('app_id', { length: 32 }).notNull(),
    country: char('country', { length: 2 }).notNull().default('US'),
    targetPrice: numeric('target_price', {
      precision: 10,
      scale: 2,
      mode: 'number',
    }),
    lastNotifiedPrice: numeric('last_notified_price', {
      precision: 10,
      scale: 2,
      mode: 'number',
    }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'subscriptions_user_id_fkey',
    }).onDelete('cascade'),
    uniqUserAppCountry: uniqueIndex('subscriptions_user_app_country_uniq').on(
      table.userId,
      table.appId,
      table.country,
    ),
    emailIdx: index('subscriptions_email_idx').on(table.email),
    userIdx: index('subscriptions_user_idx').on(table.userId),
    appCountryIdx: index('subscriptions_app_country_idx').on(
      table.appId,
      table.country,
    ),
  }),
);

export const appSnapshots = pgTable(
  'app_snapshots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    appId: varchar('app_id', { length: 32 }).notNull(),
    country: char('country', { length: 2 }).notNull(),
    appName: text('app_name').notNull(),
    storeUrl: text('store_url'),
    iconUrl: text('icon_url'),
    currency: char('currency', { length: 3 }).notNull(),
    lastPrice: numeric('last_price', {
      precision: 10,
      scale: 2,
      mode: 'number',
    }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    uniqAppCountry: uniqueIndex('app_snapshots_app_country_uniq').on(
      table.appId,
      table.country,
    ),
  }),
);

export const appPriceHistory = pgTable(
  'app_price_history',
  {
    id: serial('id').primaryKey(),
    appId: varchar('app_id', { length: 32 }).notNull(),
    country: char('country', { length: 2 }).notNull(),
    price: numeric('price', {
      precision: 10,
      scale: 2,
      mode: 'number',
    }).notNull(),
    currency: char('currency', { length: 3 }).notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    appTimeIdx: index('app_price_history_app_time_idx').on(
      table.appId,
      table.country,
      table.fetchedAt,
    ),
  }),
);

export const appDropEvents = pgTable(
  'app_drop_events',
  {
    id: serial('id').primaryKey(),
    appId: varchar('app_id', { length: 32 }).notNull(),
    country: char('country', { length: 2 }).notNull(),
    appName: text('app_name').notNull(),
    storeUrl: text('store_url'),
    iconUrl: text('icon_url'),
    currency: char('currency', { length: 3 }).notNull(),
    oldPrice: numeric('old_price', {
      precision: 10,
      scale: 2,
      mode: 'number',
    }).notNull(),
    newPrice: numeric('new_price', {
      precision: 10,
      scale: 2,
      mode: 'number',
    }).notNull(),
    dropPercent: numeric('drop_percent', {
      precision: 7,
      scale: 2,
      mode: 'number',
    }),
    detectedAt: timestamp('detected_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    appCountryDetectedIdx: index('app_drop_events_app_country_detected_idx').on(
      table.appId,
      table.country,
      table.detectedAt,
    ),
    detectedIdx: index('app_drop_events_detected_idx').on(table.detectedAt),
  }),
);

export type User = typeof users.$inferSelect;
export type UserSession = typeof userSessions.$inferSelect;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type LoginCode = typeof loginCodes.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type AppSnapshot = typeof appSnapshots.$inferSelect;
export type AppPriceHistory = typeof appPriceHistory.$inferSelect;
export type AppDropEvent = typeof appDropEvents.$inferSelect;
