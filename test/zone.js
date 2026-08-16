import assert from 'assert'
import { describe, it, before } from 'node:test'

import ZONE, { splitByZone } from '../lib/zone.js'
import * as RR from '@nictool/dns-resource-record'

const testSOA = new RR.SOA({
  owner: 'example.com.',
  ttl: 3600,
  class: 'IN',
  type: 'SOA',
  mname: 'matt.example.com.',
  rname: 'ns1.example.com.',
  serial: 1,
  refresh: 16384,
  retry: 2048,
  expire: 1048576,
  minimum: 2560,
})

describe('zone', function () {
  it('creates a zone object', function () {
    const zone = new ZONE({ origin: 'example.com' })
    assert.ok(zone instanceof ZONE)
  })

  describe('splitByZone', function () {
    const soaFor = (owner) =>
      new RR.SOA({
        owner,
        ttl: 3600,
        class: 'IN',
        type: 'SOA',
        mname: `ns1.${owner}`,
        rname: `hostmaster.${owner}`,
        serial: 1,
        refresh: 16384,
        retry: 2048,
        expire: 1048576,
        minimum: 2560,
      })

    const aFor = (owner) => new RR.A({ owner, ttl: 3600, class: 'IN', type: 'A', address: '192.0.2.1' })

    it('leaves a single-zone array untouched', function () {
      const RRs = [testSOA, aFor('a.example.com.')]
      const zones = splitByZone(RRs)
      assert.equal(zones.length, 1)
      assert.equal(zones[0].apex, 'example.com.')
      assert.deepEqual(zones[0].RR, RRs)
    })

    it('leaves an array with no SOA untouched', function () {
      const RRs = [aFor('a.example.com.')]
      const zones = splitByZone(RRs)
      assert.equal(zones.length, 1)
      assert.equal(zones[0].apex, undefined)
      assert.deepEqual(zones[0].RR, RRs)
    })

    it('groups records by zone when a file holds several', function () {
      const zones = splitByZone(
        [soaFor('example.com.'), aFor('a.example.com.'), soaFor('example.net.'), aFor('a.example.net.')],
        { manyZones: true },
      )
      assert.equal(zones.length, 2)
      assert.deepEqual(
        zones.map((z) => [z.apex, z.RR.length]),
        [
          ['example.com.', 2],
          ['example.net.', 2],
        ],
      )
    })

    it('puts the SOA first even when the file holds one zone', function () {
      const zones = splitByZone([aFor('a.example.com.'), soaFor('example.com.')], { manyZones: true })
      assert.equal(zones.length, 1)
      assert.equal(zones[0].RR[0].get('type'), 'SOA')
    })

    it('puts the SOA first in every group', function () {
      const zones = splitByZone(
        [aFor('a.example.com.'), soaFor('example.com.'), aFor('a.example.net.'), soaFor('example.net.')],
        { manyZones: true },
      )
      for (const zone of zones) assert.equal(zone.RR[0].get('type'), 'SOA')
    })

    it('assigns a record to the most specific enclosing zone', function () {
      const zones = splitByZone(
        [soaFor('example.com.'), soaFor('_tcp.example.com.'), aFor('host._tcp.example.com.')],
        { manyZones: true },
      )
      const child = zones.find((z) => z.apex === '_tcp.example.com.')
      assert.equal(child.RR.length, 2)
      assert.equal(zones.find((z) => z.apex === 'example.com.').RR.length, 1)
    })

    it('keeps records together by default, so an extra SOA stays an error', function () {
      const RRs = [soaFor('example.com.'), soaFor('example.net.')]
      const zones = splitByZone(RRs)
      assert.equal(zones.length, 1)
      assert.deepEqual(zones[0].RR, RRs)
    })

    it('drops records enclosed by no zone in the file', function () {
      const zones = splitByZone([soaFor('example.com.'), soaFor('example.net.'), aFor('a.example.org.')], {
        manyZones: true,
      })
      assert.deepEqual(
        zones.map((z) => z.RR.length),
        [1, 1],
      )
    })
  })

  describe('document elements', function () {
    it('skips blank line and comment markers', function () {
      const zone = new ZONE({ RR: ['', ' \t', '; a comment', testSOA] })
      assert.deepEqual(zone.errors, [])
      assert.equal(zone.SOA.owner, 'example.com.')
    })

    it('applies the $ORIGIN and $TTL directives', function () {
      const zone = new ZONE({ RR: [{ $ORIGIN: 'example.com.' }, { $TTL: 3600 }, testSOA] })
      assert.deepEqual(zone.errors, [])
      assert.equal(zone.origin, 'example.com.')
      assert.equal(zone.ttl, 3600)
    })

    it('applies $TTL 0, RFC 2308', function () {
      const zone = new ZONE({ RR: [{ $TTL: 0 }, testSOA] })
      assert.deepEqual(zone.errors, [])
      assert.strictEqual(zone.ttl, 0)
    })
  })

  describe('setSOA', function () {
    let zone
    before(function () {
      zone = new ZONE({ origin: 'example.com' })
    })

    it('sets the zones SOA', function () {
      zone.setSOA(testSOA)
      assert.equal(zone.SOA.owner, 'example.com.')
    })

    it('rejects a second SOA', function () {
      assert.throws(
        () => {
          zone.setSOA(testSOA)
        },
        {
          message: 'Exactly one SOA RR should be present at the top!, RFC 1035',
        },
      )
    })
  })

  describe('addRR', function () {
    let zone
    before(function () {
      zone = new ZONE({ origin: 'example.com' })
      zone.setSOA(testSOA)
    })

    const ns1 = new RR.NS({
      owner: 'example.com.',
      ttl: 3600,
      class: 'IN',
      type: 'NS',
      dname: 'ns1.example.com.',
    })

    it('adds ns1 to a zone', function () {
      zone.addRR(ns1)

      const matches = zone.getRR(ns1)
      assert.equal(matches.length, 1)
      assert.deepEqual(matches[0], ns1)
    })

    it('adds ns2 to a zone', function () {
      const ns2 = new RR.NS({
        owner: 'example.com.',
        ttl: 3600,
        class: 'IN',
        type: 'NS',
        dname: 'ns2.example.com.',
      })
      zone.addRR(ns2)

      const matches = zone.getRR(ns2)
      assert.equal(matches.length, 1)
      assert.deepEqual(matches[0], ns2)
    })

    it('rejects identical ns1', function () {
      assert.throws(
        () => {
          zone.addRR(ns1)
        },
        {
          message: 'multiple identical RRs are not allowed, RFC 2181',
        },
      )
    })

    it('rejects matching RRset with different TTL', function () {
      assert.throws(
        () => {
          zone.addRR(
            new RR.NS({
              owner: 'example.com.',
              ttl: 7200,
              class: 'IN',
              type: 'NS',
              dname: 'ns1.example.com.',
            }),
          )
        },
        {
          message: 'Records with identical label, class, and type must have identical TTL, RFC 2181',
        },
      )
    })

    const a1 = new RR.A({
      owner: 'a1.example.com.',
      ttl: 3600,
      class: 'IN',
      type: 'A',
      address: '192.0.2.127',
    })

    it('adds A record to a zone', function () {
      zone.addRR(a1)

      const matches = zone.getRR(a1)
      assert.equal(matches.length, 1)
      assert.deepEqual(matches[0], a1)
    })

    it('adds a2 to a zone', function () {
      const a2 = new RR.A({
        owner: 'a2.example.com.',
        ttl: 3600,
        class: 'IN',
        type: 'A',
        address: '192.0.2.128',
      })
      zone.addRR(a2)

      const matches = zone.getRR(a2)
      assert.equal(matches.length, 1)
      assert.deepEqual(matches[0], a2)
    })

    it('rejects identical a1', function () {
      assert.throws(
        () => {
          zone.addRR(a1)
        },
        {
          message: 'multiple identical RRs are not allowed, RFC 2181',
        },
      )
    })

    const cn1 = new RR.CNAME({
      owner: 'www2.example.com.',
      ttl: 3600,
      class: 'IN',
      type: 'CNAME',
      cname: 'www.example.com.',
    })

    it('adds cname1 to a zone', function () {
      zone.addRR(cn1)
      const matches = zone.getRR(cn1)
      assert.equal(matches.length, 1)
      assert.deepEqual(matches[0], cn1)
    })

    it('fails to add CNAME with matching owner', function () {
      assert.throws(
        () => {
          zone.addRR(
            new RR.CNAME({
              owner: 'www2.example.com.',
              ttl: 3600,
              class: 'IN',
              type: 'CNAME',
              cname: 'diff.example.com.',
            }),
          )
        },
        {
          message: `multiple CNAME records with the same owner are NOT allowed, RFC 1034`,
        },
      )
    })

    it('fails to add CNAME with matching owner and incompatible type', function () {
      assert.throws(
        () => {
          zone.addRR(
            new RR.CNAME({
              owner: 'example.com.',
              ttl: 3600,
              class: 'IN',
              type: 'CNAME',
              cname: 'diff.example.com.',
            }),
          )
        },
        {
          message: `owner already exists, CNAME not allowed, RFC 1034, 2181, & 4035`,
        },
      )
    })

    it('fails to add AAAA adjacent to CNAME', function () {
      assert.throws(
        () => {
          zone.addRR(
            new RR.AAAA({
              owner: 'www2.example.com.',
              ttl: 3600,
              class: 'IN',
              type: 'AAAA',
              address: '2001:0db8:0020:000a:0000:0000:0000:0004',
            }),
          )
        },
        {
          message: `owner exists as CNAME, not allowed, RFC 1034, 2181, & 4035`,
        },
      )
    })
  })
})
