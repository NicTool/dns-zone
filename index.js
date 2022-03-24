
const RR = require('dns-resource-record')
const rr = new RR.A(null)

exports.parseZoneFile = async str => {

  const nearley = require('nearley')
  const grammar = nearley.Grammar.fromCompiled(require('./grammar.js'))
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

exports.parseTinydnsData = async str => {
  // https://cr.yp.to/djbdns/tinydns-data.html
  const rrs = []

  for (const line of str.split('\n')) {
    if (line === '') continue // "Blank lines are ignored"
    if (/^#/.test(line)) continue // "Comment line. The line is ignored."
    switch (line[0]) {  // first char of line
      case '%':  // location
        break
      case '-':  // ignored
        break
      case '.':  // NS, A, SOA
        rrs.push(...parseTinyDot(line))
        break
      case '&':  // NS, A
        rrs.push(...parseTinyAmpersand(line))
        break
      case '=':  // A, PTR
        rrs.push(...parseTinyEquals(line))
        break
      case '+':  // A
        rrs.push(new RR.A({ tinyline: line }))
        break
      case '@':  // MX, A
        rrs.push(...parseTinyAt(line))
        break
      case '\'': // TXT
        rrs.push(new RR.TXT({ tinyline: line }))
        break
      case '^':  // PTR
        rrs.push(new RR.PTR({ tinyline: line }))
        break
      case 'C':  // CNAME
        rrs.push(new RR.CNAME({ tinyline: line }))
        break
      case 'Z':  // SOA
        rrs.push(new RR.SOA({ tinyline: line }))
        break
      case ':':  // generic
        rrs.push(parseTinyGeneric(line))
        break
      case '3':
        rrs.push(new RR.AAAA({ tinyline: line }))
        break
      case '6':
        rrs.push(...parseTinySix(line))
        break
      case 'S':  // SRV
        rrs.push(new RR.SRV({ tinyline: line }))
        break
      default:
        throw new Error(`garbage found in tinydns data: ${line}`)
    }
    // console.log(line)
  }

  return rrs
}

function parseTinyDot (str) {
  /*
  * .fqdn:ip:x:ttl:timestamp:lo
  * an NS (``name server'') record showing x.ns.fqdn as a name server for fqdn;
  * an A (``address'') record showing ip as the IP address of x.ns.fqdn; and
  * an SOA (``start of authority'') record for fqdn listing x.ns.fqdn as the primary name server and hostmaster@fqdn as the contact address.
  */
  const [ fqdn, ip, mname, ttl, ts, loc ] = str.substring(1).split(':')
  const rrs = []

  rrs.push(new RR.NS({
    type     : 'NS',
    name     : rr.fullyQualify(fqdn),
    dname    : rr.fullyQualify(/\./.test(mname) ? mname : `${mname}.ns.${fqdn}`),
    ttl      : parseInt(ttl, 10),
    timestamp: ts,
    location : loc !== '' && loc !== '\n' ? loc : '',
  }))

  if (ip) {
    rrs.push(new RR.A({
      name     : rr.fullyQualify(/\./.test(mname) ? mname : `${mname}.ns.${fqdn}`),
      type     : 'A',
      address  : ip,
      ttl      : parseInt(ttl, 10),
      timestamp: ts,
      location : loc !== '' && loc !== '\n' ? loc : '',
    }))
  }

  rrs.push(new RR.SOA({
    type     : 'SOA',
    name     : rr.fullyQualify(fqdn),
    mname    : rr.fullyQualify(/\./.test(mname) ? mname : `${mname}.ns.${fqdn}`),
    rname    : rr.fullyQualify(`hostmaster.{fqdn}`),
    serial   : 1647927758,  // TODO, format is epoch seconds
    refresh  : 16384,
    retry    : 2048,
    expire   : 1048576,
    minimum  : 2560,
    ttl      : parseInt(ttl, 10),
    timestamp: parseInt(ts) || '',
    location : loc !== '' && loc !== '\n' ? loc : '',
  }))
  return rrs
}

function parseTinyAmpersand (str) {
  // &fqdn:ip:x:ttl:timestamp:lo

  const [ fqdn, ip, dname, ttl, ts, loc ] = str.substring(1).split(':')
  const rrs = []

  rrs.push(new RR.NS({
    type     : 'NS',
    name     : rr.fullyQualify(fqdn),
    dname    : rr.fullyQualify(/\./.test(dname) ? dname : `${dname}.ns.${fqdn}`),
    ttl      : parseInt(ttl, 10),
    timestamp: ts,
    location : loc !== '' && loc !== '\n' ? loc : '',
  }))

  if (ip) {
    rrs.push(new RR.A({
      name     : rr.fullyQualify(/\./.test(dname) ? dname : `${dname}.ns.${fqdn}`),
      type     : 'A',
      address  : ip,
      ttl      : parseInt(ttl, 10),
      timestamp: ts,
      location : loc !== '' && loc !== '\n' ? loc : '',
    }))
  }

  return rrs
}

function parseTinyEquals (str) {
  // =fqdn:ip:ttl:timestamp:lo
  const rrs = [ new RR.A({ tinyline: str }) ]

  const [ fqdn, ip, ttl, ts, loc ] = str.substring(1).split(':')
  rrs.push(new RR.PTR({
    type     : 'PTR',
    name     : `${ip.split('.').reverse().join('.')}.in-addr.arpa`,
    dname    : rr.fullyQualify(fqdn),
    ttl      : parseInt(ttl, 10),
    timestamp: ts,
    location : loc !== '' && loc !== '\n' ? loc : '',
  }))

  return rrs
}

function parseTinyAt (str) {
  // MX, A  @fqdn:ip:x:dist:ttl:timestamp:lo
  const rrs = [ new RR.MX({ tinyline: str }) ]

  // eslint-disable-next-line no-unused-vars
  const [ fqdn, ip, x, preference, ttl, ts, loc ] = str.substring(1).split(':')
  if (ip) {
    rrs.push(new RR.A({
      name     : rr.fullyQualify(/\./.test(x) ? x : `${x}.mx.${fqdn}`),
      type     : 'A',
      address  : ip,
      ttl      : parseInt(ttl, 10),
      timestamp: ts,
      location : loc !== '' && loc !== '\n' ? loc : '',
    }))
  }

  return rrs
}

function parseTinySix (str) {
  // AAAA,PTR =>  6 fqdn:ip:x:ttl:timestamp:lo
  const rrs = [ new RR.AAAA({ tinyline: str }) ]

  const [ fqdn, rdata, , ttl, ts, loc ] = str.substring(1).split(':')

  rrs.push(new RR.PTR({
    type     : 'PTR',
    name     : `${rdata.split('').reverse().join('.')}.ip6.arpa.`,
    dname    : rr.fullyQualify(fqdn),
    ttl      : parseInt(ttl, 10),
    timestamp: ts,
    location : loc !== '' && loc !== '\n' ? loc : '',
  }))
  return rrs
}

function parseTinyGeneric (str) {
  // generic, :fqdn:n:rdata:ttl:timestamp:lo

  const [ , n, , , , ] = str.substring(1).split(':')

  switch (parseInt(n, 10)) {
    case 13:
      return new RR.HINFO({ tinyline: str })
    case 28:
      return new RR.AAAA({ tinyline: str })
    case 29:
      return new RR.LOC({ tinyline: str })
    case 33:
      return new RR.SRV({ tinyline: str })
    case 35:
      return new RR.NAPTR({ tinyline: str })
    case 39:
      return new RR.DNAME({ tinyline: str })
    case 43:
      return new RR.DS({ tinyline: str })
    case 44:
      return new RR.SSHFP({ tinyline: str })
    case 48:
      return new RR.DNSKEY({ tinyline: str })
    case 52:
      return new RR.TLSA({ tinyline: str })
    case 53:
      return new RR.SMIMEA({ tinyline: str })
    case 99:
      return new RR.SPF({ tinyline: str })
    case 256:
      return new RR.URI({ tinyline: str })
    case 257:
      return new RR.CAA({ tinyline: str })
    default:
      console.log(str)
      throw new Error(`unsupported tinydns generic record (${n})`)
  }
}
