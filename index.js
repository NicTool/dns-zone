
const RR = require('dns-resource-record')
const rr = new RR.A(null)

exports.parseZoneFile = async str => {

  const nearley = require('nearley')
  const grammar = nearley.Grammar.fromCompiled(require('./lib/grammar.js'))
  grammar.start = 'main'

  const parser = new nearley.Parser(grammar)
  parser.feed(str)
  parser.feed(`\n`)  // in case no EOL after last record

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

exports.expandShortcuts = async zoneArray => {
  let ttl = 0
  let implicitOrigin = ''
  let origin = ''
  let lastName = ''
  const expanded = []
  const empty = [ undefined, null ]
  // console.log(zoneArray)

  for (let i = 0; i < zoneArray.length; i++) {
    const entry = zoneArray[i]

    if (entry.$TTL) {
      ttl = entry.$TTL; continue
    }

    // When a zone is first read, there is an implicit $ORIGIN <zone_name>.
    // note the trailing dot. The current $ORIGIN is appended to the domain
    // specified in the $ORIGIN argument if it is not absolute. -- BIND 9
    if (entry.implicitOrigin) {  // zone 'name' in named.conf
      implicitOrigin = origin = rr.fullyQualify(entry.implicitOrigin)
      continue
    }
    if (entry.$ORIGIN) {  // declared $ORIGIN within zone file
      origin = rr.fullyQualify(entry.$ORIGIN, implicitOrigin)
      continue
    }
    if (!origin) throw new Error(`zone origin ambiguous, cowardly bailing out`)

    if (ttl === 0 && entry.type === 'SOA' && entry.minimum) ttl = entry.minimum
    if (empty.includes(entry.ttl  )) entry.ttl   = ttl
    if (empty.includes(entry.class)) entry.class = 'IN'

    // expand NAME shortcuts
    if (entry.name === '@') entry.name = origin

    // "If a line begins with a blank, then the owner is assumed to be the
    // same as that of the previous RR" -- BIND 9 manual
    if (entry.name === '' && lastName) entry.name = lastName

    if (entry.name) {
      entry.name = rr.fullyQualify(entry.name, origin)
    }
    else {
      entry.name = origin
    }

    if (entry.name !== lastName) lastName = entry.name

    expandBindRdata(entry, origin, ttl)

    try {
      expanded.push(new RR[entry.type](entry))
    }
    catch (e) {
      console.error(`I encounted this error: \n`)
      console.error(e.message)
      console.error(`\nwhile processing this RR: \n`)
      console.log(entry)
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

