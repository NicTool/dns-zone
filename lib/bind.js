import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import * as RR from '@nictool/dns-resource-record'

import * as dz from '../index.js'

const rr = new RR.A(null)

export const zoneOpts = {}

export default { zoneOpts, parseZoneFile }

// build a list of RR types that dns-rr supports
const rrTypes = Object.entries(RR)
  .filter(([k, v]) => typeof v === 'function' && k !== 'default')
  .map(([k]) => k)
  .sort((a, b) => b.length - a.length || a.localeCompare(b))
  .join('|')

const re = {
  directive: /^\$(\w{1,16})\s+([^\s;]{1,256})/,
  ttl: '([0-9]+)',
  classes: '(IN|CS|CH|HS|NONE|ANY)',
}
re.zoneRR = new RegExp(`^([^\\s]+)?\\s*${re.ttl}?\\s*${re.classes}?\\s+(${rrTypes}|TYPE[0-9]+)\\s+(.*)$`)

export async function parseZoneFile(str, ctx = zoneOpts) {
  if (ctx.file) str = await includeIncludes(str, ctx)

  const res = []
  const rrWIP = {}

  for (let line of str.split(/\r?\n/)) {
    if (isBlank(line, res, ctx)) continue
    if (isComment(line, res, ctx)) continue
    if (isDirective(line, res, ctx)) continue

    line = dz.stripComment(line, '"', ';')

    if (Object.keys(rrWIP).length) {
      // a continuation started
      resumeContinuation(line, rrWIP, res, ctx)
      continue
    }

    const match = line.match(re.zoneRR)
    if (!match) throw new Error(`parse failure during line:${os.EOL}\t${line}`)

    const [owner, ttl, c, type, rdata] = match.slice(1)
    const iterRR = {
      owner: owner?.trim(),
      ttl: expandTTL(ttl, ctx),
      class: c?.trim().toUpperCase() || 'IN',
      type: type.trim().toUpperCase(),
      rdata: rdata.trim(),
    }

    expandShortcuts(iterRR, ctx)

    if (!dz.hasUnquoted(iterRR.rdata, '"', '(')) {
      // single-line RR
      res.push(parseRR(iterRR, ctx))
      continue
    }

    // the start of a continuation was seen, remove it
    iterRR.rdata = dz.removeChar(iterRR.rdata, '"', '(').trim()

    if (dz.hasUnquoted(iterRR.rdata, '"', ')')) {
      // this is a single line continuation, see also resumeContinuation
      iterRR.rdata = dz.removeChar(iterRR.rdata, '"', ')').trim()
      res.push(parseRR(iterRR, ctx))
      continue
    }

    Object.assign(rrWIP, iterRR)
  }

  return res
}

function expandShortcuts(iterRR, ctx) {
  if (iterRR.owner === '@') iterRR.owner = ctx.origin

  // "If a line begins with a blank, then the owner is assumed to be the
  // same as that of the previous RR" -- BIND 9 manual
  if (!iterRR.owner && ctx.prevOwner) iterRR.owner = ctx.prevOwner
  if (!iterRR.owner) iterRR.owner = ctx.origin

  if (ctx.prevOwner !== iterRR.owner) ctx.prevOwner = iterRR.owner

  iterRR.owner = rr.fullyQualify(iterRR.owner, ctx.origin)

  expandRdataShortcuts(iterRR, ctx)
}

function resumeContinuation(line, rrWIP, res, ctx) {
  // within a zone file, new lines are ignored within parens. A paren was
  // opened, the closing paren will end the RR's rdata
  if (dz.hasUnquoted(line, '"', ')')) {
    // last line of this RR
    rrWIP.rdata += dz.removeChar(line, '"', ')')
    rrWIP.rdata = rrWIP.rdata.replace(/[\s]+/g, ' ') // flatten whitespace
    res.push(parseRR(rrWIP, ctx))
    for (const k of Object.keys(rrWIP)) delete rrWIP[k]
  } else {
    rrWIP.rdata += line
  }
}

function expandRdataShortcuts(iterRR, ctx) {
  switch (iterRR.type) {
    case 'MX':
    case 'NS':
    case 'CNAME':
    case 'DNAME':
      iterRR.rdata = rr.fullyQualify(iterRR.rdata, ctx.origin)
      break
  }
}

function expandTTL(str, ctx) {
  if (!str) return ctx.ttl
  return dz.toSeconds(str.trim())
}

function isBlank(str, res, ctx) {
  if (str.trim() !== '') return false
  if (ctx.showBlank) res.push(str)
  return true
}

function isComment(str, res, ctx) {
  const t = str.trimStart()
  if (!t.startsWith(';') && !t.startsWith('//')) return false
  if (ctx.showComment) res.push(str)
  return true
}

function isDirective(line, res, ctx) {
  const match = line.match(re.directive)
  if (!match) return false

  switch (match[1]) {
    case 'TTL':
      ctx.ttl = dz.valueCleanup(match[2])
      res.push({ $TTL: ctx.ttl })
      return true
    case 'ORIGIN':
      ctx.origin = rr.fullyQualify(dz.valueCleanup(match[2]))
      res.push({ $ORIGIN: ctx.origin })
      return true
    case 'INCLUDE':
      throw new Error(`$INCLUDE requires ctx.file to resolve paths: ${match[2]}`)
  }

  return false
}

function parseRR(rri, ctx) {
  try {
    if (rri.type.startsWith('TYPE') && rri.type.length > 4) return parseGenericType(rri, ctx)
    switch (rri.type) {
      case 'SOA':
        return parseSOA(rri, ctx)
      default:
        return new RR[rri.type]({ bindline: `${rri.owner} ${rri.ttl} ${rri.class} ${rri.type} ${rri.rdata}` })
    }
  } catch (e) {
    e.rr = rri
    throw e
  }
}

// RFC 3597 §5: parse \# <length> <hex> generic rdata
function parseGenericRdata(rdataStr) {
  const str = rdataStr.trim()
  if (!str.startsWith('\\#')) return null
  const rest = str.slice(2).trim()
  const spaceIdx = rest.indexOf(' ')
  const lenStr = spaceIdx === -1 ? rest : rest.slice(0, spaceIdx)
  const hexStr = spaceIdx === -1 ? '' : rest.slice(spaceIdx + 1).replace(/\s+/g, '')
  const length = Number(lenStr)
  if (!Number.isInteger(length) || length < 0) throw new Error(`RFC 3597: invalid rdata length: ${lenStr}`)
  if (hexStr.length !== length * 2) {
    throw new Error(`RFC 3597: rdata length mismatch: declared ${length} bytes, got ${hexStr.length / 2}`)
  }
  return { length, hex: hexStr.toLowerCase() }
}

// RFC 3597 §5: handle TYPE<n> generic type notation
function parseGenericType(rri, ctx) {
  const typeNum = Number(rri.type.slice(4)) // TYPE65534 → 65534
  const knownName = RR.typeMap[typeNum] // e.g. 'A' for type 1, undefined if unknown

  if (rri.rdata.trim().startsWith('\\#')) {
    const generic = parseGenericRdata(rri.rdata) // throws on malformed
    // Known types in \# format are stored as plain objects — decoding wire format
    // to type-specific text would require per-type wire parsers (RFC 3597 §5 note)
    return {
      owner: rri.owner,
      ttl: rri.ttl,
      class: rri.class,
      type: knownName ?? rri.type,
      rdata: `\\# ${generic.length}${generic.length ? ' ' + generic.hex : ''}`,
    }
  }

  // Normal text rdata — only valid for known types
  if (!knownName || !RR[knownName]) {
    throw new Error(`unknown TYPE number ${typeNum}: use \\# generic rdata format (RFC 3597)`)
  }
  if (knownName === 'SOA') return parseSOA({ ...rri, type: knownName }, ctx)
  return new RR[knownName]({ bindline: `${rri.owner} ${rri.ttl} ${rri.class} ${knownName} ${rri.rdata}` })
}

function parseSOA(rri, ctx) {
  const todo = ['mname', 'rname', 'serial', 'refresh', 'retry', 'expire', 'minimum']

  for (const v of rri.rdata.split(/[\s]+/)) {
    if (['(', ')'].includes(v)) continue
    rri[todo.shift()] = /^[0-9]+$/.test(v) ? Number(v) : rr.fullyQualify(v, ctx.origin)
  }
  if (todo.length !== 0) {
    throw new Error(`SOA missing fields: ${todo.join(', ')}`)
  }
  delete rri.rdata
  if (!rri.ttl) rri.ttl = rri.minimum
  const rrsoa = new RR.SOA(rri)
  if (!ctx.ttl || ctx.ttl < rrsoa.get('minimum')) ctx.ttl = rrsoa.get('minimum')
  return rrsoa
}

export async function includeIncludes(str, opts, _seen = new Set()) {
  const includeDir = path.resolve(path.dirname(opts.file))
  _seen.add(path.resolve(opts.file))

  const result = []
  for (const line of str.split(/\r?\n/)) {
    if (!line.trimStart().startsWith('$INCLUDE')) {
      result.push(line)
      continue
    }

    // Parse: $INCLUDE <filename> [origin] [; comment]
    const tokens = line.trimStart().slice('$INCLUDE'.length).replace(/;.*$/, '').trim().split(/\s+/)
    const requested = tokens[0]
    const origin = tokens[1]

    if (!requested) throw new Error(`$INCLUDE missing filename`)

    const includeFile = path.resolve(includeDir, requested)
    const rel = path.relative(includeDir, includeFile)
    if (rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) {
      throw new Error(`$INCLUDE path escapes include directory: ${requested}`)
    }
    if (_seen.has(includeFile)) {
      throw new Error(`$INCLUDE cycle detected: ${includeFile}`)
    }
    if (origin) result.push(`$ORIGIN ${origin}`)
    const contents = await fs.readFile(includeFile, 'utf8')
    result.push(await includeIncludes(contents, { ...opts, file: includeFile }, _seen))
  }

  return result.join('\n')
}
