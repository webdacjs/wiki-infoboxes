/**
 * Minimal in-memory fetch cache with TTL support.
 *
 * This replaces the `simple-fetch-cache` dependency.  Entries are stored
 * keyed by URL; an entry is considered stale once `ttl` milliseconds have
 * elapsed.  The cache is process-local (no disk persistence), which is fine
 * for typical CLI / server usage and avoids any filesystem dependency.
 */

interface CacheEntry {
  value: unknown
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()

/**
 * Fetch `url` and return the parsed JSON body.
 *
 * Subsequent calls with the same URL within `ttl` milliseconds (default
 * 1 hour) return the cached response without hitting the network.
 *
 * @param url  Full URL to fetch.
 * @param ttl  Cache lifetime in milliseconds.  Defaults to 3 600 000 (1 h).
 */
export async function fetchWithCache(url: string, ttl = 3_600_000): Promise<unknown> {
  const now = Date.now()
  const cached = cache.get(url)

  if (cached && now < cached.expiresAt) {
    return cached.value
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Api-User-Agent': 'wiki-infoboxes/2.0 (https://github.com/webdacjs/wiki-infoboxes)',
      'User-Agent': 'wiki-infoboxes/2.0 (https://github.com/webdacjs/wiki-infoboxes)',
      Origin: '*',
    },
    redirect: 'follow',
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText} — ${url}`)
  }

  const value = await response.json()
  cache.set(url, { value, expiresAt: now + ttl })
  return value
}

/** Clear all cached entries (useful for testing). */
export function clearCache(): void {
  cache.clear()
}
