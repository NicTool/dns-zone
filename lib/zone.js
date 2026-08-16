import { isDirective, isRawLine } from './document.js'

export default class ZONE {
  constructor(opts = {}) {
    this.RR = []
    this.SOA = {}
    this.ownerIdx = {}
    this.recordKeys = new Set()
    this.errors = []
    this.origin = undefined
    this.ttl = undefined

    if (opts.origin) this.setOrigin(opts.origin)
    this.setTTL(opts.ttl)

    if (opts.RR) {
      for (const r of opts.RR) {
        try {
          this.addRR(r)
        } catch (e) {
          this.errors.push({ rr: r, error: e })
        }
      }
    }
  }

  addRR(rr) {
    // blank lines and comments are presentation, not data; the generators in
    // export.js drop them too
    if (isRawLine(rr)) return

    if (isDirective(rr)) {
      if (rr.$TTL !== undefined) this.setTTL(rr.$TTL)
      if (rr.$ORIGIN !== undefined) this.setOrigin(rr.$ORIGIN)
      return
    }

    const type = rr.get('type')

    // assure origin is set
    if (type !== 'SOA') {
      if (!this.SOA.owner) throw new Error('SOA must be set first!')

      const c = rr.get('class')
      if (c !== this.SOA.class) throw new Error('All RRs in a file should have the same class')
    }

    this.isNotDuplicate(rr)
    this.itMatchesSetTTL(rr)
    this.hasNoConflictingLabels(rr)

    switch (type) {
      case 'SOA':
        return this.setSOA(rr)
      case 'CNAME':
        return this.addCname(rr)
      // any types with additional validation go here
      default:
    }

    this.append(rr)
  }

  addCname(rr) {
    const ownerMatches = this.getOwnerMatches(rr)

    const bothMatch = ownerMatches.filter((r) => r.get('type') === 'CNAME').length
    if (bothMatch) throw new Error('multiple CNAME records with the same owner are NOT allowed, RFC 1034')

    // RFC 2181: An alias name (label of a CNAME record) may, if DNSSEC is
    // in use, have SIG, NXT, and KEY RRs, but may have no other data.
    // RFC 4035: If a CNAME RRset is present at a name in a signed zone,
    // appropriate RRSIG and NSEC RRsets are REQUIRED at that name.
    const compatibleTypes = ['SIG', 'NXT', 'KEY', 'NSEC', 'RRSIG']
    const conflicts = ownerMatches.filter((r) => {
      return !compatibleTypes.includes(r.get('type'))
    }).length
    if (conflicts) throw new Error(`owner already exists, CNAME not allowed, RFC 1034, 2181, & 4035`)

    this.append(rr)
  }

  append(rr) {
    // owner index for O(1) owner lookup; recordKeys for O(1) duplicate detection
    const owner = rr.get('owner')
    this.ownerIdx[owner] ??= []
    this.ownerIdx[owner].push(this.RR.length)
    this.recordKeys.add(recordKey(rr))

    this.RR.push(rr)
  }

  getRR(rr) {
    const fields = rr.getFields()
    return this.getOwnerMatches(rr).filter((r) => fields.every((f) => r.get(f) === rr.get(f)))
  }

  hasNoConflictingLabels(rr) {
    const ownerMatches = this.getOwnerMatches(rr)
    if (ownerMatches.length === 0) return

    const allowedTypes = ['CNAME', 'SIG', 'NXT', 'KEY', 'NSEC', 'RRSIG']

    // CNAME conflicts with almost everything, assure no CNAME at this name
    if (!allowedTypes.includes(rr.get('type'))) {
      const conflicts = ownerMatches.filter((r) => r.get('type') === 'CNAME').length
      if (conflicts) throw new Error(`owner exists as CNAME, not allowed, RFC 1034, 2181, & 4035`)
    }
  }

  isNotDuplicate(rr) {
    if (this.recordKeys.has(recordKey(rr))) {
      throw new Error('multiple identical RRs are not allowed, RFC 2181')
    }
  }

  itMatchesSetTTL(rr) {
    const cls = rr.get('class')
    const type = rr.get('type')
    const matches = this.getOwnerMatches(rr).filter((r) => r.get('class') === cls && r.get('type') === type)
    if (!matches.length) return true
    if (matches[0].get('ttl') === rr.get('ttl')) return true
    throw new Error('Records with identical label, class, and type must have identical TTL, RFC 2181')
  }

  getOwnerMatches(rr) {
    const owner = rr.get('owner')
    return (this.ownerIdx[owner] ?? []).map((n) => this.RR[n])
  }

  setOrigin(val) {
    if (!val) throw new Error('origin is required!')
    this.origin = val
  }

  setSOA(rr) {
    if (this.SOA.owner) throw new Error('Exactly one SOA RR should be present at the top!, RFC 1035')

    for (const f of rr.getFields()) {
      this.SOA[f] = rr.get(f)
    }
    // SOA isn't appended to RR/ownerIdx, but track it for duplicate detection
    this.recordKeys.add(recordKey(rr))
  }

  setTTL(val) {
    if (val === undefined) return
    this.ttl = val
  }
}

/**
 * Partition a parsed array into one group per zone.
 *
 * ZONE models a single zone. A file that holds several — a tinydns data
 * file is a per-server db — needs to be split. The caller specifies
 * whether the source format may carry more than one zone. It defaults to
 * false: a forgotten flag then reports a multi-zone file's extra SOAs instead
 * of silently accepting a second SOA in a format that permits one.
 */
export function splitByZone(RR, { manyZones = false } = {}) {
  const records = RR.filter((rr) => typeof rr?.get === 'function')
  const apexes = [...new Set(records.filter((rr) => rr.get('type') === 'SOA').map((rr) => rr.get('owner')))]

  if (!manyZones || apexes.length < 2) return [{ apex: apexes[0], RR }]

  const groups = new Map(apexes.map((apex) => [apex, []]))
  for (const rr of records) {
    // longest match wins, so records under a child zone stay out of its parent
    const apex = apexes.filter((a) => enclosedBy(rr.get('owner'), a)).sort((a, b) => b.length - a.length)[0]

    if (apex) groups.get(apex).push(rr)
  }

  return [...groups].map(([apex, rrs]) => ({
    apex,
    RR: [...rrs.filter((rr) => rr.get('type') === 'SOA'), ...rrs.filter((rr) => rr.get('type') !== 'SOA')],
  }))
}

const enclosedBy = (owner, apex) => owner === apex || owner.endsWith(`.${apex}`)

function recordKey(rr) {
  return rr
    .getFields()
    .map((f) => `${f}=${rr.get(f)}`)
    .join('|')
}
