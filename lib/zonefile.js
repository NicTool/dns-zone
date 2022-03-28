
const os = require('os')

const RR = require('dns-resource-record')
const rr = new RR.A(null)

exports.zoneOpts = {}

exports.parseZoneFile = async str => {

  const nearley = require('nearley')
  const grammar = nearley.Grammar.fromCompiled(require('../dist/zonefile-grammar.js'))
  grammar.start = 'main'

  const parser = new nearley.Parser(grammar)
  parser.feed(str)
  if (!str.endsWith(os.EOL)) parser.feed(os.EOL) // no EOL after last record

  if (parser.length > 1) {
    console.error(`ERROR: ambigious parser rule`)
  }

  if (parser.results.length === 0) return []

  const flat = []
  let lastOwner = ''

  if (Array.isArray(parser.results[0])) {
    for (const e of parser.results[0].flat(3)) {

      if (Array.isArray(e)) {
        let r = {}

        r.owner = e[0] ? e[0] : lastOwner; lastOwner = r.owner

        if (e[2] !== undefined)      r.ttl   = e[2]
        if (e[4] && !isObject(e[4])) r.class = e[4]

        // the rdata location varies on presence of ttl and/or class
        if      (isObject(e[6])) r = { ...r, ...e[6] }
        else if (isObject(e[5])) r = { ...r, ...e[5] }
        else if (isObject(e[4])) r = { ...r, ...e[4] }

        flat.push(r)
      }
      else if ('string' === typeof e) {
        flat.push(e)
      }
      else {
        if (e.$TTL) {
          exports.zoneOpts.ttl = e.$TTL
          flat.push(e)
        }
        else if (e.$ORIGIN) {
          exports.zoneOpts.origin = e.$ORIGIN
          flat.push(e)
        }
        else if (e.$INCLUDE) {  // TODO
          throw new Error(`$INCLUDE support not implemented (yet)`)
        }
        else {
          console.dir(e, { depth: null })
          throw new Error('unrecognized parser output')
        }
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
  let ttl = exports.zoneOpts.ttl || 0
  let lastName = ''
  const implicitOrigin = rr.fullyQualify(exports.zoneOpts.origin) // zone 'name' in named.conf
  let origin = implicitOrigin
  const expanded = []
  const empty = [ undefined, null ]

  for (let i = 0; i < zoneArray.length; i++) {
    const entry = zoneArray[i]

    if (entry === '\n') {
      expanded.push(entry); continue
    }

    if (entry.$TTL) {
      ttl = exports.zoneOpts.ttl = entry.$TTL; continue
    }

    // When a zone is first read, there is an implicit $ORIGIN <zone_name>.
    // note the trailing dot. The current $ORIGIN is appended to the domain
    // specified in the $ORIGIN argument if it is not absolute. -- BIND 9
    if (entry.$ORIGIN) {  // declared $ORIGIN in zone file
      origin = rr.fullyQualify(entry.$ORIGIN, implicitOrigin)
      continue
    }
    if (!origin) throw new Error(`zone origin ambiguous, cowardly bailing out`)

    if (ttl === 0 && entry.type === 'SOA' && entry.minimum) {
      exports.zoneOpts.ttl = ttl = entry.minimum
    }
    if (empty.includes(entry.ttl  )) entry.ttl   = ttl
    if (empty.includes(entry.class)) entry.class = 'IN'

    // expand NAME shortcuts
    if (entry.owner === '@') entry.owner = origin

    // "If a line begins with a blank, then the owner is assumed to be the
    // same as that of the previous RR" -- BIND 9 manual
    if (entry.owner === '' && lastName) entry.owner = lastName

    if (entry.owner) {
      entry.owner = rr.fullyQualify(entry.owner, origin)
    }
    else {
      entry.owner = origin
    }

    if (entry.owner !== lastName) lastName = entry.owner

    expandBindRdata(entry, origin, ttl)

    try {
      expanded.push(new RR[entry.type](entry))
    }
    catch (e) {
      console.error(`I encounted the error: '${e.message}'\n`)
      console.error(`\nwhile processing this RR: \n`)
      console.log(entry)
      throw (e)
    }
  }
  return expanded
}

function expandBindRdata (entry, origin, ttl) {
  switch (entry.type) {
    case 'SOA':
      for (const f of [ 'mname', 'rname' ]) {
        entry[f] = rr.fullyQualify(entry[f], origin)
      }
      break
    case 'MX':
      entry.exchange = rr.fullyQualify(entry.exchange, origin)
      break
    case 'NS':
      entry.dname = rr.fullyQualify(entry.dname, origin)
      break
    case 'CNAME':
      entry.cname = rr.fullyQualify(entry.cname, origin)
      break
  }
}
