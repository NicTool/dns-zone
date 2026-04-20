import * as RR from '@nictool/dns-resource-record'

import * as dz from '../index.js'

const rr = new RR.AAAA(null)

export const zoneOpts = {}

export default { zoneOpts, parseZoneFile }

const re = {
  zoneTTL: /^\/ttl\s+([0-9]{1,5})\s*~/,
  zoneOrigin: /^\/origin\s+([^\s]+)\s*~/,
}

const pipeTypes = new Set([
  'a',
  'aaaa',
  'fqdn4',
  'fqdn6',
  'hinfo',
  'loc',
  'mx',
  'naptr',
  'ns',
  'ptr',
  'raw',
  'soa',
  'srv',
  'txt',
  'spf',
])

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

  let type = null
  saved = pos
  const tok3 = readToken()
  if (pipeTypes.has(tok3.toLowerCase())) {
    type = tok3
  } else {
    pos = saved
  }

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
  if (i < fields.length && pipeTypes.has(fields[i].trim().toLowerCase())) {
    type = fields[i].trim()
    i++
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
        if (!processRaw(iterRR)) continue
        break
      case 'HINFO':
        iterRR.rdata = iterRR.rdata.replaceAll(';', ' ').replaceAll("'", '"')
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
    try {
      res.push(new RR[iterRR.type]({ bindline: asBind }))
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
      owner: rr.expand(irr.rdata).split(':').join('').split('').reverse().join('.') + '.ip6.arpa.',
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

function processNAPTR(rr) {
  const match = rr.rdata.trim().match(/^([0-9]+)\s+([0-9]+)\s+('[^']*');('[^']*');('[^']*')\s+(\S+)$/)
  if (!match) throw new Error(`unable to parse NAPTR: ${rr.rdata}`)
  rr.rdata = match.slice(1).join(' ').replaceAll("'", '"')
}

function processRaw(irr) {
  const trimmed = irr.rdata.trim()
  const spaceIdx = trimmed.indexOf(' ')
  if (spaceIdx === -1) return false
  const typeId = trimmed.slice(0, spaceIdx)
  const rest = trimmed.slice(spaceIdx + 1).trim()

  switch (typeId) {
    case '257': {
      const wire = parseRawWire(rest)
      const flags = wire[0]
      const tagLen = wire[1]
      const tag = wire.slice(2, 2 + tagLen).toString()
      const value = wire.slice(2 + tagLen).toString()
      irr.type = 'CAA'
      irr.rdata = `${flags} ${tag} "${value}"`
      return true
    }
    default:
      return false
  }
}

function parseRawWire(str) {
  const bytes = []
  let i = 0
  while (i < str.length) {
    if (str[i] === '\\' && str[i + 1] === 'x' && /^[0-9a-f]{2}$/i.test(str.slice(i + 2, i + 4))) {
      bytes.push(parseInt(str.slice(i + 2, i + 4), 16))
      i += 4
    } else if (str[i] === "'") {
      i += 1
    } else {
      bytes.push(str.charCodeAt(i))
      i += 1
    }
  }
  return Buffer.from(bytes)
}

function naturallyQuoted(str) {
  // untangle the bizarre forms of quoting Mara allows
  let r = ''
  let inQuotes = false
  for (const c of str) {
    if (c === "'") inQuotes = !inQuotes
    if (inQuotes && c !== "'") {
      r += c
    } else {
      if (!/[\s']/.test(c)) r += c
    }
  }
  return `"${r}"`
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
