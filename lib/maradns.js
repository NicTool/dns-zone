
const os = require('os')

const RR = require('dns-resource-record')
const rr = new RR.AAAA(null)
const dnsu = require('./util')

exports.zoneOpts = {}

exports.parseZoneFile = async str => {

  let parser

  try {
    const nearley = require('nearley')
    const grammar = nearley.Grammar.fromCompiled(require('../dist/mara.js'))
    grammar.start = 'main'
    parser = new nearley.Parser(grammar)

    str = str.replace(/#[^\n\r{]+[\n\r]/gm, '') // strip inner comments

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

      if (typeof e === 'string') {
        flat.push(e); continue
      }

      if (isObject(e)) {
        flat.push(e); continue
      }

      console.log(`e not recognized, ${typeof e}`)
      console.log(e)
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
    if (z === os.EOL) continue // blank line
    if (z[0] === '#') continue // comment

    if (/[%]/.test(z.owner)) {
      z.owner = z.owner.replace(/%/g, origin)
    }
    if ([ null, undefined, '' ].includes(z.ttl)) {
      z.ttl = exports.zoneOpts.ttl
    }

    switch (z.type) {
      case 'FQDN4':
        expanded.push(new RR.A({
          owner  : z.owner,
          ttl    : z.ttl,
          type   : 'A',
          address: z.address,
        }))
        expanded.push(new RR.PTR({
          owner: z.address.split('.').reverse().join('.') + '.in-addr.arpa.',
          ttl  : z.ttl,
          type : 'PTR',
          dname: z.owner,
        }))
        continue
      case 'FQDN6':
        expanded.push(new RR.AAAA({
          owner  : z.owner,
          ttl    : z.ttl,
          type   : 'AAAA',
          address: z.address,
        }))
        expanded.push(new RR.PTR({
          owner: rr.expand(z.address).split(':').join('').split('').reverse().join('.') + '.ip6.arpa.',
          ttl  : z.ttl,
          type : 'PTR',
          dname: z.owner,
        }))
        continue
      case 'RAW':
        // TODO
        continue
      case 'PTR':
        if (!z.owner.endsWith('.')) {
          if (/[A-Fa-f]/.test(z.owner)) {
            z.owner = `${z.owner}.ip6.arpa.`
          }
          else {
            z.owner = `${z.owner}.in-addr.arpa.`
          }
        }
        break
      case undefined:
      case null:
        console.error(z)
        throw new Error('invalid/unparseable RR')
    }

    Object.keys(z).map(k => {
      if ([ 'owner', 'ttl' ].includes(k)) return

      if ([ 'exchange', 'dname', 'cname', 'mname', 'rname', 'target' ].includes(k) && /%/.test(z[k])) {
        z[k] = rr.fullyQualify(z[k].replace(/%/g, exports.zoneOpts.origin))
      }

      if (k === 'rname' && /@/.test(z[k])) z[k] = z[k].replace(/@/g, '.')

      // TODO: if file was set, use fs.stat
      if (k === 'serial' && z[k] === '/serial') z[k] = dnsu.serialByDate()
    })

    if (exports.zoneOpts.verbose) console.dir(z, { depth: null })
    try {
      expanded.push(new RR[z.type](z))
    }
    catch (e) {
      console.error(e.message)
      console.error(z)
      throw new Error('Unable to validate previous RR')
    }
  }

  return expanded
}

