import assert from 'assert'
import fs from 'fs/promises'
import { describe, it } from 'node:test'

import * as RR from '@nictool/dns-resource-record'
import * as json from '../lib/json.js'

describe('json', function () {
  describe('parseZoneFile', function () {
    it('parses empty string', async () => {
      const r = await json.parseZoneFile('')
      assert.deepStrictEqual(r, [])
    })

    it('parses a single A record', async () => {
      const r = await json.parseZoneFile(
        '{"owner":"example.com.","type":"A","ttl":3600,"class":"IN","address":"1.2.3.4"}',
      )
      assert.equal(r.length, 1)
      assert.deepStrictEqual(
        r[0],
        new RR.A({ owner: 'example.com.', type: 'A', ttl: 3600, class: 'IN', address: '1.2.3.4' }),
      )
    })

    it('parses example.com fixture', async () => {
      const buf = await fs.readFile('./test/fixtures/json/example.com')
      const rrs = await json.parseZoneFile(buf.toString())
      assert.equal(rrs.length, 5)
      assert.equal(rrs[0].get('type'), 'SOA')
      assert.equal(rrs[2].get('type'), 'A')
      assert.equal(rrs[2].get('address'), '1.2.3.4')
    })

    it('round-trips BIND → JSON → RR', async () => {
      const bind = (await import('../lib/bind.js')).default
      const buf = await fs.readFile('./test/fixtures/bind/example.net')
      const rrs = await bind.parseZoneFile(buf.toString(), { file: './test/fixtures/bind/example.net' })
      const ndjson = rrs
        .filter((r) => r.get)
        .map((r) => JSON.stringify(Object.fromEntries(r)))
        .join('\n')
      const roundTripped = await json.parseZoneFile(ndjson)
      assert.equal(roundTripped.length, rrs.filter((r) => r.get).length)
    })

    it('throws on record missing type', async () => {
      await assert.rejects(
        json.parseZoneFile('{"owner":"example.com.","ttl":3600,"address":"1.2.3.4"}'),
        /missing 'type'/,
      )
    })

    it('throws on unknown RR type', async () => {
      await assert.rejects(
        json.parseZoneFile('{"owner":"example.com.","type":"BOGUS","ttl":3600}'),
        /unknown RR type/,
      )
    })
  })
})
