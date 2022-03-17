
const nearley = require('nearley')
const grammar = require('./grammar.js')
grammar.start = 'main'

exports.parseZoneFile = str => {

  const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar))
  parser.feed(str)

  if (parser.length > 1) {
    console.error(`ERROR: ambigious parser rule`)
  }
  return parser.results[0]
}

