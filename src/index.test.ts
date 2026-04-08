/**
 * wiki-infoboxes test suite
 *
 * All tests run entirely offline.  The "integration" tests use vi.stubGlobal
 * to replace the global fetch with a mock that returns realistic Wikipedia
 * API fixture responses, verifying the full fetch → parse → return pipeline
 * without any network access.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { fetchSearchInfoBoxes, fetchInfoBoxes, clearCache } from './index.js'
import { parseInfobox } from './wikitext.js'

// ---------------------------------------------------------------------------
// Fixtures – realistic (trimmed) Wikipedia API responses
// ---------------------------------------------------------------------------

const IRELAND_WIKITEXT = `
{{Infobox country
| conventional_long_name = Ireland
| common_name            = Ireland
| linking_name           = the Republic of Ireland
| image_flag             = Flag of Ireland.svg
| capital                = [[Dublin]]
| population_estimate    = {{formatnum:5123536}}
| area_km2               = 70273
}}
`

const TREATY_WIKITEXT = `
{{Infobox treaty
| name        = Anglo-Irish Treaty
| long_name   = Articles of Agreement for a Treaty Between Great Britain and Ireland
| date_signed = 6 December 1921
| location    = [[London]]
}}
`

function makeSearchResponse(hits: Array<{ title: string; pageid: number }>): object {
  return {
    query: {
      search: hits.map((h) => ({ title: h.title, pageid: h.pageid, snippet: '' })),
    },
  }
}

function makeRevisionResponse(title: string, pageid: number, wikitext: string): object {
  return {
    query: {
      pages: {
        [String(pageid)]: {
          pageid,
          ns: 0,
          title,
          revisions: [{ slots: { main: { '*': wikitext } } }],
        },
      },
    },
  }
}

function makeMissingResponse(): object {
  return { query: { pages: { '-1': { ns: 0, title: 'Nonexistent', missing: '' } } } }
}

function makeEmptySearchResponse(): object {
  return { query: { search: [] } }
}

function mockResponse(body: object): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve(body),
  } as unknown as Response
}

// ---------------------------------------------------------------------------
// Offline unit tests – wikitext parser
// ---------------------------------------------------------------------------

describe('parseInfobox', () => {
  it('parses a simple infobox', () => {
    const wikitext = `
{{Infobox country
| name        = Ireland
| common_name = Ireland
| population  = 5000000
}}
`
    const result = parseInfobox(wikitext)
    expect(result.name?.text).toBe('Ireland')
    expect(result.common_name?.text).toBe('Ireland')
    expect(result.population?.text).toBe('5000000')
  })

  it('returns an empty object when no infobox is present', () => {
    expect(parseInfobox('== Intro ==\nSome text.')).toEqual({})
  })

  it('strips [[wikilinks]] leaving display text', () => {
    const wikitext = `
{{Infobox settlement
| official_name = [[Dublin|Dublin City]]
| country       = [[Republic of Ireland|Ireland]]
}}
`
    const result = parseInfobox(wikitext)
    expect(result.official_name?.text).toBe('Dublin City')
    expect(result.country?.text).toBe('Ireland')
  })

  it('strips nested {{templates}} and formats dates', () => {
    const wikitext = `
{{Infobox person
| birth_date = {{birth date|1970|4|15}}
| population = {{formatnum:1234567}}
}}
`
    const result = parseInfobox(wikitext)
    expect(result.birth_date?.text).toBe('1970-4-15')
    expect(result.population?.text).toBe('1234567')
  })

  it('strips <ref> tags from values', () => {
    const wikitext = `
{{Infobox country
| area = 70273<ref name="cso">CSO Ireland</ref>
}}
`
    const result = parseInfobox(wikitext)
    expect(result.area?.text).toBe('70273')
  })

  it('normalises whitespace in keys (spaces → underscores)', () => {
    const wikitext = `
{{Infobox country
| common name = Ireland
| long name   = Republic of Ireland
}}
`
    const result = parseInfobox(wikitext)
    expect(result.common_name?.text).toBe('Ireland')
    expect(result.long_name?.text).toBe('Republic of Ireland')
  })

  it('recognises "Infobox X" prefix', () => {
    const result = parseInfobox('{{Infobox organization\n| name = ACME Corp\n}}')
    expect(result.name?.text).toBe('ACME Corp')
  })

  it('recognises "X infobox" suffix', () => {
    const result = parseInfobox('{{football club infobox\n| name = Celtic FC\n}}')
    expect(result.name?.text).toBe('Celtic FC')
  })

  it('skips non-infobox templates and finds the real infobox', () => {
    const wikitext = `
{{short description|An island nation}}
{{Use Irish English|date=February 2020}}
{{Infobox country
| common_name = Ireland
}}
`
    expect(parseInfobox(wikitext).common_name?.text).toBe('Ireland')
  })

  it('handles bold/italic wikitext markup in values', () => {
    const result = parseInfobox(`{{Infobox country\n| name = '''Republic''' of ''Ireland''\n}}`)
    expect(result.name?.text).toBe('Republic of Ireland')
  })

  it('omits keys with empty values after cleaning', () => {
    const wikitext = `
{{Infobox country
| name    = Ireland
| image   = {{!}}
| blank   =
}}
`
    const result = parseInfobox(wikitext)
    expect(result.name?.text).toBe('Ireland')
    expect(result.image).toBeUndefined()
    expect(result.blank).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Mocked fetch tests – full pipeline without network
// ---------------------------------------------------------------------------

describe('fetchSearchInfoBoxes', () => {
  beforeEach(() => clearCache())
  afterEach(() => vi.unstubAllGlobals())

  it('returns a populated infobox for "republic of ireland"', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        mockResponse(makeSearchResponse([{ title: 'Republic of Ireland', pageid: 26818 }])),
      )
      .mockResolvedValueOnce(
        mockResponse(makeRevisionResponse('Republic of Ireland', 26818, IRELAND_WIKITEXT)),
      )
    vi.stubGlobal('fetch', fetchMock)

    const data = await fetchSearchInfoBoxes('republic of ireland')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(data.common_name?.text).toBe('Ireland')
    expect(data.capital?.text).toBe('Dublin')
  })

  it('returns an empty object when the search returns no hits', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(mockResponse(makeEmptySearchResponse())))

    const data = await fetchSearchInfoBoxes('jaksdjasldjaksdjaskldasd')
    expect(Object.keys(data).length).toBe(0)
  })

  it('returns an empty object when the top result has no infobox', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          mockResponse(makeSearchResponse([{ title: 'Some Article', pageid: 999 }])),
        )
        .mockResolvedValueOnce(
          mockResponse(makeRevisionResponse('Some Article', 999, '== Article ==\nNo infobox here.')),
        ),
    )

    const data = await fetchSearchInfoBoxes('some article')
    expect(Object.keys(data).length).toBe(0)
  })

  it('caches responses and does not re-fetch within TTL', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        mockResponse(makeSearchResponse([{ title: 'Republic of Ireland', pageid: 26818 }])),
      )
      .mockResolvedValueOnce(
        mockResponse(makeRevisionResponse('Republic of Ireland', 26818, IRELAND_WIKITEXT)),
      )
    vi.stubGlobal('fetch', fetchMock)

    await fetchSearchInfoBoxes('republic of ireland')
    await fetchSearchInfoBoxes('republic of ireland') // should hit cache

    expect(fetchMock).toHaveBeenCalledTimes(2) // not 4
  })
})

describe('fetchInfoBoxes', () => {
  beforeEach(() => clearCache())
  afterEach(() => vi.unstubAllGlobals())

  it('returns the correct long_name for Anglo-Irish_Treaty', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          mockResponse(makeRevisionResponse('Anglo-Irish Treaty', 2189, TREATY_WIKITEXT)),
        ),
    )

    const data = await fetchInfoBoxes('Anglo-Irish_Treaty')
    expect(data.long_name?.text).toBe(
      'Articles of Agreement for a Treaty Between Great Britain and Ireland',
    )
    expect(data.date_signed?.text).toBe('6 December 1921')
  })

  it('returns an empty object for a missing page', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(mockResponse(makeMissingResponse())))

    const data = await fetchInfoBoxes('ThisPageDoesNotExist_xyz')
    expect(Object.keys(data).length).toBe(0)
  })

  it('throws when fetch returns a non-OK response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: false, status: 503, statusText: 'Service Unavailable' }),
    )

    await expect(fetchInfoBoxes('Some_Page')).rejects.toThrow('HTTP 503')
  })
})
