
const os = require('os')

const RR = require('dns-resource-record')
const rr = new RR.A(null)

exports.zoneOpts = {}

exports.parseZoneFile = async str => {

  let parser

  try {
    const nearley = require('nearley')
    const grammar = nearley.Grammar.fromCompiled(require('../dist/csv2-grammar.js'))
    grammar.start = 'main'
    parser = new nearley.Parser(grammar)
    parser.feed(str)
    if (!str.endsWith(os.EOL)) parser.feed(os.EOL) // no EOL after last record
  }
  catch (e) {
    console.error('ERROR encountered during parsing:\n\n')
    console.error(e)
    return
  }

  if (parser.length > 1) {
    console.error(`ERROR: ambigious parser rule`)
  }

  if (parser.results.length === 0) return []

  // console.log('parser.results')
  // console.dir(parser.results[0].flat(2), { depth: null })

  const flat = []
  // let lastOwner = ''

  if (Array.isArray(parser.results[0])) {
    for (const e of parser.results[0].flat(2)) {

      if (Array.isArray(e)) {

        const eflat = e.flat(Infinity)
        // console.log('e')
        // console.log(e)

        const noNulls = eflat.filter(f => f !== null)
        const allEol = noNulls.filter(f => f === os.EOL)
        if (allEol.length === noNulls.length) {
          console.log('allEol')
          flat.push(...noNulls)
          continue
        }

        const objects = eflat.filter(f => isObject(f))
        if (objects.length === 1) {
          flat.push({ owner: eflat[0], ...objects[0] })
          continue
        }

        console.log('e flat')
        console.log(eflat)
      }
      else {
        if (typeof e === 'string') { flat.push(e); continue }
        console.log(`e not array, ${typeof e}`)
        console.log(e)
      }
    }
  }
  else {
    console.log(`parser.results:`)
    console.dir(parser.results, { depth: null })
    throw new Error(`unsupported parser results`)
  }

  return flat
}

function isObject (o) {
  if (Array.isArray(o)) return false
  if (o === null) return false
  return 'object' === typeof o
}

exports.expandShortcuts = async zoneArray => {
  const expanded = []
  const origin = exports.zoneOpts.origin

  for (const z of zoneArray) {

    if (/[%]/.test(z.owner)) {
      z.owner = z.owner.replace(/%/g, origin)
    }
    if ([ null, undefined, '' ].includes(z.ttl)) {
      z.ttl = exports.zoneOpts.ttl
    }

    Object.keys(z).map(k => {
      if ([ 'owner', 'ttl' ].includes(k)) return

      if ([ 'exchange', 'dname', 'cname', 'mname', 'rname' ].includes(k) && /%/.test(z[k])) {
        z[k] = rr.fullyQualify(z[k].replace(/%/g, exports.zoneOpts.origin))
      }
    })

    // console.dir(z, { depth: null })
    expanded.push(new RR[z.type](z))
  }


  return expanded
}

