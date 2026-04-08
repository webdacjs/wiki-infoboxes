# wiki-infoboxes

> Extract Wikipedia article infoboxes as structured JSON — zero runtime dependencies.

As defined by Wikipedia: *An infobox is a fixed-format table usually added to the top right-hand corner of articles to consistently present a summary of some unifying aspect that the articles share.*

## Install

```sh
pnpm install wiki-infoboxes
```

## Usage

```ts
import { fetchInfoBoxes, fetchSearchInfoBoxes } from 'wiki-infoboxes'

// Exact article title
const data = await fetchInfoBoxes('Anglo-Irish_Treaty')
console.log(data)
// {
//   name:      { text: 'Anglo-Irish Treaty' },
//   long_name: { text: 'Articles of Agreement for a Treaty Between Great Britain and Ireland' },
//   date_signed: { text: '6 December 1921' },
//   …
// }

// Free-text search (uses the top result)
const data2 = await fetchSearchInfoBoxes('republic of ireland')
console.log(data2.common_name.text)  // → 'Ireland'
```

CommonJS works too:

```js
const { fetchInfoBoxes, fetchSearchInfoBoxes } = require('wiki-infoboxes')
```

## API

### `fetchInfoBoxes(title, ttl?): Promise<Infobox>`

Fetches the infobox for the exact Wikipedia page `title`.  
`ttl` controls the in-memory cache lifetime in milliseconds (default: `3_600_000` — 1 hour).

### `fetchSearchInfoBoxes(query, ttl?): Promise<Infobox>`

Runs a Wikipedia search for `query` and returns the infobox of the top result.

### `clearCache(): void`

Invalidates all cached responses (useful in tests).

### Types

```ts
interface InfoboxValue { text: string }
type Infobox = Record<string, InfoboxValue>
```

## Architecture

The package ships **zero runtime dependencies**.  Functionality previously
provided by third-party libraries is reimplemented locally:

| Old dependency       | Replaced by                          |
|----------------------|--------------------------------------|
| `wtf_wikipedia`      | `src/wikitext.ts` — infobox parser<br>`src/wikipedia.ts` — MediaWiki API client |
| `simple-fetch-cache` | `src/cache.ts` — in-memory TTL cache |

The build uses [tsup](https://tsup.egoist.dev/) and emits both **ESM** (`dist/index.js`) and **CJS** (`dist/index.cjs`) bundles with TypeScript declarations.

## Development

```sh
npm install
npm run build    # compile with tsup
npm test         # run Jest (offline unit tests + integration tests)
```

## License

MIT © [Juan Convers](https://juanconvers.com/)
