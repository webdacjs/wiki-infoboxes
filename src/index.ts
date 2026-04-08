/**
 * wiki-infoboxes
 *
 * Extract Wikipedia article infoboxes as structured JSON.
 *
 * @example
 * ```ts
 * import { fetchInfoBoxes, fetchSearchInfoBoxes } from 'wiki-infoboxes'
 *
 * // Exact title
 * const data = await fetchInfoBoxes('Anglo-Irish_Treaty')
 * console.log(data.long_name.text)
 * // → 'Articles of Agreement for a Treaty Between Great Britain and Ireland'
 *
 * // Free-text search
 * const data2 = await fetchSearchInfoBoxes('republic of ireland')
 * console.log(data2.common_name.text)
 * // → 'Ireland'
 * ```
 */

export { fetchInfoboxByTitle as fetchInfoBoxes, fetchInfoboxBySearch as fetchSearchInfoBoxes } from './wikipedia.js'
export { clearCache } from './cache.js'
export type { Infobox, InfoboxValue } from './wikitext.js'
