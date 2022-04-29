
import os from 'os'

import * as RR from 'dns-resource-record'

import * as dz from '../index.js'

const rr = new RR.AAAA(null)

export const zoneOpts = {}

export default { zoneOpts, parseZoneFile }

const re = {
  zoneTTL   : /^\/ttl\s+([0-9]{1,5})\s*~/,
  zoneOrigin: /^\/origin\s+([^\s]+)\s*~/,
  zoneRR    : /^([^\s]+\s+)(\+[0-9]+\s+)?(IN\s+)?(?:(a|aaaa|fqdn4|fqdn6|hinfo|loc|mx|naptr|ns|ptr|raw|soa|srv|txt|spf|raw)\s+)(.*?)\s*~/i,
  pipeDelim : /^(?:([^|]+)\|)(?:\+([0-9]+)\|)?(?:(IN)\|)?(?:(a|aaaa|fqdn4|fqdn6|hinfo|loc|mx|naptr|ns|ptr|raw|soa|srv|txt|spf|raw)\|)?(.*)\|\s*~/i,
  blank     : /^\s*$/,
  comment   : /^\s*(?:#)[^\r\n]*?$/,
}

export async function parseZoneFile (str) {

  const res = []
  let rrWIP = ''

  for (let line of str.split(os.EOL)) {

    if (isBlank(line, res)) continue
    if (isComment(line, res)) continue

    line = dz.stripComment(line, "'", '#')

    if (isZoneTTL(line, res)) continue
    if (isZoneOrigin(line, res)) continue

    if (rrWIP.length) {  // a continuation was started
      rrWIP += line
      if (!dz.hasUnquoted(line, "'", '~')) {
        continue
      }
      else {
        // a ~ was seen, finalize the RR
        line = rrWIP
        rrWIP = ''
      }
    }

    if (!dz.hasUnquoted(line, "'", '~')) {  // record continues on next line
      rrWIP = line  // start a continuation
      continue
    }

    let match = line.match(re.zoneRR)
    if (!match) {
      match = line.match(re.pipeDelim)
      if (!match) throw new Error(`parse failure, unrecognized: ${line}`)
    }

    const [ owner, ttl, c, type, rdata ] = match.slice(1)
    const iterRR = {
      owner: owner ? owner.trim() : owner,
      ttl  : parseInt(ttl ? ttl.trim() : ttl) || zoneOpts.ttl || 86400,
      class: (c ? c.trim().toUpperCase() : c) || 'IN',
      type : (type ? type.trim().toUpperCase() : 'A'),
      rdata: rdata.trim(),
    }

    if (iterRR.owner === '') iterRR.owner = zoneOpts.origin
    iterRR.owner = dz.replaceChar(iterRR.owner, "'", '%', zoneOpts.origin)
    iterRR.rdata = dz.removeChar(iterRR.rdata, "'", '~').trim()

    switch (iterRR.type) {
      case 'CNAME':
      case 'DNAME':
      case 'MX':
      case 'NS':
      case 'SRV':
      case 'URI':
        iterRR.rdata = dz.replaceChar(iterRR.rdata, "'", '%', zoneOpts.origin)
        break
      case 'PTR':
        if (!iterRR.owner.endsWith('.')) {
          if (/[A-Fa-f]/.test(iterRR.owner)) {
            iterRR.owner = `${iterRR.owner}.ip6.arpa.`
          }
          else {
            iterRR.owner = `${iterRR.owner}.in-addr.arpa.`
          }
        }
        break
      case 'RAW':
        processRaw(iterRR)
        continue // TODO: this skips RAW
      case 'HINFO':
        iterRR.rdata = iterRR.rdata.split(/;/).join(' ').replace(/'/g, '"')
        break
      case 'NAPTR':
        processNAPTR(iterRR)
        break
      case 'SOA':
        iterRR.rdata = dz.replaceChar(iterRR.rdata, "'", '@', '.')
        if (zoneOpts.serial) {
          iterRR.rdata = iterRR.rdata.replace(/\/serial/, zoneOpts.serial)
        }
        break
      case 'SPF':
      case 'TXT':
        iterRR.rdata = naturallyQuoted(iterRR.rdata)
        if (!iterRR.rdata.startsWith('"')) iterRR.rdata = `"${iterRR.rdata}"`
        break
      case 'FQDN4':
        res.push(new RR.A({
          owner  : iterRR.owner,
          ttl    : iterRR.ttl,
          type   : 'A',
          address: iterRR.rdata,
        }))
        res.push(new RR.PTR({
          owner: iterRR.rdata.split('.').reverse().join('.') + '.in-addr.arpa.',
          ttl  : iterRR.ttl,
          type : 'PTR',
          dname: iterRR.owner,
        }))
        continue
      case 'FQDN6':
        res.push(new RR.AAAA({
          owner  : iterRR.owner,
          ttl    : iterRR.ttl,
          type   : 'AAAA',
          address: iterRR.rdata,
        }))
        res.push(new RR.PTR({
          owner: rr.expand(iterRR.rdata).split(':').join('').split('').reverse().join('.') + '.ip6.arpa.',
          ttl  : iterRR.ttl,
          type : 'PTR',
          dname: iterRR.owner,
        }))
        continue
      default:
    }

    // console.log(iterRR)
    const asBind = `${iterRR.owner} ${iterRR.ttl} ${iterRR.class} ${iterRR.type} ${iterRR.rdata}`
    try {
      res.push(new RR[iterRR.type]({ bindline: asBind }))
    }
    catch (e) {
      console.error(asBind)
      // console.error(e)
      throw e
    }
  }

  return res
}

function processNAPTR (rr) {
  const match = rr.rdata.match(/([0-9]+)\s+([0-9]+)\s+('[^']*');('[^']*');('[^']*')\s+([^s]+)\s*/)
  if (!match) throw new Error(`unable to parse NAPTR: ${rr.rdata}`)
  rr.rdata = match.slice(1).join(' ').replace(/'/g, '"')
  // console.log(match)
}

function processRaw (rr) {
  const [ typeId, rest ] = rr.rdata.match(/^\s*([0-9]+)\s(.*)\s*$/).slice(1)

  switch (typeId) {
    case 257:
    case '257':
      rr.type = 'CAA'
      rr.rdata = rest
  }
}

function naturallyQuoted (str) {
  // untangle the bizarre forms of quoting Mara allows
  let r = ''
  let inQuotes = false
  for (const c of str.split('')) {
    if (c === "'") inQuotes = !inQuotes
    if (inQuotes && c !== "'") {
      r += c
    }
    else {
      if (!/[\s']/.test(c)) r += c
    }
  }
  return `"${r}"`
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

function isZoneOrigin (str, res) {
  const match = str.match(re.zoneOrigin)
  if (!match) return false
  zoneOpts.origin = rr.fullyQualify(dz.valueCleanup(match[1]))
  return true
}

function isZoneTTL (str, res) {
  const match = str.match(re.zoneTTL)
  if (!match) return false
  zoneOpts.ttl = dz.valueCleanup(match[1])
  return true
}
