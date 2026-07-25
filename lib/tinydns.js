import * as RR from '@nictool/dns-resource-record'

import * as zone from '../index.js'

const rr = new RR.A(null)

export const zoneOpts = {}

// djbdns tinydns-data SOA defaults — see https://cr.yp.to/djbdns/tinydns-data.html
const SOA_DEFAULTS = {
  refresh: 16384,
  retry: 2048,
  expire: 1048576,
  minimum: 2560,
}

export default { zoneOpts, parseData }

export async function parseData(str, ctx = zoneOpts) {
  // https://cr.yp.to/djbdns/tinydns-data.html
  const rrs = []
  let curLine

  try {
    for (const line of str.split('\n')) {
      curLine = line
      if (line === '') continue // "Blank lines are ignored"
      if (/^#/.test(line)) continue // "Comment line. The line is ignored."
      switch (line[0]) {
        case '%': // location
          break
        case '-': // ignored
          break
        case '.': // NS, A, SOA
          rrs.push(...parseTinyDot(line, ctx))
          break
        case '&': // NS, A
          rrs.push(...parseTinyAmpersand(line))
          break
        case '=': // A, PTR
          rrs.push(...parseTinyEquals(line))
          break
        case '+': // A
          rrs.push(RR.A.fromTinydns(line))
          break
        case '@': // MX, A
          rrs.push(...parseTinyAt(line))
          break
        case "'": // TXT
          rrs.push(RR.TXT.fromTinydns(line))
          break
        case '^': // PTR
          rrs.push(RR.PTR.fromTinydns(line))
          break
        case 'C': // CNAME
          rrs.push(RR.CNAME.fromTinydns(line))
          break
        case 'Z': // SOA
          rrs.push(RR.SOA.fromTinydns(line, { default: ctx }))
          break
        case ':': // generic
          rrs.push(parseTinyGeneric(line))
          break
        case '3':
          rrs.push(RR.AAAA.fromTinydns(line))
          break
        case '6':
          rrs.push(...parseTinySix(line))
          break
        case 'S': // SRV
          rrs.push(RR.SRV.fromTinydns(line))
          break
        default:
          throw new Error(`garbage found in tinydns data: ${line}`)
      }
    }
  } catch (e) {
    e.line = curLine
    throw e
  }

  return rrs
}

function parseTinyDot(str, ctx) {
  /*
   * .fqdn:ip:x:ttl:timestamp:lo
   * an NS (``name server'') record showing x.ns.fqdn as a name server for fqdn;
   * an A (``address'') record showing ip as the IP address of x.ns.fqdn; and
   * an SOA (``start of authority'') record for fqdn listing x.ns.fqdn as the primary name server and hostmaster@fqdn as the contact address.
   */
  const [fqdn, ip, mname, ttl, ts, loc] = str.slice(1).split(':')
  const rrs = []

  rrs.push(
    new RR.SOA({
      owner: rr.fullyQualify(fqdn),
      ttl: parseInt(ttl, 10),
      type: 'SOA',
      mname: rr.fullyQualify(/\./.test(mname) ? mname : `${mname}.ns.${fqdn}`),
      rname: rr.fullyQualify(`hostmaster.${fqdn}`),
      serial: ctx.serial || zone.serialByDate(),
      refresh: SOA_DEFAULTS.refresh,
      retry: SOA_DEFAULTS.retry,
      expire: SOA_DEFAULTS.expire,
      minimum: SOA_DEFAULTS.minimum,
      timestamp: parseInt(ts) || '',
      location: loc?.trim() || '',
    }),
  )

  rrs.push(
    new RR.NS({
      owner: rr.fullyQualify(fqdn),
      ttl: parseInt(ttl, 10),
      type: 'NS',
      dname: rr.fullyQualify(/\./.test(mname) ? mname : `${mname}.ns.${fqdn}`),
      timestamp: ts,
      location: loc?.trim() || '',
    }),
  )

  if (ip) {
    rrs.push(
      new RR.A({
        owner: rr.fullyQualify(/\./.test(mname) ? mname : `${mname}.ns.${fqdn}`),
        type: 'A',
        address: ip,
        ttl: parseInt(ttl, 10),
        timestamp: ts,
        location: loc?.trim() || '',
      }),
    )
  }
  return rrs
}

function parseTinyAmpersand(str) {
  // &fqdn:ip:x:ttl:timestamp:lo

  const [fqdn, ip, dname, ttl, ts, loc] = str.slice(1).split(':')
  const rrs = []

  rrs.push(
    new RR.NS({
      type: 'NS',
      owner: rr.fullyQualify(fqdn),
      dname: rr.fullyQualify(/\./.test(dname) ? dname : `${dname}.ns.${fqdn}`),
      ttl: parseInt(ttl, 10),
      timestamp: ts,
      location: loc?.trim() || '',
    }),
  )

  if (ip) {
    rrs.push(
      new RR.A({
        owner: rr.fullyQualify(/\./.test(dname) ? dname : `${dname}.ns.${fqdn}`),
        type: 'A',
        address: ip,
        ttl: parseInt(ttl, 10),
        timestamp: ts,
        location: loc?.trim() || '',
      }),
    )
  }

  return rrs
}

function parseTinyEquals(str) {
  // =fqdn:ip:ttl:timestamp:lo
  const rrs = [RR.A.fromTinydns(str)]

  const [fqdn, ip, ttl, ts, loc] = str.slice(1).split(':')
  rrs.push(
    new RR.PTR({
      owner: `${ip.split('.').reverse().join('.')}.in-addr.arpa.`,
      ttl: parseInt(ttl, 10),
      type: 'PTR',
      dname: rr.fullyQualify(fqdn),
      timestamp: ts,
      location: loc?.trim() || '',
    }),
  )

  return rrs
}

function parseTinyAt(str) {
  // MX, A  @fqdn:ip:x:dist:ttl:timestamp:lo
  const rrs = [RR.MX.fromTinydns(str)]

  // eslint-disable-next-line no-unused-vars
  const [fqdn, ip, x, preference, ttl, ts, loc] = str.slice(1).split(':')
  if (ip) {
    rrs.push(
      new RR.A({
        owner: rr.fullyQualify(/\./.test(x) ? x : `${x}.mx.${fqdn}`),
        type: 'A',
        address: ip,
        ttl: parseInt(ttl, 10),
        timestamp: ts,
        location: loc?.trim() || '',
      }),
    )
  }

  return rrs
}

function parseTinySix(str) {
  // AAAA,PTR =>  6 fqdn:ip:x:ttl:timestamp:lo
  const [fqdn, rdata, , ttl, ts, loc] = str.slice(1).split(':')
  const rrs = [RR.AAAA.fromTinydns(`3${fqdn}:${rdata}:${ttl}:${ts ?? ''}:${loc ?? ''}`)]

  rrs.push(
    new RR.PTR({
      type: 'PTR',
      owner: `${rdata.split('').reverse().join('.')}.ip6.arpa.`,
      dname: rr.fullyQualify(fqdn),
      ttl: parseInt(ttl, 10),
      timestamp: ts,
      location: loc?.trim() || '',
    }),
  )
  return rrs
}

function parseTinyGeneric(str) {
  // generic, :fqdn:n:rdata:ttl:timestamp:lo

  const [, n] = str.slice(1).split(':')

  switch (parseInt(n, 10)) {
    case 13:
      return RR.HINFO.fromTinydns(str)
    case 28:
      return RR.AAAA.fromTinydns(str)
    case 29:
      return RR.LOC.fromTinydns(str)
    case 33:
      return RR.SRV.fromTinydns(str)
    case 35:
      return RR.NAPTR.fromTinydns(str)
    case 39:
      return RR.DNAME.fromTinydns(str)
    case 43:
      return RR.DS.fromTinydns(str)
    case 44:
      return RR.SSHFP.fromTinydns(str)
    case 45:
      return RR.IPSECKEY.fromTinydns(str)
    case 48:
      return RR.DNSKEY.fromTinydns(str)
    case 52:
      return RR.TLSA.fromTinydns(str)
    case 53:
      return RR.SMIMEA.fromTinydns(str)
    case 99:
      return RR.SPF.fromTinydns(str)
    case 256:
      return RR.URI.fromTinydns(str)
    case 257:
      return RR.CAA.fromTinydns(str)
    default:
      console.log(str)
      throw new Error(`unsupported tinydns generic record (${n})`)
  }
}
