import assert from 'assert'
import fs from 'fs/promises'
import os from 'os'

import * as RR from '@nictool/dns-resource-record'
import mara from '../lib/maradns.js'

beforeEach(function () {
  Object.keys(mara.zoneOpts).map((k) => delete mara.zoneOpts[k])
})

describe('maradns', function () {
  describe('parseZoneFile', function () {
    it('parses blank line', async () => {
      mara.zoneOpts.showBlank = true
      const r = await mara.parseZoneFile(``)
      // console.dir(r[0], { depth: null })
      assert.deepStrictEqual(r, [''])
    })

    it('parses two blank lines', async () => {
      mara.zoneOpts.showBlank = true
      const r = await mara.parseZoneFile(os.EOL)
      // console.dir(r, { depth: null })
      assert.deepStrictEqual(r, ['', ''])
    })

    it('parses line with only whitespace', async () => {
      mara.zoneOpts.showBlank = true
      const r = await mara.parseZoneFile(` \t`)
      // console.dir(r, { depth: null })
      assert.deepStrictEqual(r, [' \t'])
    })

    it('parses comment line', async () => {
      mara.zoneOpts.showComment = true
      // I strip WS within this function, which breaks this test
      const r = await mara.parseZoneFile(`# blank comment`)
      // console.dir(r, { depth: null })
      assert.deepStrictEqual(r, ['# blank comment'])
    })

    it('parses comment line with leading ws', async () => {
      mara.zoneOpts.showComment = true
      const r = await mara.parseZoneFile(` # blank comment with leading ws`)
      // console.dir(r, { depth: null })
      assert.deepStrictEqual(r, [' # blank comment with leading ws'])
    })

    it(`parses SOA`, async () => {
      const r = await mara.parseZoneFile(`x.org. SOA x.org. john\\.doe@x.org. 1 7200 3600 604800 1800 ~`)
      // console.dir(r, { depth: null })
      assert.deepStrictEqual(
        r[0],
        new RR.SOA({
          owner: 'x.org.',
          ttl: 86400,
          type: 'SOA',
          mname: 'x.org.',
          rname: 'john\\.doe.x.org.',
          serial: 1,
          refresh: 7200,
          retry: 3600,
          expire: 604800,
          minimum: 1800,
        }),
      )
    })

    it('parses NS line', async () => {
      const r = await mara.parseZoneFile(`example.net.    NS    ns1.example.net. ~\n`)
      // console.dir(r, { depth: null })
      assert.deepStrictEqual(
        r[0],
        new RR.NS({
          owner: 'example.net.',
          class: 'IN',
          ttl: 86400,
          type: 'NS',
          dname: 'ns1.example.net.',
        }),
      )
    })

    it('parses A line', async () => {
      mara.zoneOpts.origin = 'example.com.'
      mara.zoneOpts.ttl = 3600
      const r = await mara.parseZoneFile(`percent.%   a       10.9.8.7 ~\n`)
      // console.dir(r, { depth: null })
      assert.deepStrictEqual(
        r[0],
        new RR.A({
          owner: 'percent.example.com.',
          ttl: 3600,
          type: 'A',
          address: '10.9.8.7',
        }),
      )
    })

    it('parses AAAA line', async () => {
      const r = await mara.parseZoneFile(`a.example.net.   AAAA    fd4d:6172:6144:4e53:ffe::f ~\n`)
      // console.dir(r, { depth: null })
      assert.deepStrictEqual(
        r[0],
        new RR.AAAA({
          owner: 'a.example.net.',
          ttl: 86400,
          type: 'AAAA',
          address: 'fd4d:6172:6144:4e53:ffe::f',
        }),
      )
    })

    it.skip(`parses CAA record (RAW)`, async () => {
      const r = await mara.parseZoneFile(`example.com. RAW 257 \x00\x05'issueletsencrypt.org' ~\n`)
      assert.deepStrictEqual(
        r[0],
        new RR.CAA({
          owner: 'example.com.',
          ttl: 86400,
          type: 'CAA',
          flags: 0,
          tag: 'issue',
          value: 'letsencrypt.org',
        }),
      )
    })

    it.skip('parses CNAME line', async () => {
      const r = await mara.parseZoneFile(`\n`)
      // console.dir(r, { depth: null })
      assert.deepStrictEqual(r[0], new RR.CNAME({}))
    })

    it('parses FQDN4 line', async () => {
      const r = await mara.parseZoneFile(`x.example.net. FQDN4 10.3.28.79 ~\n`)
      // console.dir(r, { depth: null })
      assert.deepStrictEqual(
        r[0],
        new RR.A({
          owner: 'x.example.net.',
          ttl: 86400,
          type: 'A',
          address: '10.3.28.79',
        }),
      )
      assert.deepStrictEqual(
        r[1],
        new RR.PTR({
          owner: '79.28.3.10.in-addr.arpa.',
          ttl: 86400,
          type: 'PTR',
          dname: 'x.example.net.',
        }),
      )
    })

    it('parses FQDN6 line', async () => {
      const r = await mara.parseZoneFile(`a.example.net.   FQDN6    fd4d:6172:6144:4e53:ffe::f ~\n`)
      // console.dir(r, { depth: null })
      assert.deepStrictEqual(
        r[0],
        new RR.AAAA({
          owner: 'a.example.net.',
          ttl: 86400,
          type: 'AAAA',
          address: 'fd4d:6172:6144:4e53:ffe::f',
        }),
      )
      assert.deepStrictEqual(
        r[1],
        new RR.PTR({
          owner: 'f.0.0.0.0.0.0.0.0.0.0.0.e.f.f.0.3.5.e.4.4.4.1.6.2.7.1.6.d.4.d.f.ip6.arpa.',
          ttl: 86400,
          type: 'PTR',
          dname: 'a.example.net.',
        }),
      )
    })

    it('parses HINFO line', async () => {
      const r = await mara.parseZoneFile(`example.com. HINFO 'Intel Pentium III';'CentOS Linux 3.7' ~\n`)
      // console.dir(r, { depth: null })
      assert.deepStrictEqual(
        r[0],
        new RR.HINFO({
          owner: 'example.com.',
          ttl: 86400,
          type: 'HINFO',
          cpu: 'Intel Pentium III',
          os: 'CentOS Linux 3.7',
        }),
      )
    })

    it('parses LOC line', async () => {
      const r = await mara.parseZoneFile(`example.net. LOC 19 31 2.123 N 98 3 4 W 2000m 2m 4m 567m ~\n`)
      // console.dir(r, { depth: null })
      assert.deepStrictEqual(
        r[0],
        new RR.LOC({
          owner: 'example.net.',
          ttl: 86400,
          type: 'LOC',
          address: '19 31 2.123 N 98 3 4 W 2000m 2m 4m 567m',
        }),
      )
    })

    it('parses MX line', async () => {
      mara.zoneOpts.origin = 'example.com.'
      const r = await mara.parseZoneFile(`% +86400 MX 10 mail.% ~\n`)
      assert.deepStrictEqual(
        r[0],
        new RR.MX({
          owner: 'example.com.',
          ttl: 86400,
          type: 'MX',
          preference: 10,
          exchange: 'mail.example.com.',
        }),
      )
    })

    it('parses PTR line', async () => {
      const r = await mara.parseZoneFile(`15.12.11.10.in-addr.arpa. +64000 PTR    c.example.net. ~\n`)
      assert.deepStrictEqual(
        r[0],
        new RR.PTR({
          owner: '15.12.11.10.in-addr.arpa.',
          ttl: 64000,
          type: 'PTR',
          dname: 'c.example.net.',
        }),
      )
    })

    it.skip('parses RAW line', async () => {
      const r = await mara.parseZoneFile(`example.com. RAW 40 \x10\x01\x02'Kitchen sink'\x40' data' ~\n`)
      assert.deepStrictEqual(r[0], {
        owner: 'example.com.',
        type: 'RAW',
        typeid: 40,
        rdata: `\x10\x01\x02'Kitchen sink'\x40' data'`,
      })
    })

    it('parses TXT line', async () => {
      const r = await mara.parseZoneFile(
        `oct2021._domainkey.example.com. +86400 TXT 'v=DKIM1;p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAoyUzGOTSOmakY8BcxXgi0mN/nFegLBPs7aaGQUtjHfa8yUrt9T2j6GSXgdjLuG3R43WjePQv3RHzc+bwwOkdw0XDOXiztn5mhrlaflbVr5PMSTrv64/cpFQKLtgQx8Vgqp7Dh3jw13rLomRTqJFgMrMHdhIibZEa69gtuAfDqoeXo6QDSGk5JuBAeRHEH27FriHulg5ob''4F4lmh7fMFVsDGkQEF6jaIVYqvRjDyyQed3R3aTJX3fpb3QrtRqvfn/LAf+3kzW58AjsERpsNCSTD2RquxbnyoR/1wdGKb8cUlD/EXvqtvpVnOzHeSeMEqex3kQI8HOGsEehWZlKd+GqwIDAQAB' ~\n`,
      )
      assert.deepStrictEqual(
        r[0],
        new RR.TXT({
          owner: 'oct2021._domainkey.example.com.',
          ttl: 86400,
          type: 'TXT',
          data: 'v=DKIM1;p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAoyUzGOTSOmakY8BcxXgi0mN/nFegLBPs7aaGQUtjHfa8yUrt9T2j6GSXgdjLuG3R43WjePQv3RHzc+bwwOkdw0XDOXiztn5mhrlaflbVr5PMSTrv64/cpFQKLtgQx8Vgqp7Dh3jw13rLomRTqJFgMrMHdhIibZEa69gtuAfDqoeXo6QDSGk5JuBAeRHEH27FriHulg5ob4F4lmh7fMFVsDGkQEF6jaIVYqvRjDyyQed3R3aTJX3fpb3QrtRqvfn/LAf+3kzW58AjsERpsNCSTD2RquxbnyoR/1wdGKb8cUlD/EXvqtvpVnOzHeSeMEqex3kQI8HOGsEehWZlKd+GqwIDAQAB',
        }),
      )
    })

    it('parses TXT line, quoted', async () => {
      const r = await mara.parseZoneFile(`example.com. TXT 'This is an example text field' ~\n`)
      assert.deepStrictEqual(
        r[0],
        new RR.TXT({
          owner: 'example.com.',
          ttl: 86400,
          type: 'TXT',
          data: 'This is an example text field',
        }),
      )
    })

    it('parses TXT line, unquoted', async () => {
      const r = await mara.parseZoneFile(`c.example.com. TXT This_is_100%_unquoted_text_+symbols! ~\n`)
      // console.dir(r, { depth: null })
      assert.deepStrictEqual(
        r[0],
        new RR.TXT({
          owner: 'c.example.com.',
          ttl: 86400,
          type: 'TXT',
          data: 'This_is_100%_unquoted_text_+symbols!',
        }),
      )
    })

    it('parses TXT line, mixed quotes', async () => {
      const r = await mara.parseZoneFile(
        `d.example.com. TXT This' is a mix 'of_unquoted' and quoted 'text! ~\n`,
      )
      // console.dir(r, { depth: null })
      assert.deepStrictEqual(
        r[0],
        new RR.TXT({
          owner: 'd.example.com.',
          ttl: 86400,
          type: 'TXT',
          data: 'This is a mix of_unquoted and quoted text!',
        }),
      )
    })

    it('parses TXT line, multiline with comments', async () => {
      const r = await mara.parseZoneFile(`j.example.com. TXT 'Not only did the quick brown fox jump '\
                   'over the lazy dog, but the lazy dog'\
                   ' jumped over the cat.' ~\n`)
      // console.dir(r, { depth: null })
      assert.deepStrictEqual(
        r[0],
        new RR.TXT({
          owner: 'j.example.com.',
          ttl: 86400,
          type: 'TXT',
          data: 'Not only did the quick brown fox jump over the lazy dog, but the lazy dog jumped over the cat.',
        }),
      )
    })

    it('parses SRV line', async () => {
      mara.zoneOpts.origin = 'example.com.'
      const r = await mara.parseZoneFile(`_http._tcp.% SRV 0 0 80 a.% ~\n`)
      assert.deepStrictEqual(
        r[0],
        new RR.SRV({
          owner: '_http._tcp.example.com.',
          ttl: 86400,
          type: 'SRV',
          port: 80,
          priority: 0,
          target: 'a.example.com.',
          weight: 0,
        }),
      )
    })
  })

  it('loads and validates example.com', async function () {
    const file = './test/fixtures/mara/example.net.csv2'
    const buf = await fs.readFile(file)
    const stat = await fs.stat(file)

    mara.zoneOpts.ttl = 3600
    mara.zoneOpts.origin = 'example.net.'
    mara.zoneOpts.serial = Math.round(stat.mtime.getTime() / 1000)
    const rrs = await mara.parseZoneFile(buf.toString())
    // console.dir(rrs, { depth: null })
    assert.equal(rrs.length, 40)
  })
})
