
export default class ZONE extends Map {
  constructor (opts = {}) {
    super()

    this.RR = []
    this.SOA = {}
    this.ownerIdx = {}

    if (opts.origin) this.setOrigin(opts.origin)
    this.setTTL(opts.ttl)

    if (opts.RR) {
      for (const r of opts.RR) {
        try {
          this.addRR(r)
        }
        catch (e) {
          console.error(r)
          console.error(e)
        }
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

    this.append(rr)
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

    this.append(rr)
  }

  append (rr) {
    // optimization: create owner index, so searches happen in O(1) vs O(n) time,
    // matters when zone has 1000+ records
    const owner = rr.get('owner')
    if (this.ownerIdx[owner] === undefined) this.ownerIdx[owner] = []
    this.ownerIdx[owner].push(this.RR.length)

    this.RR.push(rr)
  }

  getRR (rr) {
    const fields = rr.getFields()

    return this.getOwnerMatches(rr).filter(r => {

      const fieldDiffs = fields.map(f => {
        return r.get(f) === rr.get(f)
      }).filter(m => m === false).length

      if (!fieldDiffs) return r
    })
  }

  hasNoConflictingLabels (rr) {

    const ownerMatches = this.getOwnerMatches(rr)
    if (ownerMatches.length === 0) return

    const allowedTypes = 'CNAME SIG NXT KEY NSEC RRSIG'.split(' ')

    // CNAME conflicts with almost everything, assure no CNAME at this name
    if (!allowedTypes.includes(rr.get('type'))) {
      const conflicts = ownerMatches.filter(r => r.get('type') === 'CNAME').length
      if (conflicts) throw new Error(`owner exists as CNAME, not allowed, RFC 1034, 2181, & 4035`)
    }
  }

  isNotDuplicate (rr) {
    if (this.getRR(rr).length)
      throw new Error('multiple identical RRs are not allowed, RFC 2181')
  }

  itMatchesSetTTL (rr) {
    // a RR Set exists...with the same label(owner), class, type (different data)
    const matches = this.getOwnerMatches(rr).filter(r => {

      const diffs = [ 'class', 'type' ].map(f => {
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

    if (this.ownerIdx[owner] === undefined) return []

    // optimized, retrieves matching owners via index
    return this.ownerIdx[owner].map(n => this.RR[n])

    // not optimized, searches length of array for matches
    // return this.RR.filter(r => {
    //   return r.get('owner') === owner
    // })
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
