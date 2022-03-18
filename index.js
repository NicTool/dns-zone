
const nearley = require('nearley')
const grammar = require('./grammar.js')
grammar.start = 'main'

exports.parseZoneFile = str => {

  const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar))
  parser.feed(str)
  parser.feed(`\n`)  // for no EOL after last record

  if (parser.length > 1) {
    console.error(`ERROR: ambigious parser rule`)
  }

  // flatten the parser generated array
  const flat = []
  for (const e of parser.results[0][0]) {

    // discard blank lines
    if (Array.isArray(e[0][0]) && e[0][0][0] === null) continue

    flat.push(e[0][0])
  }
  return flat
}
