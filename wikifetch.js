const { fetch } = require('simple-fetch-cache')
const repand = str => str.replace(/&/gi, ' and ')
const wikiprefix = 'https://en.wikipedia.org/w/api.php?action=query&format=json'

async function wikiFetch (suffix, value) {
  const res = await fetch(`${wikiprefix}${suffix}${repand(value)}`, 3600000)
  return res.reply
}

module.exports = wikiFetch
