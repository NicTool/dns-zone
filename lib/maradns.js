import * as RR from '@nictool/dns-resource-record'

import * as dz from '../index.js'

const rr = new RR.AAAA(null)

export const zoneOpts = {}

export default { zoneOpts, parseZoneFile }

const re = {
  zoneTTL: /^\/ttl\s+([0-9]{1,5})\s*~/,
  zoneOrigin: /^\/origin\s+([^\s]+)\s*~/,
}

// csv2(5) record types. A line whose type is omitted is an A record.
const csv2Types = new Set(
  'a ptr mx aaaa srv naptr ns soa txt spf raw fqdn4 fqdn6 cname hinfo wks md mf mb mg minfo mr afsdb rp x25 isdn rt nsap nsap-ptr px gpos loc'.split(
    ' ',
  ),
)

// An omitted type leaves IPv4 rdata, so a word here can only be a type.
function csv2Type(token) {
  if (csv2Types.has(token.toLowerCase())) return token
  if (/^[a-z]/i.test(token)) throw new Error(`unsupported csv2 type: ${token}`)
  return null
}

function isDigits(s) {
  if (!s.length) return false
  for (let i = 0; i < s.length; i++) {
    if (s[i] < '0' || s[i] > '9') return false
  }
  return true
}

function parseZoneRR(line) {
  const tilde = line.indexOf('~')
  if (tilde === -1) return null
  if (line.slice(0, tilde).includes('|')) return null // pipe-delimited; handled by parsePipeDelim

  let pos = 0
  const end = tilde

  function skipWS() {
    while (pos < end && (line[pos] === ' ' || line[pos] === '\t')) pos++
  }
  function readToken() {
    skipWS()
    const start = pos
    while (pos < end && line[pos] !== ' ' && line[pos] !== '\t') pos++
    return line.slice(start, pos)
  }

  const owner = readToken()
  if (!owner) return null

  let ttl = null
  let saved = pos
  const tok1 = readToken()
  if (tok1.startsWith('+') && isDigits(tok1.slice(1))) {
    ttl = tok1.slice(1)
  } else {
    pos = saved
  }

  let cls = null
  saved = pos
  const tok2 = readToken()
  if (tok2.toUpperCase() === 'IN') {
    cls = tok2
  } else {
    pos = saved
  }

  saved = pos
  const type = csv2Type(readToken())
  if (!type) pos = saved

  skipWS()
  const rdata = line.slice(pos, end)
  return [null, owner, ttl, cls, type, rdata]
}

function parsePipeDelim(line) {
  const fields = line.split('|')
  if (fields.length < 3) return null
  if (fields.pop().trim() !== '~') return null

  let i = 0
  const owner = fields[i++]
  if (!owner) return null

  let ttl = null
  if (i < fields.length && fields[i].trimStart().startsWith('+')) {
    ttl = fields[i].trim().slice(1)
    i++
  }

  let cls = null
  if (i < fields.length && fields[i].trim().toUpperCase() === 'IN') {
    cls = fields[i].trim()
    i++
  }

  let type = null
  if (i < fields.length) {
    type = csv2Type(fields[i].trim())
    if (type) i++
  }

  const rdata = fields.slice(i).join('|')
  return [null, owner, ttl, cls, type, rdata]
}

export async function parseZoneFile(str, ctx = zoneOpts) {
  const res = []
  let rrWIP = ''

  for (let line of str.split(/\r?\n/)) {
    if (isBlank(line, res, ctx)) continue
    if (isComment(line, res, ctx)) continue

    line = dz.stripComment(line, "'", '#')

    if (isZoneTTL(line, res, ctx)) continue
    if (isZoneOrigin(line, res, ctx)) continue

    if (rrWIP.length) {
      // a continuation was started
      rrWIP += line
      if (!dz.hasUnquoted(line, "'", '~')) {
        continue
      } else {
        // a ~ was seen, finalize the RR
        line = rrWIP
        rrWIP = ''
      }
    }

    if (!dz.hasUnquoted(line, "'", '~')) {
      // record continues on next line
      rrWIP = line // start a continuation
      continue
    }

    let match = parseZoneRR(line)
    if (!match) {
      match = parsePipeDelim(line)
      if (!match) throw new Error(`parse failure, unrecognized: ${line}`)
    }

    const [owner, ttl, c, type, rdata] = match.slice(1)
    const iterRR = {
      owner: owner?.trim(),
      ttl: parseInt(ttl?.trim()) || ctx.ttl || 86400,
      class: c?.trim().toUpperCase() || 'IN',
      type: type?.trim().toUpperCase() ?? 'A',
      rdata: rdata.trim(),
    }

    if (iterRR.owner === '') iterRR.owner = ctx.origin
    expandPercent(iterRR, 'owner', ctx.origin)
    iterRR.rdata = dz.removeChar(iterRR.rdata, "'", '~').trim()

    switch (iterRR.type) {
      case 'CNAME':
      case 'DNAME':
      case 'MX':
      case 'NS':
      case 'SRV':
      case 'URI':
        expandPercent(iterRR, 'rdata', ctx.origin)
        break
      case 'PTR':
        processPTR(iterRR)
        break
      case 'RAW':
        res.push(rawToRR(iterRR))
        continue
      case 'WKS':
        // csv2(5): ports are comma-separated
        iterRR.rdata = iterRR.rdata.replaceAll(',', ' ')
        break
      case 'HINFO':
        iterRR.rdata = naturallyQuoted(iterRR.rdata)
        break
      case 'NAPTR':
        processNAPTR(iterRR)
        break
      case 'SOA':
        iterRR.rdata = dz.replaceChar(iterRR.rdata, "'", '@', '.')
        if (ctx.serial) {
          iterRR.rdata = iterRR.rdata.replace(/\/serial/, ctx.serial)
        }
        break
      case 'SPF':
      case 'TXT':
        iterRR.rdata = naturallyQuoted(iterRR.rdata)
        if (!iterRR.rdata.startsWith('"')) iterRR.rdata = `"${iterRR.rdata}"`
        break
      case 'FQDN4':
        processFQDN4(iterRR, res)
        continue
      case 'FQDN6':
        processFQDN6(iterRR, res)
        continue
      default:
    }

    const asBind = `${iterRR.owner} ${iterRR.ttl} ${iterRR.class} ${iterRR.type} ${iterRR.rdata}`
    if (!RR[iterRR.type]) throw new Error(`unsupported csv2 type ${iterRR.type}: ${line}`)
    try {
      res.push(RR[iterRR.type].fromBind(asBind))
    } catch (e) {
      e.rr = asBind
      throw e
    }
  }

  return res
}

function expandPercent(irr, field, origin) {
  irr[field] = dz.replaceChar(irr[field], "'", '%', origin)
}

function processFQDN6(irr, res) {
  res.push(
    new RR.AAAA({
      owner: irr.owner,
      ttl: irr.ttl,
      type: 'AAAA',
      address: irr.rdata,
    }),
  )
  res.push(
    new RR.PTR({
      owner: rr.expandIPv6(irr.rdata).split(':').join('').split('').reverse().join('.') + '.ip6.arpa.',
      ttl: irr.ttl,
      type: 'PTR',
      dname: irr.owner,
    }),
  )
}

function processFQDN4(irr, res) {
  res.push(
    new RR.A({
      owner: irr.owner,
      ttl: irr.ttl,
      type: 'A',
      address: irr.rdata,
    }),
  )
  res.push(
    new RR.PTR({
      owner: irr.rdata.split('.').reverse().join('.') + '.in-addr.arpa.',
      ttl: irr.ttl,
      type: 'PTR',
      dname: irr.owner,
    }),
  )
}

function processPTR(irr) {
  if (!irr.owner.endsWith('.')) {
    if (/[A-Fa-f]/.test(irr.owner)) {
      irr.owner = `${irr.owner}.ip6.arpa.`
    } else {
      irr.owner = `${irr.owner}.in-addr.arpa.`
    }
  }
}

// order pref 'flags';'service';'regexp' replacement
function parseNAPTR(str) {
  let pos = 0

  const skipWS = () => {
    const start = pos
    while (pos < str.length && (str[pos] === ' ' || str[pos] === '\t')) pos++
    return pos > start
  }
  const readDigits = () => {
    const start = pos
    while (pos < str.length && str[pos] >= '0' && str[pos] <= '9') pos++
    return pos > start ? str.slice(start, pos) : null
  }
  const readQuoted = () => {
    if (str[pos] !== "'") return null
    pos++
    const start = pos
    while (pos < str.length && str[pos] !== "'") pos++
    if (pos >= str.length) return null // unterminated
    return str.slice(start, pos++)
  }

  const order = readDigits()
  if (order === null || !skipWS()) return null

  const preference = readDigits()
  if (preference === null || !skipWS()) return null

  const quoted = []
  for (let i = 0; i < 3; i++) {
    if (i > 0 && str[pos++] !== ';') return null
    const val = readQuoted()
    if (val === null) return null
    quoted.push(`"${val}"`)
  }

  if (!skipWS()) return null
  const start = pos
  while (pos < str.length && str[pos] !== ' ' && str[pos] !== '\t') pos++
  const replacement = str.slice(start, pos)
  if (!replacement || pos !== str.length) return null

  return [order, preference, ...quoted, replacement.replaceAll("'", '"')]
}

function processNAPTR(rr) {
  const parsed = parseNAPTR(rr.rdata.trim())
  if (!parsed) throw new Error(`unable to parse NAPTR: ${rr.rdata}`)
  rr.rdata = parsed.join(' ')
}

// csv2(5) RAW: a numeric type, then the rdata as csv2 text.
function rawToRR(irr) {
  const m = irr.rdata.match(/^(\d+)\s*([\s\S]*)$/)
  if (!m) throw new Error(`RAW needs a numeric type: ${irr.rdata}`)
  const chunks = csv2Chunks(m[2])
  if (chunks.length !== 1) throw new Error(`RAW rdata cannot contain an unquoted ';': ${irr.rdata}`)
  const typeId = Number(m[1])
  const RRClass = RR.classFor(typeId)
  const rr = new RRClass(null).fromWire({
    owner: irr.owner,
    cls: irr.class,
    ttl: irr.ttl,
    rdata: chunks[0],
    typeId,
  })
  if (Buffer.compare(Buffer.from(rr.getWireRdata()), Buffer.from(chunks[0])) !== 0)
    throw new Error(`RAW ${typeId} rdata is not a valid ${RRClass.typeName ?? `TYPE${typeId}`}: ${irr.rdata}`)
  return rr
}

// csv2_txt(5): text inside '...' is literal; outside it, whitespace is
// ignored, \xNN, \NNN (octal) and \' are escapes, and ';' ends a chunk.
function csv2Chunks(str) {
  const enc = new TextEncoder()
  const chunks = [[]]
  let inQuotes = false
  for (let i = 0; i < str.length; i++) {
    const c = str[i]
    if (c === "'") {
      inQuotes = !inQuotes
      continue
    }
    if (!inQuotes) {
      if (/\s/.test(c)) continue
      if (c === ';') {
        chunks.push([])
        continue
      }
      const escape = str.slice(i).match(/^\\(?:x([0-9a-fA-F]{2})|([0-3][0-7]{2})|('))/)
      if (escape) {
        const [seq, hex, octal] = escape
        chunks.at(-1).push(hex ? parseInt(hex, 16) : octal ? parseInt(octal, 8) : 0x27)
        i += seq.length - 1
        continue
      }
    }
    const char = String.fromCodePoint(str.codePointAt(i))
    chunks.at(-1).push(...enc.encode(char))
    i += char.length - 1
  }
  return chunks.map((bytes) => Uint8Array.from(bytes))
}

// Each csv2 chunk as a BIND character-string, escaped per RFC 1035 §5.1.
function naturallyQuoted(str) {
  return csv2Chunks(str)
    .map((bytes) => `"${[...bytes].map(escapeCharStringByte).join('')}"`)
    .join(' ')
}

function escapeCharStringByte(b) {
  if (b === 0x22 || b === 0x5c) return `\\${String.fromCharCode(b)}`
  return b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : `\\${String(b).padStart(3, '0')}`
}

function isBlank(str, res, ctx) {
  if (str.trim() !== '') return false
  if (ctx.showBlank) res.push(str)
  return true
}

function isComment(str, res, ctx) {
  if (!str.trimStart().startsWith('#')) return false
  if (ctx.showComment) res.push(str)
  return true
}

function isZoneOrigin(str, res, ctx) {
  const match = str.match(re.zoneOrigin)
  if (!match) return false
  ctx.origin = rr.fullyQualify(dz.valueCleanup(match[1]))
  return true
}

function isZoneTTL(str, res, ctx) {
  const match = str.match(re.zoneTTL)
  if (!match) return false
  ctx.ttl = dz.valueCleanup(match[1])
  return true
}
