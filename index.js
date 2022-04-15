
import fs from 'fs/promises'

export class ZONE extends Map {
  constructor (opts = {}) {
    super()

    this.RR = []
    this.SOA = {}

    this.setOrigin(opts.origin)
    this.setTTL(opts.ttl)

    if (opts.RR) {
      for (const r of opts.RR) {
        this.addRR(r)
      }
    }
  }

  addRR (rr) {

    if (rr.$TTL) {
      this.setTTL(rr.$TTL)
      return
    }

    if (rr.$ORIGIN) {
      this.setOrigin(rr.$ORIGIN)
      return
    }

    const type = rr.get('type')

    // assure origin is set
    if (type !== 'SOA') {
      if (!this.SOA.owner) throw new Error('SOA must be set first!')

      const c = rr.get('class')
      if (c !== this.SOA.class)
        throw new Error('All RRs in a file should have the same class')
    }

    this.isNotDuplicate(rr)
    this.itMatchesSetTTL(rr)
    this.hasNoConflictingLabels(rr)

    switch (type) {
      case 'SOA'  : return this.setSOA(rr)
      case 'CNAME': return this.addCname(rr)
      // any types with additional validation go here
      default:
    }

    this.RR.push(rr)
  }

  addCname (rr) {

    const ownerMatches = this.getOwnerMatches(rr)

    const bothMatch = ownerMatches.filter(r => r.get('type') === 'CNAME').length
    if (bothMatch) throw new Error('multiple CNAME records with the same owner are NOT allowed, RFC 1034')

    // RFC 2181: An alias name (label of a CNAME record) may, if DNSSEC is
    // in use, have SIG, NXT, and KEY RRs, but may have no other data.
    // RFC 4035: If a CNAME RRset is present at a name in a signed zone,
    // appropriate RRSIG and NSEC RRsets are REQUIRED at that name.
    const compatibleTypes = 'SIG NXT KEY NSEC RRSIG'.split(' ')
    const conflicts = ownerMatches.filter(r => {
      return !compatibleTypes.includes(r.get('type'))
    }).length
    if (conflicts) throw new Error(`owner already exists, CNAME not allowed, RFC 1034, 2181, & 4035`)

    this.RR.push(rr)
  }

  getRR (rr) {
    const fields = rr.getFields()

    return this.RR.filter(r => {

      const fieldDiffs = fields.map(f => {
        return r.get(f) === rr.get(f)
      }).filter(m => m === false).length

      if (!fieldDiffs) return r
    })
  }

  hasNoConflictingLabels (rr) {

    const ownerMatches = this.getOwnerMatches(rr)
    if (ownerMatches.length === 0) return

    // CNAME conflicts with almost everything, assure no CNAME at this name
    if (!'CNAME SIG NXT KEY NSEC RRSIG'.split(' ').includes(rr.get('type'))) {
      const conflicts = ownerMatches.filter(r => {
        return r.get('type') === 'CNAME'
      }).length
      if (conflicts) throw new Error(`owner exists as CNAME, not allowed, RFC 1034, 2181, & 4035`)
    }
  }

  isNotDuplicate (rr) {
    if (this.getRR(rr).length)
      throw new Error('multiple identical RRs are not allowed, RFC 2181')
  }

  itMatchesSetTTL (rr) {
    // a Resource Record Set exists...with the same label, class, type (different data)
    const matches = this.RR.filter(r => {

      const diffs = [ 'owner', 'class', 'type' ].map(f => {
        return r.get(f) === rr.get(f)
      }).filter(m => m === false).length

      if (!diffs) return r
    })
    if (!matches.length) return true
    if (matches[0].get('ttl') === rr.get('ttl')) return true
    throw new Error('Records with identical label, class, and type must have identical TTL, RFC 2181')
  }

  getOwnerMatches (rr) {
    const owner = rr.get('owner')
    return this.RR.filter(r => {
      return r.get('owner') === owner
    })
  }

  setOrigin (val) {
    if (!val) throw new Error('origin is required!')
    this.set('origin', val)
  }

  setSOA (rr) {
    if (this.SOA.owner)
      throw new Error('Exactly one SOA RR should be present at the top!, RFC 1035')

    rr.getFields().map(f => this.SOA[f] = rr.get(f))
  }

  setTTL (val) {
    if (!val) return
    this.set('ttl', val)
  }
}

export default { ZONE }

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
