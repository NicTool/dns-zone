
const assert = require('assert')

const DNSZONE = require('../index').ZONE
const RR      = require('dns-resource-record')

const testSOA = new RR.SOA({
  name   : 'example.com.',
  ttl    : 3600,
  class  : 'IN',
  type   : 'SOA',
  mname  : 'matt.example.com.',
  rname  : 'ns1.example.com.',
  serial : 1,
  refresh: 16384,
  retry  : 2048,
  expire : 1048576,
  minimum: 2560,
})

describe('dns-zone', function () {

  it('creates a zone object', function () {
    const zone = new DNSZONE({ origin: 'example.com' })
    assert.ok(zone instanceof DNSZONE)
  })

  describe('setSOA', function () {

    before(function () {
      this.zone = new DNSZONE({ origin: 'example.com' })
    })

    it('sets the zones SOA', function () {
      this.zone.setSOA(testSOA)
      assert.equal(this.zone.SOA.name, 'example.com.')
    })

    it('rejects a second SOA', function () {
      assert.throws(() => {
        this.zone.setSOA(testSOA)
      },
      {
        message: 'Exactly one SOA RR should be present at the top!, RFC 1035',
      })
    })
  })

  describe('addRR', function () {

    before(function () {
      this.zone = new DNSZONE({ origin: 'example.com' })
      this.zone.setSOA(testSOA)
    })

    const ns1 = new RR.NS({
      name : 'example.com.',
      ttl  : 3600,
      class: 'IN',
      type : 'NS',
      dname: 'ns1.example.com.',
    })

    it('adds ns1 to a zone', function () {
      this.zone.addRR(ns1)

      const matches = this.zone.getRR(ns1)
      assert.equal(matches.length, 1)
      assert.deepEqual(matches[0], ns1)
    })

    it('adds ns2 to a zone', function () {
      const ns2 = new RR.NS({
        name : 'example.com.',
        ttl  : 3600,
        class: 'IN',
        type : 'NS',
        dname: 'ns2.example.com.',
      })
      this.zone.addRR(ns2)

      const matches = this.zone.getRR(ns2)
      assert.equal(matches.length, 1)
      assert.deepEqual(matches[0], ns2)
    })

    it('rejects identical ns1', function () {
      assert.throws(() => {
        this.zone.addRR(ns1)
      },
      {
        message: 'multiple identical RRs are not allowed, RFC 2181',
      })
    })

    it('rejects matching RRset with different TTL', function () {
      assert.throws(() => {
        this.zone.addRR(new RR.NS({
          name : 'example.com.',
          ttl  : 7200,
          class: 'IN',
          type : 'NS',
          dname: 'ns1.example.com.',
        }))
      },
      {
        message: 'Records with identical label, class, and type must have identical TTL, RFC 2181',
      })
    })

    const a1 = new RR.A({
      name   : 'a1.example.com.',
      ttl    : 3600,
      class  : 'IN',
      type   : 'A',
      address: '192.0.2.127',
    })

    it('adds A record to a zone', function () {
      this.zone.addRR(a1)

      const matches = this.zone.getRR(a1)
      assert.equal(matches.length, 1)
      assert.deepEqual(matches[0], a1)
    })

    it('adds a2 to a zone', function () {
      const a2 = new RR.A({
        name   : 'a2.example.com.',
        ttl    : 3600,
        class  : 'IN',
        type   : 'NS',
        address: '192.0.2.128',
      })
      this.zone.addRR(a2)

      const matches = this.zone.getRR(a2)
      assert.equal(matches.length, 1)
      assert.deepEqual(matches[0], a2)
    })

    it('rejects identical a1', function () {
      assert.throws(() => {
        this.zone.addRR(a1)
      },
      {
        message: 'multiple identical RRs are not allowed, RFC 2181',
      })
    })
  })


})