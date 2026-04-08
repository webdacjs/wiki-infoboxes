/**
 * Wikitext infobox parser.
 *
 * Parses raw MediaWiki wikitext and extracts the first infobox as a flat
 * key→{text} map, matching the shape previously produced by wtf_wikipedia.
 *
 * The wikitext infobox format looks like:
 *
 *   {{Infobox country
 *   | common_name = Ireland
 *   | population  = {{formatnum:5000000}}
 *   | …
 *   }}
 *
 * Values may themselves contain nested `{{…}}` or `[[…]]` constructs which
 * we strip down to plain text so the caller gets clean `.text` strings.
 */

export interface InfoboxValue {
  text: string
}

export type Infobox = Record<string, InfoboxValue>

// ---------------------------------------------------------------------------
// Infobox detection heuristics (mirrors wtf_wikipedia's _infobox.js logic)
// ---------------------------------------------------------------------------

const KNOWN_INFOBOXES = new Set([
  'gnf protein box',
  'automatic taxobox',
  'chembox',
  'editnotice',
  'geobox',
  'hybridbox',
  'ichnobox',
  'infraspeciesbox',
  'mycomorphbox',
  'oobox',
  'paraphyletic group',
  'speciesbox',
  'subspeciesbox',
  'starbox short',
  'taxobox',
  'nhlteamseason',
  'protein',
])

const I18N_PREFIXES = ['infobox', 'ficha de', 'ficha', 'шаблон', 'plantilla']
const I18N_REG = new RegExp('^(' + I18N_PREFIXES.join('|') + ')[ :]', 'i')
const START_REG = /^infobox /i
const END_REG = / infobox$/i
const YEAR_IN_REG = /^year in [A-Z]/

function isInfoboxName(name: string): boolean {
  const lower = name.toLowerCase().trim()
  if (KNOWN_INFOBOXES.has(lower)) return true
  if (I18N_REG.test(lower)) return true
  if (START_REG.test(name)) return true
  if (END_REG.test(name)) return true
  if (YEAR_IN_REG.test(name)) return true
  return false
}

// ---------------------------------------------------------------------------
// Template boundary finder
// Finds the end of a {{…}} block handling arbitrary nesting.
// ---------------------------------------------------------------------------

function findTemplateEnd(wikitext: string, start: number): number {
  let depth = 0
  for (let i = start; i < wikitext.length - 1; i++) {
    if (wikitext[i] === '{' && wikitext[i + 1] === '{') {
      depth++
      i++
    } else if (wikitext[i] === '}' && wikitext[i + 1] === '}') {
      depth--
      i++
      if (depth === 0) return i + 1
    }
  }
  return -1
}

// ---------------------------------------------------------------------------
// Value cleaner
// Strips wikitext markup from a raw template-parameter value.
// ---------------------------------------------------------------------------

/** Remove nested {{…}} templates, keeping only plain-text fallbacks. */
function stripTemplates(str: string): string {
  // Iteratively unwrap innermost {{…}} until none remain.
  let prev = ''
  while (prev !== str) {
    prev = str
    str = str.replace(/\{\{[^{}]*\}\}/g, (match) => {
      const inner = match.slice(2, -2)

      // {{function:arg}} — e.g. {{formatnum:1234567}} → "1234567"
      const colonIdx = inner.indexOf(':')
      if (colonIdx !== -1) {
        const afterColon = inner.slice(colonIdx + 1).trim()
        // Drop any trailing pipe-separated params (e.g. {{PLURAL:n|word}})
        return afterColon.split('|')[0].trim()
      }

      const parts = inner.split('|').map((p) => p.trim()).filter(Boolean)
      if (parts.length === 0) return ''

      const name = parts[0].toLowerCase()

      // Date templates: {{birth date|YYYY|MM|DD}} → "YYYY-MM-DD"
      if (/^(birth|death|start|end)[ _]date/.test(name) || name === 'date') {
        const dateParts = parts.slice(1).filter((p) => /^\d+$/.test(p))
        if (dateParts.length >= 3) return `${dateParts[0]}-${dateParts[1]}-${dateParts[2]}`
        if (dateParts.length === 2) return `${dateParts[0]}-${dateParts[1]}`
        if (dateParts.length === 1) return dateParts[0]
      }

      // Single-arg display templates: {{nowrap|text}}, {{small|text}},
      // {{lang|en|text}}, {{hlist|a|b|c}} → "a, b, c"
      if (parts.length === 2) return parts[1]
      if (parts.length > 2) {
        // For list-like templates return comma-joined values
        return parts.slice(1).join(', ')
      }

      return ''
    })
  }
  return str
}

/** Convert [[Target|Display]] or [[Target]] wiki-links to plain text. */
function stripLinks(str: string): string {
  return str.replace(/\[\[([^\]]+)\]\]/g, (_match, inner) => {
    const parts = inner.split('|')
    return parts[parts.length - 1].trim()
  })
}

/** Strip HTML-ish tags used in wikitext (e.g. <ref>…</ref>, <br/>, etc.). */
function stripTags(str: string): string {
  return str
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/<[^>]+>/g, '')
}

/** Normalise whitespace and remove wikitext bold/italic markup. */
function normalise(str: string): string {
  return str
    .replace(/'{2,3}/g, '') // '''bold''' / ''italic''
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanValue(raw: string): string {
  let v = raw
  v = stripTags(v)
  v = stripTemplates(v)
  v = stripLinks(v)
  v = normalise(v)
  return v
}

// ---------------------------------------------------------------------------
// Template body key=value parser
// Splits on top-level `|` characters (not inside nested {{ or [[ blocks).
// ---------------------------------------------------------------------------

function splitTopLevelPipes(body: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''

  for (let i = 0; i < body.length; i++) {
    const ch = body[i]
    if (ch === '{' && body[i + 1] === '{') {
      depth++
      current += ch
    } else if (ch === '}' && body[i + 1] === '}') {
      depth--
      current += ch
    } else if (ch === '[' && body[i + 1] === '[') {
      depth++
      current += ch
    } else if (ch === ']' && body[i + 1] === ']') {
      depth--
      current += ch
    } else if (ch === '|' && depth === 0) {
      parts.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  if (current) parts.push(current)
  return parts
}

function parseTemplateBody(body: string): Infobox {
  const result: Infobox = {}
  const parts = splitTopLevelPipes(body)

  // Skip the first part (template name)
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]
    const eqIdx = part.indexOf('=')
    if (eqIdx === -1) continue

    const key = part.slice(0, eqIdx).trim().toLowerCase().replace(/\s+/g, '_')
    const rawValue = part.slice(eqIdx + 1)
    const text = cleanValue(rawValue)

    if (key && text) {
      result[key] = { text }
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse raw MediaWiki wikitext and return the first infobox found,
 * or an empty object if none is present.
 */
export function parseInfobox(wikitext: string): Infobox {
  let pos = 0

  while (pos < wikitext.length) {
    const openIdx = wikitext.indexOf('{{', pos)
    if (openIdx === -1) break

    const closeIdx = findTemplateEnd(wikitext, openIdx)
    if (closeIdx === -1) break

    const fullTemplate = wikitext.slice(openIdx, closeIdx)
    // Strip outer {{ }}
    const body = fullTemplate.slice(2, -2)

    // Extract template name (up to first | or end)
    const pipeIdx = body.indexOf('|')
    const templateName = (pipeIdx === -1 ? body : body.slice(0, pipeIdx)).trim()

    if (isInfoboxName(templateName)) {
      return parseTemplateBody(body)
    }

    pos = closeIdx
  }

  return {}
}
