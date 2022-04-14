
import RR from 'dns-resource-record'

const rr = new RR.A(null)

export async function parseData (str) {
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
    owner    : rr.fullyQualify(fqdn),
    ttl      : parseInt(ttl, 10),
    type     : 'NS',
    dname    : rr.fullyQualify(/\./.test(mname) ? mname : `${mname}.ns.${fqdn}`),
    timestamp: ts,
    location : loc !== '' && loc !== '\n' ? loc : '',
  }))

  if (ip) {
    rrs.push(new RR.A({
      owner    : rr.fullyQualify(/\./.test(mname) ? mname : `${mname}.ns.${fqdn}`),
      type     : 'A',
      address  : ip,
      ttl      : parseInt(ttl, 10),
      timestamp: ts,
      location : loc !== '' && loc !== '\n' ? loc : '',
    }))
  }

  rrs.push(new RR.SOA({
    owner    : rr.fullyQualify(fqdn),
    ttl      : parseInt(ttl, 10),
    type     : 'SOA',
    mname    : rr.fullyQualify(/\./.test(mname) ? mname : `${mname}.ns.${fqdn}`),
    rname    : rr.fullyQualify(`hostmaster.{fqdn}`),
    serial   : 1647927758,  // TODO, format is epoch seconds
    refresh  : 16384,
    retry    : 2048,
    expire   : 1048576,
    minimum  : 2560,
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
    owner    : rr.fullyQualify(fqdn),
    dname    : rr.fullyQualify(/\./.test(dname) ? dname : `${dname}.ns.${fqdn}`),
    ttl      : parseInt(ttl, 10),
    timestamp: ts,
    location : loc !== '' && loc !== '\n' ? loc : '',
  }))

  if (ip) {
    rrs.push(new RR.A({
      owner    : rr.fullyQualify(/\./.test(dname) ? dname : `${dname}.ns.${fqdn}`),
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
    owner    : `${ip.split('.').reverse().join('.')}.in-addr.arpa`,
    ttl      : parseInt(ttl, 10),
    type     : 'PTR',
    dname    : rr.fullyQualify(fqdn),
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
      owner    : rr.fullyQualify(/\./.test(x) ? x : `${x}.mx.${fqdn}`),
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
    owner    : `${rdata.split('').reverse().join('.')}.ip6.arpa.`,
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
