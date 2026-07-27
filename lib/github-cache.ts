type CacheRow = {
  payload: string;
};

async function getCacheDatabase() {
  try {
    const { env } = await import("cloudflare:workers");
    return (env as unknown as { DB?: D1Database }).DB;
  } catch {
    return undefined;
  }
}

export async function readGithubCache<T>(key: string): Promise<T | null> {
  const database = await getCacheDatabase();
  if (!database) return null;

  try {
    const row = await database
      .prepare(
        "SELECT payload FROM github_cache WHERE key = ?1 AND expires_at > ?2",
      )
      .bind(key, Date.now())
      .first<CacheRow>();
    return row ? (JSON.parse(row.payload) as T) : null;
  } catch {
    return null;
  }
}

export async function writeGithubCache(
  key: string,
  owner: string,
  payload: unknown,
  ttlMs: number,
) {
  const database = await getCacheDatabase();
  if (!database) return;

  const now = Date.now();
  try {
    await database
      .prepare(
        `INSERT INTO github_cache (key, owner, payload, expires_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(key) DO UPDATE SET
           owner = excluded.owner,
           payload = excluded.payload,
           expires_at = excluded.expires_at,
           updated_at = excluded.updated_at`,
      )
      .bind(key, owner, JSON.stringify(payload), now + ttlMs, now)
      .run();
  } catch {
    // The city remains available through GitHub and edge caching if D1 is
    // temporarily unavailable or a migration has not reached a preview yet.
  }
}
