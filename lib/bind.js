
import fs   from 'fs/promises'
import os   from 'os'
import path from 'path'

import * as RR from 'dns-resource-record'

import * as dz from '../index.js'

const rr = new RR.A(null)

export const zoneOpts = {}

export default { zoneOpts, parseZoneFile }

const re = {
  directive: /^\$([A-Za-z]+)\s+([^\s]+)\s*(?:([^\s]+)\s+)?(;.*)?$/,
  ttl        : /([0-9]{1,5})/,
  classes    : /(IN|CS|CH|HS|NONE|ANY)/,
  rrtypes    : /(A|AAAA|APL|CAA|CERT|CNAME|DHCID|DNAME|DNSKEY|DS|HINFO|HIP|IPSECKEY|KEY|KX|LOC|MD|MF|MX|NAPTR|NS|NSEC|NSEC3|NSEC3PARAM|NXT|OPENPGPKEY|PTR|RP|RRSIG|SIG|SMIMEA|SOA|SPF|SRV|SSHFP|SVCB|TLSA|TXT|URI|TYPE)/,
  zoneRR     : /^([^\s]+)?\s*([0-9]{1,5})?\s*(IN|CS|CH|HS|NONE|ANY)?\s+(A|AAAA|APL|CAA|CERT|CNAME|DHCID|DNAME|DNSKEY|DS|HINFO|HIP|IPSECKEY|KEY|KX|LOC|MD|MF|MX|NAPTR|NS|NSEC|NSEC3|NSEC3PARAM|NXT|OPENPGPKEY|PTR|RP|RRSIG|SIG|SMIMEA|SOA|SPF|SRV|SSHFP|SVCB|TLSA|TXT|URI|TYPE)\s+(.*?)\s*$/,
  blank      : /^\s*?$/,
  comment    : /^\s*(?:\/\/|;)[^\r\n]*?$/,
}
// re.zoneRR = new RegExp(`^([^\\s]+)?\\s*${re.ttl}?${re.classes}?\\s+${re.rrtypes}?\\s+(.*?)\\s*$`)

export async function parseZoneFile (str, implicitOrigin) {

  const res = []
  const rrWIP = {}
  let lineCount = 0

  for (let line of str.split(os.EOL)) {

    lineCount++
    if (lineCount % 500 === 0) process.stdout.write('.')

    if (isBlank(line, res)) continue
    if (isComment(line, res)) continue
    if (isDirective(line, res)) continue

    line = dz.stripComment(line, '"', ';')

    if (Object.keys(rrWIP).length) {  // a continuation started
      resumeContinuation(line, rrWIP, res); continue
    }

    const match = line.match(re.zoneRR)
    if (!match) throw new Error(`parse failure during line:\n\t${line}`)

    const [ owner, ttl, c, type, rdata ] = match.slice(1)
    const iterRR = {
      owner: owner ? owner.trim() : owner,
      ttl  : parseInt(ttl ? ttl.trim() : ttl) || zoneOpts.ttl,
      class: (c ? c.trim().toUpperCase() : c) || 'IN',
      type : type.trim().toUpperCase(),
      rdata: rdata.trim(),
    }

    expandOwnerShortcuts(iterRR)
    expandRdataShortcuts(iterRR)

    if (!dz.hasUnquoted(iterRR.rdata, '"', '(')) {  // single-line RR
      res.push(parseRR(iterRR))
      continue
    }

    // the start of a continuation was seen, remove it
    iterRR.rdata = dz.removeChar(iterRR.rdata, '"', '(').trim()

    if (dz.hasUnquoted(iterRR.rdata, '"', ')')) {
      iterRR.rdata = dz.removeChar(iterRR.rdata, '"', ')').trim()
      res.push(parseRR(iterRR))
      continue
    }

    Object.assign(rrWIP, iterRR)
  }

  return res
}

function expandOwnerShortcuts (iterRR) {

  if (iterRR.owner === '@') iterRR.owner = zoneOpts.origin

  // "If a line begins with a blank, then the owner is assumed to be the
  // same as that of the previous RR" -- BIND 9 manual
  if (!iterRR.owner && zoneOpts.prevOwner) iterRR.owner = zoneOpts.prevOwner
  if (!iterRR.owner) iterRR.owner = zoneOpts.origin

  if (zoneOpts.prevOwner !== iterRR.owner) zoneOpts.prevOwner = iterRR.owner

  iterRR.owner = rr.fullyQualify(iterRR.owner, zoneOpts.origin)
}

function resumeContinuation (line, rrWIP, res) {
  // within a zone file, new lines are ignored within parens. A paren was
  // opened, the closing paren will end the RR's rdata
  if (dz.hasUnquoted(line, '"', ')')) {        // last line of this RR
    rrWIP.rdata += dz.removeChar(line, '"', ')')
    res.push(parseRR(rrWIP))
    Object.keys(rrWIP).map(k => delete rrWIP[k])
  }
  else {
    rrWIP.rdata += line
  }
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

function isBlank (str, res) {
  if (re.blank.test(str)) {
    if (zoneOpts.showBlank) res.push(str)
    return true
  }
  return false
}

function isComment (str, res) {
  if (re.comment.test(str)) {
    if (zoneOpts.showComment) res.push(str)
    return true
  }
  return false
}

function isDirective (line, res) {

  const match = line.match(re.directive)
  if (!match) return false

  switch (match[1]) {
    case 'TTL':
      zoneOpts.ttl = dz.valueCleanup(match[2])
      res.push({ $TTL: zoneOpts.ttl })
      return true
    case 'ORIGIN':
      zoneOpts.origin = rr.fullyQualify(dz.valueCleanup(match[2]))
      res.push({ $ORIGIN: zoneOpts.origin })
      return true
    case 'INCLUDE':
      return true
  }

  return false
}

function parseRR (rr) {
  try {
    switch (rr.type) {
      case 'SOA': return parseSOA(rr)
      default:
        return new RR[rr.type]({ bindline: `${rr.owner} ${rr.ttl} ${rr.class} ${rr.type} ${rr.rdata}` })
    }
  }
  catch (e) {
    console.error(rr)
    // console.error(e.message)
    throw e
  }
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
  if (!rri.ttl) rri.ttl = rri.minimum
  const rrsoa = new RR.SOA(rri)
  if (!zoneOpts.ttl || zoneOpts.ttl < rrsoa.get('minimum')) zoneOpts.ttl = rrsoa.get('minimum')
  return rrsoa
}

// TODO: integrate these remnants with parseZone
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

export async function includeIncludes (str, opts) {

  const parts = str.split(/^\$INCLUDE\s+([^\s]+)\s*([^\s]+\s*)?(?:;.*)?$/gm)
  if (parts.length === 1) return str

  const result = []
  const includeDir = path.dirname(opts.file)

  while (parts.length) {
    const next = parts.shift()  // line(s) preceding $INCLUDE
    result.push(next.trim())
    if (parts.length === 0) break  // recursion break

    const includeFile = path.resolve(includeDir, parts.shift())
    const origin = parts.shift()
    if (origin) result.push(`$ORIGIN: ${origin}\n`)
    const contents = await fs.readFile(includeFile)
    result.push(contents.toString())

    if (parts.length === 0) break
  }

  return result.join(os.EOL)
}
