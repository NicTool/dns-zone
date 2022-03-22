
const nearley = require('nearley')
const RR = require('dns-resource-record')

const grammar = nearley.Grammar.fromCompiled(require('./grammar.js'))
grammar.start = 'main'

exports.parseZoneFile = async str => {

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
      ttl = entry.$TTL
      continue
    }
    // When a zone is first read, there is an implicit $ORIGIN <zone_name>.
    // note the trailing dot. The current $ORIGIN is appended to the domain
    // specified in the $ORIGIN argument if it is not absolute. -- BIND 9
    if (entry.implicitOrigin) {
      implicitOrigin = fullyQualify(entry.implicitOrigin)
      origin = fullyQualify(entry.implicitOrigin)
      continue
    }
    if (entry.$ORIGIN) {
      origin = fullyQualify(entry.$ORIGIN, implicitOrigin)
      continue
    }
    if (!origin) throw new Error(`zone origin ambiguous, cowardly bailing out`)

    if (empty.includes(entry.ttl  )) entry.ttl   = ttl
    if (empty.includes(entry.class)) entry.class = 'IN'

    // expand NAME shortcuts
    if (entry.name === '@') entry.name = origin

    // "If a line begins with a blank, then the owner is assumed to be the
    // same as that of the previous RR" -- BIND 9 manual
    if (entry.name === '' && lastName) entry.name = lastName

    if (entry.name) {
      entry.name = fullyQualify(entry.name, origin)
    }
    else {
      entry.name = `${origin}`.toLowerCase()
    }

    if (entry.name !== lastName) lastName = entry.name

    // expand rdata shortcuts
    switch (entry.type) {
      case 'SOA':
        for (const f of [ 'mname', 'rname' ]) {
          entry[f] = fullyQualify(entry[f], origin)
        }
        if (entry.minimum && ttl === 0) ttl = entry.minimum
        break
      case 'MX':
        entry.exchange = fullyQualify(entry.exchange, origin)
        break
      case 'NS':
        entry.dname = fullyQualify(entry.dname, origin)
        break
    }

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

function fullyQualify (hostname, origin) {
  if (hostname.endsWith('.')) return hostname
  return `${hostname}.${origin}`.toLowerCase()
}
