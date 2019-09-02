const { fetch } = require('wtf_wikipedia')
const wikifetch = require('./wikifetch')
const wikiSearchUrl = '&list=search&utf8=&srsearch='

async function fetchInfoBoxes (query) {
  const doc = await fetch(query)
  const docjson = doc.json()
  const infoboxesArray = docjson.sections.find(x => x.infoboxes)
  return infoboxesArray ? infoboxesArray.infoboxes[0] : {}
}

async function extractFetch (hits) {
  if (hits.length === 0) {
    return Promise.resolve({})
  }
  const result = await fetchInfoBoxes(hits[0].title)
  return result
}

async function fetchSearchInfoBoxes (query) {
  const res = await wikifetch(wikiSearchUrl, query)
  const results = await extractFetch(res.query.search || [])
  return results
}

module.exports = {
  fetchInfoBoxes,
  fetchSearchInfoBoxes
}
