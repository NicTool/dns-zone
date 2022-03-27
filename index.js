
class ZONE extends Map {
  constructor (opts = {}) {
    super()

    this.RR = []
    this.SOA = {}

    this.setOrigin(opts.origin)
    this.setTTL(opts.ttl)
  }

  addRR (rr = {}) {
    // TODO: assure origin is set
    // TODO: All RRs in the file should have the same class.
    const type = rr.get('type')

    if ('SOA' !== type && !this.SOA.name) throw new Error('SOA must be set first!')

    switch (type) {
      case 'SOA': return this.setSOA(rr)
      case 'NS' : return this.addNS(rr)
    }
    // do checks

    // if they pass, add to array
    this.RRS.push(rr)
  }

  addNS (rr) {
    this.isNotDuplicate(rr)
    this.itMatchesSetTTL(rr)
    // TODO: not a type collision

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

  isNotDuplicate (rr) {
    if (this.getRR(rr).length)
      throw new Error('multiple identical RRs are not allowed, RFC 2181')
  }

  itMatchesSetTTL (rr) {
    // a Resource Record Set exists...with the same label, class, type (different data)
    const matches = this.RR.filter(r => {

      const diffs = [ 'name', 'class', 'type' ].map(f => {
        return r.get(f) === rr.get(f)
      }).filter(m => m === false).length

      if (!diffs) return r
    })
    if (!matches.length) return true
    if (matches[0].get('ttl') === rr.get('ttl')) return true
    throw new Error('Records with identical label, class, and type must have identical TTL, RFC 2181')
  }

  setOrigin (val) {
    if (!val) throw new Error('origin is required!')
    this.set('origin', val)
  }

  setSOA (rr) {
    if (this.SOA.name)
      throw new Error('Exactly one SOA RR should be present at the top!, RFC 1035')

    rr.getFields().map(f => this.SOA[f] = rr.get(f))
  }

  setTTL (val) {
    if (!val) return
    this.set('ttl', val)
  }
}

module.exports = { ZONE }