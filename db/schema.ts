import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const githubCache = sqliteTable(
  "github_cache",
  {
    key: text("key").primaryKey(),
    owner: text("owner").notNull(),
    payload: text("payload").notNull(),
    expiresAt: integer("expires_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [index("github_cache_expires_at_idx").on(table.expiresAt)],
);
