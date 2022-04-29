
import fs from 'fs/promises'

import bind    from './lib/bind.js'
import maradns from './lib/maradns.js'
import tinydns from './lib/tinydns.js'

export { bind, maradns, tinydns }

export function valueCleanup (str) {

  if (str.startsWith('"') && str.endsWith('"')) {
    str = str.substr(1,str.length -2) // strip double quotes
  }

  if (/^[0-9.]+$/.test(str) && Number(str).toString() === str) {
    return Number(str)
  }

  return str
}

export function hasUnquoted (str, quoteChar, matchChar) {
  let inQuotes = false
  for (const c of str.split('')) {
    if (c === quoteChar) inQuotes = !inQuotes
    if (c === matchChar && !inQuotes) return true
  }
  return false
}

export function removeChar (str, quoteChar, matchChar) {
  let r = ''
  let inQuotes = false
  for (const c of str.split('')) {
    if (c === quoteChar) inQuotes = !inQuotes
    if (c === matchChar && !inQuotes) continue
    r += c
  }
  return r
}

export function replaceChar (str, quoteChar, matchChar, replace) {
  let r = ''
  let inQuotes = false
  for (const c of str.split('')) {
    if (c === quoteChar) inQuotes = !inQuotes
    if (c === matchChar && !inQuotes) {
      r += replace
      continue
    }
    r += c
  }
  return r
}

export function stripComment (str, quoteChar, startChar) {
  let r = ''
  let inQuotes = false
  for (const c of str.split('')) {
    if (c === quoteChar) inQuotes = !inQuotes
    if (c === startChar && !inQuotes) return r // comment, ignore rest of line
    r += c
  }
  return r
}

export function serialByDate (start, inc) {

  const d     = new Date()
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  const day   = d.getDate().toString().padStart(2, '0')
  const year  = d.getFullYear()
  const increment = (inc || '00').toString().padStart(2, '0')

  return parseInt(`${year}${month}${day}${increment}`, 10)
}

export async function serialByFileStat (filePath) {
  const stat = await fs.stat(filePath)
  return Math.round(stat.mtime.getTime() / 1000)
}

export function toSeconds (str) {
  if (/^[0-9]+$/.test(str)) return parseInt(str, 10) // all numeric

  const re = /(?:([0-9]+)w)?(?:([0-9]+)d)?(?:([0-9]+)h)?(?:([0-9]+)m)?(?:([0-9]+)s)?/i
  const match = str.match(re)
  if (!match) throw new Error(`unable to convert ${str} to seconds`)

  const [ weeks, days, hours, minutes, seconds ] = match.slice(1)
  return  parseInt(weeks   || 0) * 604800
        + parseInt(days    || 0) *  86400
        + parseInt(hours   || 0) *   3600
        + parseInt(minutes || 0) *     60
        + parseInt(seconds || 0) *      1
}
