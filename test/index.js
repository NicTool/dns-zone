
const assert = require('assert')

const DNSZONE = require('../index').ZONE
const RR      = require('dns-resource-record')

describe('dns-zone', function () {

  it('creates a zone object', function () {
    const zone = new DNSZONE({ origin: 'example.com' })
    assert.ok(zone instanceof DNSZONE)
  })

  describe('setSOA', function () {

    before(function () {
      this.zone = new DNSZONE({ origin: 'example.com' })
    })

    const testRR = new RR.SOA({
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

    it('sets the zones SOA', function () {
      this.zone.setSOA(testRR)
      assert.equal(this.zone.SOA.name, 'example.com.')
    })

    it('rejects a second SOA', function () {
      assert.throws(() => {
        this.zone.setSOA(testRR)
      },
      {
        message: 'Exactly one SOA RR should be present at the top!, RFC 1035',
      })
    })
  })

  describe('addNS', function () {

    before(function () {
      this.zone = new DNSZONE({ origin: 'example.com' })
    })

    const ns1 = new RR.NS({
      name : 'example.com.',
      ttl  : 3600,
      class: 'IN',
      type : 'NS',
      dname: 'ns1.example.com.',
    })

    it('adds ns1 to a zone', function () {
      this.zone.addNS(ns1)

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
      this.zone.addNS(ns2)

      const matches = this.zone.getRR(ns2)
      assert.equal(matches.length, 1)
      assert.deepEqual(matches[0], ns2)
    })

    it('rejects identical ns1', function () {
      assert.throws(() => {
        this.zone.addNS(ns1)
      },
      {
        message: 'multiple identical RRs are not allowed, RFC 2181',
      })
    })

    it('rejects matching RRset with different TTL', function () {
      assert.throws(() => {
        this.zone.addNS(new RR.NS({
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

  })
})