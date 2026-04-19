import fs from 'node:fs/promises'

import bind from './lib/bind.js'
import json from './lib/json.js'
import maradns from './lib/maradns.js'
import tinydns from './lib/tinydns.js'

export { bind, json, maradns, tinydns }

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
