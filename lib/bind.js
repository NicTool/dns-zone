
import os from 'os'

import RR from 'dns-resource-record'

import * as dz from '../index.js'

const rr = new RR.A(null)

const zoneOpts = {}

export default { zoneOpts, expandShortcuts, hasUnquoted, parseZoneFile }

const re = {
  zoneTTL   : /^\$TTL\s+([0-9]{1,5})\s*(;.*)?$/,
  zoneOrigin: /^\$ORIGIN\s+([^\s]+?)\s*(;.*)?$/,
  zoneRR    : /^([^\s]+)?\s*([0-9]{1,5})?\s*(IN|CS|CH|HS|NONE|ANY)?\s+(A|AAAA|CAA|CNAME|DNAME|DNSKEY|DS|HINFO|LOC|MX|NAPTR|NS|NSEC|NSEC3|PTR|RRSIG|SMIMEA|SSHFP|SOA|SPF|SRV|TLSA|TXT|URI|TYPE)\s+(.*?)\s*$/,
  blank     : /^\s*?$/,
  comment   : /^\s*(?:\/\/|;)[^\r\n]*?$/,
}

export async function parseZoneFile (str, implicitOrigin) {

  const res = []
  let lastName = ''
  let rrWIP = {}

  for (let line of str.split(os.EOL)) {

    if (isBlank(line, res)) continue
    if (isComment(line, res)) continue

    line = stripComment(line)

    if (Object.keys(rrWIP).length) {  // a continuation started
      resumeContinuation(line, rrWIP, res); continue
    }

    if (isZoneTTL(line, res)) continue
    if (isZoneOrigin(line, res)) continue

    const match = line.match(re.zoneRR)
    if (!match) throw new Error(`parse failure, unrecognized: ${line}`)

    const [ owner, ttl, c, type, rdata ] = match.slice(1)
    const iterRR = {
      owner: owner ? owner.trim() : owner,
      ttl  : parseInt(ttl ? ttl.trim() : ttl) || zoneOpts.ttl,
      class: (c ? c.trim().toUpperCase() : c) || 'IN',
      type : type.trim().toUpperCase(),
      rdata: stripComment(rdata).trim(),
    }

    expandOwnerShortcuts(iterRR, lastName)
    expandRdataShortcuts(iterRR)

    if (!hasUnquoted('(', iterRR.rdata)) {  // single-line RR
      res.push(parseRR(iterRR))
      continue
    }

    // the start of a continuation was seen, remove it
    iterRR.rdata = removeChar('(', iterRR.rdata).trim()

    if (hasUnquoted(')', iterRR.rdata)) {
      iterRR.rdata = removeChar(')', iterRR.rdata).trim()
      res.push(parseRR(iterRR))
      continue
    }
    rrWIP = iterRR
  }

  return res
}

function expandOwnerShortcuts (iterRR, lastName) {

  if (iterRR.owner === '@') iterRR.owner = zoneOpts.origin

  // "If a line begins with a blank, then the owner is assumed to be the
  // same as that of the previous RR" -- BIND 9 manual
  if (!iterRR.owner && lastName) iterRR.owner = lastName
  if (!iterRR.owner) iterRR.owner = zoneOpts.origin

  if (lastName !== iterRR.owner) lastName = iterRR.owner

  iterRR.owner = rr.fullyQualify(iterRR.owner, zoneOpts.origin)
}

function expandRdataShortcuts (iterRR) {
  switch (iterRR.type) {
    case 'MX':
    case 'NS':
    case 'CNAME':
    case 'DNAME':
      iterRR.rdata = rr.fullyQualify(iterRR.rdata, zoneOpts.origin)
      break
  }
}

function resumeContinuation (line, rrWIP, res) {
  // within a zone file, new lines are ignored within parens. A paren was
  // opened, the closing paren will end the RR's rdata
  if (!hasUnquoted(')', line)) {
    rrWIP.rdata += line
    return
  }

  // a closing ) was seen, so remove it and finalize the RR
  rrWIP.rdata += removeChar(')', line)
  res.push(parseRR(rrWIP))
  rrWIP = {}
}

function removeChar (char, str) {
  let r = ''
  let inQuotes = false
  for (const c of str.split('')) {
    if (c === '"') inQuotes = !inQuotes
    if (c === char && !inQuotes) continue
    r += c
  }
  return r
}

function hasUnquoted (char, str) {
  let inQuotes = false
  let inComment = false
  for (const c of str.split('')) {
    if (c === '"') inQuotes = !inQuotes
    if (c === ';' && !inQuotes) inComment = true
    if (c === char && !inQuotes && !inComment) return true
  }
  return false
}

function stripComment (str) {
  let r = ''
  let inQuotes = false
  for (const c of str.split('')) {
    if (c === '"') inQuotes = !inQuotes
    if (c === ';' && !inQuotes) return r // comment, ignore rest of line
    r += c
  }
  return r
}

function isBlank (str, res) {
  if (re.blank.test(str)) {
    res.push(str)
    return true
  }
  return false
}

function isComment (str, res) {
  if (re.comment.test(str)) {
    res.push(str)
    return true
  }
  return false
}

function isZoneTTL (str, res) {
  const match = str.match(re.zoneTTL)
  if (!match) return false

  zoneOpts.ttl = dz.valueCleanup(match[1])
  res.push({
    $TTL: zoneOpts.ttl,
    ...(match[2] ? { comment: match[2] } : {}),
  })

  return true
}

function isZoneOrigin (str, res) {
  const match = str.match(re.zoneOrigin)
  if (!match) return false

  zoneOpts.origin = rr.fullyQualify(dz.valueCleanup(match[1]))
  res.push({
    $ORIGIN: zoneOpts.origin,
    ...(match[2] ? { comment: match[2] } : {}),
  })

  return true
}

function parseRR (rr) {
  switch (rr.type) {
    case 'SOA'   : return parseSOA(rr)
    default:
      return parseAny(rr.type, rr)
  }
}

function parseAny (type, rri) {
  return new RR[type]({ bindline: `${rri.owner} ${rri.ttl} ${rri.class} ${rri.type} ${rri.rdata}` })
}

function parseSOA (rri) {
  const todo = [ 'mname', 'rname', 'serial', 'refresh', 'retry', 'expire', 'minimum' ]

  for (const v of rri.rdata.split(/[\s]+/)) {
    if ([ '(', ')' ].includes(v)) continue
    rri[todo.shift()] = /^[0-9]+$/.test(v) ? parseInt(v) : rr.fullyQualify(v, zoneOpts.origin)
  }
  if (todo.length !== 0) {
    console.error(rri)
    console.error('todo not done')
    throw todo
  }
  delete rri.rdata
  const rrsoa = new RR.SOA(rri)
  if (!zoneOpts.ttl || zoneOpts.ttl < rrsoa.minimum) zoneOpts.ttl = rrsoa.minimum
  return rrsoa
}

export async function expandShortcuts (zoneArray) {

  const implicitOrigin = rr.fullyQualify(zoneOpts.origin) // zone 'name' in named.conf
  let origin = implicitOrigin
  // const empty = [ undefined, null, '' ]

  for (let i = 0; i < zoneArray.length; i++) {
    const entry = zoneArray[i]

    // When a zone is first read, there is an implicit $ORIGIN <zone_name>.
    // note the trailing dot. The current $ORIGIN is appended to the domain
    // specified in the $ORIGIN argument if it is not absolute. -- BIND 9
    if (entry.$ORIGIN) {  // declared $ORIGIN in zone file
      origin = rr.fullyQualify(entry.$ORIGIN, implicitOrigin)
      continue
    }
    if (!origin) throw new Error(`zone origin ambiguous, cowardly bailing out`)
  }
}
