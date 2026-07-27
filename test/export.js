// The zone-data generators, the counterpart to the parsers.
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import * as RR from '@nictool/dns-resource-record'

import { toBind, toMaraDNS, toTinydns, toJSON } from '../lib/export.js'

const rr = (type, fields) => new RR[type]({ owner: 'www.x.org.', ttl: 300, class: 'IN', ...fields })

const rrs = [rr('A', { address: '10.1.2.3' })]

describe('toBind', () => {
  it('emits the directives it is given', () => {
    const text = toBind(rrs, { origin: 'x.org.', ttl: 300 })

    assert.match(text, /^\$ORIGIN x\.org\.$/m)
    assert.match(text, /^\$TTL 300$/m)
  })

  it('does not duplicate directives a parsed zone already carries', () => {
    const text = toBind([{ $ORIGIN: 'x.org.' }, { $TTL: 300 }, ...rrs], {
      origin: 'x.org.',
      ttl: 300,
    })

    assert.equal(text.match(/\$ORIGIN/g).length, 1)
    assert.equal(text.match(/\$TTL/g).length, 1)
  })

  it('writes owners relative to the origin when asked', () => {
    const text = toBind(rrs, { origin: 'x.org.', hide: { origin: true } })

    assert.match(text, /^www\s/m)
    assert.doesNotMatch(text, /^www\.x\.org\./m)
  })
})

describe('toTinydns', () => {
  it('skips directives, which djbdns has no concept of', () => {
    const text = toTinydns([{ $ORIGIN: 'x.org.' }, ...rrs])

    assert.doesNotMatch(text, /ORIGIN/)
    assert.match(text, /^\+www\.x\.org:10\.1\.2\.3/m)
  })
})

describe('toMaraDNS', () => {
  it('terminates records with ~ by default', () => {
    assert.match(toMaraDNS(rrs), /10\.1\.2\.3 ~$/m)
  })

  it('omits the terminator when asked, for MaraDNS 1.2', () => {
    // 1.2's csv2 parser counts fields per type and rejects a trailing ~.
    const text = toMaraDNS(rrs, { terminator: '' })

    assert.match(text, /10\.1\.2\.3$/m)
    assert.doesNotMatch(text, /~/)
  })

  it('turns directives into /origin and /ttl lines', () => {
    const text = toMaraDNS(rrs, { origin: 'x.org.', ttl: 300 })

    assert.match(text, /^\/origin x\.org\.$/m)
    assert.match(text, /^\/ttl 300$/m)
  })
})

describe('toJSON', () => {
  it('emits one record per line', () => {
    const lines = toJSON([...rrs, rr('A', { address: '10.1.2.4' })])
      .trim()
      .split('\n')

    assert.equal(lines.length, 2)
    assert.equal(JSON.parse(lines[0]).address, '10.1.2.3')
  })
})
