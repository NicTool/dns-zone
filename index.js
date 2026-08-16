import fs from 'node:fs/promises'

import bind from './lib/bind.js'
import json from './lib/json.js'
import maradns from './lib/maradns.js'
import tinydns from './lib/tinydns.js'
import zoneExport from './lib/export.js'
import ZONE, { splitByZone } from './lib/zone.js'

export { bind, json, maradns, tinydns }
export { toBind, toTinydns, toMaraDNS, toJSON } from './lib/export.js'
export { zoneExport, ZONE, splitByZone }

/**
 * A tinydns data file is a per-server database, so it holds every zone the
 * server answers for. JSON mirrors whatever it was dumped from. An RFC
 * 1035 zone file and a maradns csv2 (mararc maps one zone to one file) each
 * describe a single zone, so a second SOA there is an error.
 *
 * The parsers are reached through thunks: lib/*.js import this module, so the
 * bindings are still in the TDZ while index.js is evaluating.
 */
const rfc1035 = { manyZones: false, parse: (str, ctx) => bind.parseZoneFile(str, ctx) }

const formats = {
  rfc1035,
  bind: rfc1035, // the format's older name, still accepted
  json: { manyZones: true, parse: (str, ctx) => json.parseZoneFile(str, ctx) },
  maradns: { manyZones: false, parse: (str, ctx) => maradns.parseZoneFile(str, ctx) },
  tinydns: { manyZones: true, parse: (str, ctx) => tinydns.parseData(str, ctx) },
}

function formatFor(format) {
  // own-property test: `format: 'toString'` would otherwise find an inherited
  // function and run it as the parser
  if (!Object.hasOwn(formats, format)) throw new Error(`unknown zone format: ${format}`)
  return formats[format]
}

export function holdsManyZones(format) {
  return formatFor(format).manyZones
}

export async function validateZone(str, opts = {}) {
  const { format = 'bind', ...ctx } = opts
  const { parse, manyZones } = formatFor(format)

  const RR = await parse(str, ctx)

  const errors = []
  for (const zone of splitByZone(RR, { manyZones })) {
    const { errors: found } = new ZONE({ origin: ctx.origin, ttl: ctx.ttl, RR: zone.RR })
    errors.push(...found.map((e) => ({ ...e, zone: zone.apex })))
  }

  return { RR, errors }
}

export function valueCleanup(str) {
  if (str.startsWith('"') && str.endsWith('"')) {
    str = str.slice(1, -1)
  }

  if (/^[0-9.]+$/.test(str) && Number(str).toString() === str) {
    return Number(str)
  }

  return str
}

export function hasUnquoted(str, quoteChar, matchChar) {
  if (!str.includes(quoteChar)) return str.includes(matchChar)

  const segs = str.split(quoteChar)
  for (let i = 0; i < segs.length; i += 2) {
    if (segs[i].includes(matchChar)) return true
  }
  return false
}

export function removeChar(str, quoteChar, matchChar) {
  if (!str.includes(quoteChar)) return str.replaceAll(matchChar, '')

  const segs = str.split(quoteChar)
  for (let i = 0; i < segs.length; i += 2) {
    segs[i] = segs[i].replaceAll(matchChar, '')
  }
  return segs.join(quoteChar)
}

export function replaceChar(str, quoteChar, matchChar, replace) {
  if (!str.includes(quoteChar)) return str.replaceAll(matchChar, replace)

  const segs = str.split(quoteChar)
  for (let i = 0; i < segs.length; i += 2) {
    segs[i] = segs[i].replaceAll(matchChar, replace)
  }
  return segs.join(quoteChar)
}

export function stripComment(str, quoteChar, startChar) {
  if (!str.includes(quoteChar)) {
    const idx = str.indexOf(startChar)
    return idx === -1 ? str : str.slice(0, idx)
  }

  const segs = str.split(quoteChar)
  for (let i = 0; i < segs.length; i += 2) {
    const idx = segs[i].indexOf(startChar)
    if (idx !== -1) {
      segs[i] = segs[i].slice(0, idx)
      return segs.slice(0, i + 1).join(quoteChar)
    }
  }
  return segs.join(quoteChar)
}

export function serialByDate(inc) {
  const d = new Date()
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  const day = d.getDate().toString().padStart(2, '0')
  const year = d.getFullYear()
  const increment = (inc ?? '00').toString().padStart(2, '0')

  return Number(`${year}${month}${day}${increment}`)
}

export async function serialByFileStat(filePath) {
  const stat = await fs.stat(filePath)
  return Math.round(stat.mtime.getTime() / 1000)
}

export function toSeconds(str) {
  if (/^[0-9]+$/.test(str)) return Number(str)

  const re = /(?:([0-9]+)w)?(?:([0-9]+)d)?(?:([0-9]+)h)?(?:([0-9]+)m)?(?:([0-9]+)s)?/i
  const match = str.match(re)
  if (!match) throw new Error(`unable to convert ${str} to seconds`)

  const [weeks, days, hours, minutes, seconds] = match.slice(1)
  return (
    Number(weeks ?? 0) * 604800 +
    Number(days ?? 0) * 86400 +
    Number(hours ?? 0) * 3600 +
    Number(minutes ?? 0) * 60 +
    Number(seconds ?? 0)
  )
}
