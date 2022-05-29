
import assert from 'assert'

import ZONE from '../lib/zone.js'
import * as RR from '@nictool/dns-resource-record'

const testSOA = new RR.SOA({
  owner  : 'example.com.',
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
    const zone = new ZONE({ origin: 'example.com' })
    assert.ok(zone instanceof ZONE)
  })

  describe('setSOA', function () {

    before(function () {
      this.zone = new ZONE({ origin: 'example.com' })
    })

    it('sets the zones SOA', function () {
      this.zone.setSOA(testSOA)
      assert.equal(this.zone.SOA.owner, 'example.com.')
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
      this.zone = new ZONE({ origin: 'example.com' })
      this.zone.setSOA(testSOA)
    })

    const ns1 = new RR.NS({
      owner: 'example.com.',
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
        owner: 'example.com.',
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
          owner: 'example.com.',
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
      owner  : 'a1.example.com.',
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
        owner  : 'a2.example.com.',
        ttl    : 3600,
        class  : 'IN',
        type   : 'A',
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

    const cn1 = new RR.CNAME({
      owner: 'www2.example.com.',
      ttl  : 3600,
      class: 'IN',
      type : 'CNAME',
      cname: 'www.example.com.',
    })

    it('adds cname1 to a zone', function () {
      this.zone.addRR(cn1)
      const matches = this.zone.getRR(cn1)
      assert.equal(matches.length, 1)
      assert.deepEqual(matches[0], cn1)
    })

    it('fails to add CNAME with matching owner', function () {
      assert.throws(() => {
        this.zone.addRR(new RR.CNAME({
          owner: 'www2.example.com.',
          ttl  : 3600,
          class: 'IN',
          type : 'CNAME',
          cname: 'diff.example.com.',
        }))
      },
      {
        message: `multiple CNAME records with the same owner are NOT allowed, RFC 1034`,
      })
    })

    it('fails to add CNAME with matching owner and incompatible type', function () {
      assert.throws(() => {
        this.zone.addRR(new RR.CNAME({
          owner: 'example.com.',
          ttl  : 3600,
          class: 'IN',
          type : 'CNAME',
          cname: 'diff.example.com.',
        }))
      },
      {
        message: `owner already exists, CNAME not allowed, RFC 1034, 2181, & 4035`,
      })
    })

    it('fails to add AAAA adjacent to CNAME', function () {
      assert.throws(() => {
        this.zone.addRR(new RR.AAAA({
          owner  : 'www2.example.com.',
          ttl    : 3600,
          class  : 'IN',
          type   : 'AAAA',
          address: '2001:0db8:0020:000a:0000:0000:0000:0004',
        }))
      },
      {
        message: `owner exists as CNAME, not allowed, RFC 1034, 2181, & 4035`,
      })
    })
  })
})
