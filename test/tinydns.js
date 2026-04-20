import assert from 'assert'
import fs from 'fs/promises'
import { describe, it, beforeEach } from 'node:test'

import * as tinydns from '../lib/tinydns.js'

beforeEach(() => {
  for (const k in Object.keys(tinydns.zoneOpts)) delete tinydns.zoneOpts[k]
})

describe('tinydns', function () {
  describe('parseData', function () {
    it('parses empty string', async () => {
      assert.deepStrictEqual(await tinydns.parseData(''), [])
    })

    it('ignores comment lines', async () => {
      assert.deepStrictEqual(await tinydns.parseData('#this is a comment'), [])
    })

    it('ignores % location lines', async () => {
      assert.deepStrictEqual(await tinydns.parseData('%lo:127.0.0.0/8'), [])
    })

    it('ignores - disabled lines', async () => {
      assert.deepStrictEqual(await tinydns.parseData('-example.com.:192.168.1.1:86400'), [])
    })

    it('parses . (dot) record: SOA, NS, A', async () => {
      const r = await tinydns.parseData('.example.com.:192.168.1.1:ns1:86400::')
      assert.equal(r.length, 3)
      assert.equal(r[0].get('type'), 'SOA')
      assert.equal(r[1].get('type'), 'NS')
      assert.equal(r[2].get('type'), 'A')
      assert.equal(r[2].get('address'), '192.168.1.1')
    })

    it('parses . (dot) record without IP: SOA, NS only', async () => {
      const r = await tinydns.parseData('.example.com.::ns1.example.com.:86400::')
      assert.equal(r.length, 2)
      assert.equal(r[0].get('type'), 'SOA')
      assert.equal(r[1].get('type'), 'NS')
    })

    it('parses & (ampersand) record with IP: NS, A', async () => {
      const r = await tinydns.parseData('&example.com.:192.168.1.1:ns1.example.com.:86400::')
      assert.equal(r.length, 2)
      assert.equal(r[0].get('type'), 'NS')
      assert.equal(r[1].get('type'), 'A')
      assert.equal(r[1].get('address'), '192.168.1.1')
    })

    it('parses = (equals) record: A, PTR', async () => {
      const r = await tinydns.parseData('=example.com.:192.168.1.1:86400::')
      assert.equal(r.length, 2)
      assert.equal(r[0].get('type'), 'A')
      assert.equal(r[1].get('type'), 'PTR')
      assert.equal(r[1].get('owner'), '1.1.168.192.in-addr.arpa.')
    })

    it('parses @ (at) MX record with IP: MX, A', async () => {
      const r = await tinydns.parseData('@example.com.:192.168.1.1:mail.example.com.:10:86400::')
      assert.equal(r.length, 2)
      assert.equal(r[0].get('type'), 'MX')
      assert.equal(r[1].get('type'), 'A')
      assert.equal(r[1].get('address'), '192.168.1.1')
    })

    it('parses ^ (caret) PTR record', async () => {
      const r = await tinydns.parseData('^1.1.168.192.in-addr.arpa.:example.com.:86400::')
      assert.equal(r.length, 1)
      assert.equal(r[0].get('type'), 'PTR')
    })

    it('parses 3 AAAA record', async () => {
      const r = await tinydns.parseData('3a.example.net.:fd4d617261444e530000000100020003:86400::')
      assert.equal(r.length, 1)
      assert.equal(r[0].get('type'), 'AAAA')
    })

    it('parses 6 AAAA+PTR record', async () => {
      const r = await tinydns.parseData('6a.example.net.:fd4d617261444e530000000100020003:x:86400::')
      assert.equal(r.length, 2)
      assert.equal(r[0].get('type'), 'AAAA')
      assert.equal(r[1].get('type'), 'PTR')
    })

    it('parses S SRV record', async () => {
      const r = await tinydns.parseData('S_imaps._tcp.example.com.:mail.example.com.:993:1:0:86400::')
      assert.equal(r.length, 1)
      assert.equal(r[0].get('type'), 'SRV')
      assert.equal(r[0].get('port'), 993)
    })

    it('parses : generic AAAA (type 28) record', async () => {
      const r = await tinydns.parseData(
        ':a.example.net:28:\\375\\115\\141\\162\\141\\104\\116\\123\\000\\001\\000\\002\\000\\003\\000\\004:86400::',
      )
      assert.equal(r.length, 1)
      assert.equal(r[0].get('type'), 'AAAA')
    })

    it('parses : generic HINFO (type 13) record', async () => {
      const r = await tinydns.parseData(':example.com:13:\\003x86\\005Linux:86400::')
      assert.equal(r.length, 1)
      assert.equal(r[0].get('type'), 'HINFO')
      assert.equal(r[0].get('cpu'), 'x86')
      assert.equal(r[0].get('os'), 'Linux')
    })

    it('parses : generic SPF (type 99) record', async () => {
      const r = await tinydns.parseData(':example.net:99:v=spf1 +mx -all:86400::')
      assert.equal(r.length, 1)
      assert.equal(r[0].get('type'), 'SPF')
    })

    it('parses : generic SSHFP (type 44) record', async () => {
      const r = await tinydns.parseData(
        ':mail.example.com:44:\\001\\001\\035ed8c6e16fdae4f633eee6a7b8f64fdd356bbb32841d53:86400::',
      )
      assert.equal(r.length, 1)
      assert.equal(r[0].get('type'), 'SSHFP')
    })

    it('parses : generic LOC (type 29) record', async () => {
      const r = await tinydns.parseData(
        ':example.com:29:\\000\\045\\000\\000\\211\\026\\313\\074\\160\\303\\020\\337\\000\\230\\205\\120:3600::',
      )
      assert.equal(r.length, 1)
      assert.equal(r[0].get('type'), 'LOC')
    })

    it('parses : generic SRV (type 33) record', async () => {
      const r = await tinydns.parseData(
        ':_http._tcp.example.net:33:\\000\\000\\000\\000\\000\\120\\001a\\007example\\003net\\000:86400::',
      )
      assert.equal(r.length, 1)
      assert.equal(r[0].get('type'), 'SRV')
    })

    it('parses : generic NAPTR (type 35) record', async () => {
      const r = await tinydns.parseData(
        ':www.example.com:35:\\000\\144\\000\\144\\001S\\010http+I2R\\000\\027_http._tcp.example.com.\\000:86400::',
      )
      assert.equal(r.length, 1)
      assert.equal(r[0].get('type'), 'NAPTR')
    })

    it('parses : generic DNAME (type 39) record', async () => {
      const r = await tinydns.parseData(':_tcp.example.com:39:\\004\\137tcp\\007example\\003net\\000:3600::')
      assert.equal(r.length, 1)
      assert.equal(r[0].get('type'), 'DNAME')
    })

    it('parses : generic DS (type 43) record', async () => {
      const r = await tinydns.parseData(
        ':dskey.example.com:43:\\354\\105\\005\\0012BB183AF5F22588179A53B0A98631FAD1A292118:3600::',
      )
      assert.equal(r.length, 1)
      assert.equal(r[0].get('type'), 'DS')
    })

    it('parses : generic DNSKEY (type 48) record', async () => {
      const r = await tinydns.parseData(
        ':example.com:48:\\001\\000\\003\\005AQPSKmynfzW4kyBv015MUG2DeIQ3Cbl+BBZH4b\\0570PY1kxkmvHjcZc8nokfzj31GajIQKY+5CptLr3buXA10hWqTkF7H6RfoRqXQeogmMHfpftf6z:3600::',
      )
      assert.equal(r.length, 1)
      assert.equal(r[0].get('type'), 'DNSKEY')
    })

    it('parses : generic TLSA (type 52) record', async () => {
      const r = await tinydns.parseData(
        ':_443._tcp.example.com:52:\\000\\000\\001d2abde240d7cd3ee6b4b28c54df034b97983a1d16e8a410e4561cb106618e971:3600::',
      )
      assert.equal(r.length, 1)
      assert.equal(r[0].get('type'), 'TLSA')
    })

    it('parses : generic SMIMEA (type 53) record', async () => {
      const r = await tinydns.parseData(
        ':_443._tcp.www.example.com:53:\\000\\000\\001d2abde240d7cd3ee6b4b28c54df034b97983a1d16e8a410e4561cb106618e971:3600::',
      )
      assert.equal(r.length, 1)
      assert.equal(r[0].get('type'), 'SMIMEA')
    })

    it('parses : generic URI (type 256) record', async () => {
      const r = await tinydns.parseData(':www.example.com:256:\\000\\001\\000\\000www2.example.com.:3600::')
      assert.equal(r.length, 1)
      assert.equal(r[0].get('type'), 'URI')
    })

    it('parses : generic CAA (type 257) record', async () => {
      const r = await tinydns.parseData(':example.com:257:\\000\\005issue"letsencrypt.org":3600::')
      assert.equal(r.length, 1)
      assert.equal(r[0].get('type'), 'CAA')
    })

    it('throws on unsupported generic record type', async () => {
      await assert.rejects(() => tinydns.parseData(':example.com:1000:data:86400::'), {
        message: /unsupported tinydns generic record/,
      })
    })

    it('throws on unknown record type', async () => {
      await assert.rejects(() => tinydns.parseData('Xgarbage'), { message: /garbage found in tinydns data/ })
    })

    it('parses theartfarm.com data file', async () => {
      const buf = await fs.readFile('./test/fixtures/tinydns/data')
      const r = await tinydns.parseData(buf.toString())
      assert.ok(r.length > 0)
    })
  })
})
