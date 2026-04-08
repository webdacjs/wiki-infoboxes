/**
 * Wikipedia MediaWiki API client.
 *
 * Replaces the network layer of `wtf_wikipedia`.  We talk directly to the
 * MediaWiki `action=query` API, retrieve raw wikitext via the `revisions`
 * property, and hand it off to our local wikitext parser.
 */

import { fetchWithCache } from './cache.js'
import { parseInfobox, type Infobox } from './wikitext.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RevisionSlotMain {
  '*': string
  contentmodel?: string
  contentformat?: string
}

interface Revision {
  '*'?: string
  slots?: { main: RevisionSlotMain }
}

interface WikiPage {
  pageid?: number
  ns?: number
  title?: string
  missing?: string
  invalid?: string
  revisions?: Revision[]
}

interface WikiApiResponse {
  query: {
    pages: Record<string, WikiPage>
  }
}

interface SearchHit {
  title: string
  pageid: number
  snippet?: string
}

interface WikiSearchResponse {
  query: {
    search: SearchHit[]
  }
}

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

const API_BASE = 'https://en.wikipedia.org/w/api.php'

/** Replace & with " and " to avoid mangling multi-word Wikipedia titles. */
const repand = (str: string): string => str.replace(/&/gi, ' and ')

const COMMON_PARAMS = new URLSearchParams({
  action: 'query',
  format: 'json',
  origin: '*',
  maxlag: '5',
  redirects: 'true',
})

function makeRevisionUrl(title: string): string {
  const params = new URLSearchParams(COMMON_PARAMS)
  params.set('prop', 'revisions')
  params.set('rvprop', 'content')
  params.set('rvslots', 'main')
  params.set('titles', repand(title).replace(/ /g, '_'))
  return `${API_BASE}?${params}`
}

function makeSearchUrl(query: string): string {
  const params = new URLSearchParams(COMMON_PARAMS)
  params.set('list', 'search')
  params.set('utf8', '')
  params.set('srsearch', repand(query))
  return `${API_BASE}?${params}`
}

// ---------------------------------------------------------------------------
// Response extractors
// ---------------------------------------------------------------------------

function extractWikitext(page: WikiPage): string | null {
  const rev = page.revisions?.[0]
  if (!rev) return null
  // MediaWiki returns content in either rev['*'] (old format) or rev.slots.main['*']
  return rev['*'] ?? rev.slots?.main['*'] ?? null
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch and parse the infobox for an exact Wikipedia page title.
 *
 * @param title  Exact Wikipedia article title, e.g. `"Anglo-Irish_Treaty"`.
 * @param ttl    Cache TTL in ms (default 1 h).
 */
export async function fetchInfoboxByTitle(title: string, ttl?: number): Promise<Infobox> {
  const url = makeRevisionUrl(title)
  const data = (await fetchWithCache(url, ttl)) as WikiApiResponse

  const pages = Object.values(data.query.pages)
  for (const page of pages) {
    if (page.missing !== undefined || page.invalid !== undefined) continue
    const wikitext = extractWikitext(page)
    if (wikitext) return parseInfobox(wikitext)
  }

  return {}
}

/**
 * Search Wikipedia for `query`, then fetch and parse the infobox of the
 * top-ranked result.
 *
 * @param query  Free-text search query, e.g. `"republic of ireland"`.
 * @param ttl    Cache TTL in ms (default 1 h).
 */
export async function fetchInfoboxBySearch(query: string, ttl?: number): Promise<Infobox> {
  const url = makeSearchUrl(query)
  const data = (await fetchWithCache(url, ttl)) as WikiSearchResponse

  const hits = data.query.search ?? []
  if (hits.length === 0) return {}

  return fetchInfoboxByTitle(hits[0].title, ttl)
}
