
import assert from 'assert'
import fs     from 'fs/promises'
import os     from 'os'

import * as RR from 'dns-resource-record'
import * as bind from '../lib/bind.js'

beforeEach(() => {
  Object.keys(bind.zoneOpts).map(k => delete bind.zoneOpts[k])
})

describe('bind', function () {

  describe('parseZoneFile', function () {

    it('parses blank line', async () => {
      bind.zoneOpts.showBlank = true
      const r = await bind.parseZoneFile('')
      // console.dir(r, { depth: null })
      assert.deepStrictEqual(r, [ '' ])
    })

    it('parses two blank lines', async () => {
      bind.zoneOpts.showBlank = true
      const r = await bind.parseZoneFile(os.EOL)
      // console.dir(r, { depth: null })
      assert.deepStrictEqual(r, [ '', '' ])
    })

    it('parses line with only whitespace', async () => {
      bind.zoneOpts.showBlank = true
      const r = await bind.parseZoneFile(` \t`)
      // console.dir(r, { depth: null })
      assert.deepStrictEqual(r, [ ' \t' ])
    })

    it('parses comment line', async () => {
      bind.zoneOpts.showComment = true
      const r = await bind.parseZoneFile(`; blank comment`)
      // console.dir(r, { depth: null })
      assert.deepStrictEqual(r, [ '; blank comment' ])
    })

    it('parses comment line with leading ws', async () => {
      bind.zoneOpts.showComment = true
      const r = await bind.parseZoneFile(` ; blank comment with leading ws`)
      // console.dir(r, { depth: null })
      assert.deepStrictEqual(r, [ ' ; blank comment with leading ws' ])
    })

    it('parses $TTL line', async () => {
      const r = await bind.parseZoneFile(`$TTL 86400`)
      // console.dir(r, { depth: null })
      assert.deepStrictEqual(r[0], { $TTL: 86400 })
    })

    it('parses $TTL line with a comment', async () => {
      const r = await bind.parseZoneFile(`$TTL 86400; yikers`)
      // console.dir(r, { depth: null })
      assert.deepStrictEqual(r[0], { $TTL: 86400 })
    })

    it.only(`parses SOA`, async () => {
      const r = await bind.parseZoneFile(`example.com.   86400   IN  SOA ns1.example.com.    hostmaster.example.com. (
                      2021102100    ; serial
                      16384   ; refresh
                      2048     ; retry
                      604800    ; expiry
                      2560   ; minimum
                      ) ${os.EOL}`)

      // console.dir(r, { depth: null })
      assert.deepStrictEqual(r[0], new RR.SOA({
        owner  : 'example.com.',
        ttl    : 86400,
        class  : 'IN',
        type   : 'SOA',
        mname  : 'ns1.example.com.',
        rname  : 'hostmaster.example.com.',
        serial : 2021102100,
        refresh: 16384,
        retry  : 2048,
        expire : 604800,
        minimum: 2560,
      }))
    })

    it(`parses SOA one liner`, async () => {
      const r = await bind.parseZoneFile(`example.com. 86400 IN SOA ns1.example.com. hostmaster.example.com. 2021102100 16384 2048 604800 2560`)
      assert.deepStrictEqual(r[0], new RR.SOA({
        owner  : 'example.com.',
        ttl    : 86400,
        class  : 'IN',
        type   : 'SOA',
        mname  : 'ns1.example.com.',
        rname  : 'hostmaster.example.com.',
        serial : 2021102100,
        refresh: 16384,
        retry  : 2048,
        expire : 604800,
        minimum: 2560,
      }))
    })

    it(`parses SOA one liner, unusual continuations`, async () => {
      const r = await bind.parseZoneFile(`example.com. 86400 IN SOA ( ns1.example.com. hostmaster.example.com. 2021102100 16384 2048 604800 2560 )`)
      assert.deepStrictEqual(r[0], new RR.SOA({
        owner  : 'example.com.',
        ttl    : 86400,
        class  : 'IN',
        type   : 'SOA',
        mname  : 'ns1.example.com.',
        rname  : 'hostmaster.example.com.',
        serial : 2021102100,
        refresh: 16384,
        retry  : 2048,
        expire : 604800,
        minimum: 2560,
      }))
    })

    it('parses A line', async () => {
      const r = await bind.parseZoneFile(`cadillac.net.   86400   IN  A   66.128.51.173\n`)
      // console.dir(r, { depth: null })
      assert.deepStrictEqual(r[0], new RR.A({
        owner  : 'cadillac.net.',
        ttl    : 86400,
        class  : 'IN',
        type   : 'A',
        address: '66.128.51.173',
      }))
    })

    const testCAAs = [
      { bind  : 'nocerts.example.com.       CAA 0 issue ";"\n',
        result: {
          owner: 'nocerts.example.com.',
          ttl  : 86400,
          class: 'IN',
          flags: 0,
          tag  : 'issue',
          type : 'CAA',
          value: ';',
        },
      },
      { bind  : 'certs.example.com.       CAA 0 issue "http://example.net"\n',
        result: {
          owner: 'certs.example.com.',
          ttl  : 86400,
          class: 'IN',
          flags: 0,
          tag  : 'issue',
          type : 'CAA',
          value: 'http://example.net',
        },
      },
    ]

    for (const t of testCAAs) {
      it(`parses CAA record: ${t.result.owner}`, async () => {
        bind.zoneOpts.ttl = 86400
        const r = await bind.parseZoneFile(t.bind)
        assert.deepStrictEqual(r[0], new RR.CAA(t.result))
      })
    }

    it('parses CNAME line, absolute', async () => {
      bind.zoneOpts.origin = 'example.com.'
      const r = await bind.parseZoneFile(`www.example.com. 28800 IN  CNAME vhost0.example.com.\n`)
      // console.dir(r, { depth: null })
      assert.deepStrictEqual(r[0], new RR.CNAME({
        owner: 'www.example.com.',
        ttl  : 28800,
        class: 'IN',
        type : 'CNAME',
        cname: 'vhost0.example.com.',
      }))
    })

    it('parses CNAME line, relative', async () => {
      bind.zoneOpts.origin = 'example.com.'
      const r = await bind.parseZoneFile(`www 28800 IN  CNAME vhost0\n`)
      // console.dir(r, { depth: null })
      assert.deepStrictEqual(r[0], new RR.CNAME({
        owner: 'www.example.com.',
        ttl  : 28800,
        class: 'IN',
        type : 'CNAME',
        cname: 'vhost0.example.com.',
      }))
    })

    it('parses DNAME line', async () => {
      const r = await bind.parseZoneFile(`_tcp.theartfarm.com. 86400 IN  DNAME _tcp.theartfarm.com.\n`)
      // console.dir(r, { depth: null })
      assert.deepStrictEqual(r[0], new RR.DNAME({
        owner : '_tcp.theartfarm.com.',
        ttl   : 86400,
        class : 'IN',
        type  : 'DNAME',
        target: '_tcp.theartfarm.com.',
      }))
    })

    it('parses DNSKEY record', async () => {
      const r = await bind.parseZoneFile(
        `example.com. 86400 IN DNSKEY 256 3 5 AQPSKmynfzW4kyBv015MUG2DeIQ3 Cbl+BBZH4b/0PY1kxkmvHjcZc8no kfzj31GajIQKY+5CptLr3buXA10h WqTkF7H6RfoRqXQeogmMHfpftf6z Mv1LyBUgia7za6ZEzOJBOztyvhjL 742iU/TpPSEDhm2SNKLijfUppn1U aNvv4w==\n`)
      // console.dir(r, { depth: null })
      assert.deepStrictEqual(r[0], new RR.DNSKEY({
        owner    : 'example.com.',
        ttl      : 86400,
        class    : 'IN',
        type     : 'DNSKEY',
        flags    : 256,
        protocol : 3,
        algorithm: 5,
        publickey: 'AQPSKmynfzW4kyBv015MUG2DeIQ3 Cbl+BBZH4b/0PY1kxkmvHjcZc8no kfzj31GajIQKY+5CptLr3buXA10h WqTkF7H6RfoRqXQeogmMHfpftf6z Mv1LyBUgia7za6ZEzOJBOztyvhjL 742iU/TpPSEDhm2SNKLijfUppn1U aNvv4w==',
      }))
    })

    it('parses DS record', async () => {
      const r = await bind.parseZoneFile(
        `dskey.example.com. 86400 IN DS 60485 5 1 2BB183AF5F22588179A53B0A 98631FAD1A292118\n`)
      // console.dir(r, { depth: null })
      assert.deepStrictEqual(r[0], new RR.DS({
        owner        : 'dskey.example.com.',
        ttl          : 86400,
        class        : 'IN',
        type         : 'DS',
        'key tag'    : 60485,
        algorithm    : 5,
        'digest type': 1,
        digest       : '2BB183AF5F22588179A53B0A 98631FAD1A292118',
      }))
    })

    it('parses HINFO line', async () => {
      bind.zoneOpts.ttl = 86400
      const r = await bind.parseZoneFile(`SRI-NIC.ARPA. HINFO   DEC-2060 TOPS20\n`)
      // console.dir(r, { depth: null })
      assert.deepStrictEqual(r[0], new RR.HINFO({
        owner: 'SRI-NIC.ARPA.',
        ttl  : 86400,
        type : 'HINFO',
        cpu  : 'DEC-2060',
        os   : 'TOPS20',
      }))
    })

    it('parses LOC line', async () => {
      const r = await bind.parseZoneFile(`rwy04l.logan-airport.boston. 3600 IN LOC 42 21 28.764 N 71 0 51.617 W -44m 2000m\n`)
      // console.dir(r, { depth: null })
      assert.deepStrictEqual(r[0], new RR.LOC({
        owner  : 'rwy04l.logan-airport.boston.',
        ttl    : 3600,
        class  : 'IN',
        type   : 'LOC',
        address: '42 21 28.764 N 71 0 51.617 W -44m 2000m',
      }))
    })

    it('parses MX line', async () => {
      const r = await bind.parseZoneFile(`test.example.com. 3600 IN MX 0  mail.example.com.\n`)
      assert.deepStrictEqual(r[0], new RR.MX({
        class     : 'IN',
        exchange  : 'mail.example.com.',
        owner     : 'test.example.com.',
        preference: 0,
        ttl       : 3600,
        type      : 'MX',
      }))
    })

    it('parses NAPTR line', async () => {
      const r = await bind.parseZoneFile(`cid.urn.arpa.   86400    IN    NAPTR 100    10    ""    ""    "!^urn:cid:.+@([^\\.]+\\.)(.*)$!\x02!i"   .\n`)
      // console.dir(r, { depth: null })
      assert.deepStrictEqual(r[0], new RR.NAPTR({
        owner      : 'cid.urn.arpa.',
        ttl        : 86400,
        class      : 'IN',
        type       : 'NAPTR',
        flags      : '',
        service    : '',
        order      : 100,
        preference : 10,
        regexp     : '!^urn:cid:.+@([^\\.]+\\.)(.*)$!\x02!i',
        replacement: '.',
      }))
    })

    it('parses NS line', async () => {
      bind.zoneOpts.origin = 'cadillac.net.'
      const r = await bind.parseZoneFile(`@   14400   IN  NS  ns1.cadillac.net.  ; this is a comment\n`)
      // console.dir(r, { depth: null })
      assert.deepStrictEqual(r[0], new RR.NS({
        owner: 'cadillac.net.',
        ttl  : 14400,
        class: 'IN',
        type : 'NS',
        dname: 'ns1.cadillac.net.',
      }))
    })

    it('parses NS line', async () => {
      const r = await bind.parseZoneFile(`example.com.  3600  IN  NS  ns1.example.com.\n`)
      assert.deepStrictEqual(r[0], new RR.NS({
        owner: 'example.com.',
        ttl  : 3600,
        class: 'IN',
        type : 'NS',
        dname: 'ns1.example.com.',
      }))
    })

    it('parses PTR line', async () => {
      const r = await bind.parseZoneFile(`2.2.0.192.in-addr.arpa. 86400  IN  PTR dhcp.example.com.\n`)
      assert.deepStrictEqual(r[0], new RR.PTR({
        class: 'IN',
        dname: 'dhcp.example.com.',
        owner: '2.2.0.192.in-addr.arpa.',
        ttl  : 86400,
        type : 'PTR',
      }))
    })

    it('parses SOA line', async () => {
      bind.zoneOpts.origin = 'example.com.'
      bind.zoneOpts.ttl = 86400
      const r = await bind.parseZoneFile(`example.com.  IN  SOA ns1.example.com. matt.example.com. 1 7200 3600 1209600 3600`)
      assert.deepStrictEqual(r[0], new RR.SOA({
        owner  : 'example.com.',
        class  : 'IN',
        type   : 'SOA',
        mname  : 'ns1.example.com.',
        rname  : 'matt.example.com.',
        serial : 1,
        refresh: 7200,
        retry  : 3600,
        expire : 1209600,
        minimum: 3600,
        ttl    : 86400,
      }))
    })

    it('parses TXT line', async () => {
      const r = await bind.parseZoneFile(`oct2021._domainkey.example.com. 86400  IN  TXT "v=DKIM1;p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAoyUzGOTSOmakY8BcxXgi0mN/nFegLBPs7aaGQUtjHfa8yUrt9T2j6GSXgdjLuG3R43WjePQv3RHzc+bwwOkdw0XDOXiztn5mhrlaflbVr5PMSTrv64/cpFQKLtgQx8Vgqp7Dh3jw13rLomRTqJFgMrMHdhIibZEa69gtuAfDqoeXo6QDSGk5JuBAeRHEH27FriHulg5ob" "4F4lmh7fMFVsDGkQEF6jaIVYqvRjDyyQed3R3aTJX3fpb3QrtRqvfn/LAf+3kzW58AjsERpsNCSTD2RquxbnyoR/1wdGKb8cUlD/EXvqtvpVnOzHeSeMEqex3kQI8HOGsEehWZlKd+GqwIDAQAB"\n`)
      assert.deepStrictEqual(r[0], new RR.TXT({
        owner: 'oct2021._domainkey.example.com.',
        ttl  : 86400,
        class: 'IN',
        type : 'TXT',
        data : 'v=DKIM1;p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAoyUzGOTSOmakY8BcxXgi0mN/nFegLBPs7aaGQUtjHfa8yUrt9T2j6GSXgdjLuG3R43WjePQv3RHzc+bwwOkdw0XDOXiztn5mhrlaflbVr5PMSTrv64/cpFQKLtgQx8Vgqp7Dh3jw13rLomRTqJFgMrMHdhIibZEa69gtuAfDqoeXo6QDSGk5JuBAeRHEH27FriHulg5ob4F4lmh7fMFVsDGkQEF6jaIVYqvRjDyyQed3R3aTJX3fpb3QrtRqvfn/LAf+3kzW58AjsERpsNCSTD2RquxbnyoR/1wdGKb8cUlD/EXvqtvpVnOzHeSeMEqex3kQI8HOGsEehWZlKd+GqwIDAQAB',
      }))
    })

    it('parses SMIMEA line', async () => {
      const r = await bind.parseZoneFile(`_443._tcp.www.example.com. 3600 IN SMIMEA 0 0 1 d2abde240d7cd3ee6b4b28c54df034b9 7983a1d16e8a410e4561cb106618e971`)
      assert.deepStrictEqual(r[0], new RR.SMIMEA({
        owner                         : '_443._tcp.www.example.com.',
        ttl                           : 3600,
        class                         : 'IN',
        type                          : 'SMIMEA',
        'certificate association data': 'd2abde240d7cd3ee6b4b28c54df034b9 7983a1d16e8a410e4561cb106618e971',
        'certificate usage'           : 0,
        'matching type'               : 1,
        'selector'                    : 0,
      }))
    })

    it('parses SSHFP line', async () => {
      const r = await bind.parseZoneFile(`mail.example.com.   86400    IN    SSHFP 1  1   ed8c6e16fdae4f633eee6a7b8f64fdd356bbb32841d535565d777014c9ea4c26`)
      assert.deepStrictEqual(r[0], new RR.SSHFP({
        owner      : 'mail.example.com.',
        ttl        : 86400,
        class      : 'IN',
        type       : 'SSHFP',
        algorithm  : 1,
        fingerprint: 'ed8c6e16fdae4f633eee6a7b8f64fdd356bbb32841d535565d777014c9ea4c26',
        fptype     : 1,
      }))
    })

    it('parses SRV line', async () => {
      const r = await bind.parseZoneFile(`_imaps._tcp.example.com.    3600  IN  SRV 1  0   993    mail.example.com.`)
      assert.deepStrictEqual(r[0], new RR.SRV({
        owner   : '_imaps._tcp.example.com.',
        class   : 'IN',
        ttl     : 3600,
        type    : 'SRV',
        port    : 993,
        priority: 1,
        target  : 'mail.example.com.',
        weight  : 0,
      }))
    })

    it('parses TLSA line', async () => {
      const r = await bind.parseZoneFile(`_443._tcp.www.example.com. 3600 IN TLSA 0 0 1 d2abde240d7cd3ee6b4b28c54df034b9 7983a1d16e8a410e4561cb106618e971`)
      assert.deepStrictEqual(r[0], new RR.TLSA({
        owner                         : '_443._tcp.www.example.com.',
        ttl                           : 3600,
        class                         : 'IN',
        type                          : 'TLSA',
        'certificate association data': 'd2abde240d7cd3ee6b4b28c54df034b9 7983a1d16e8a410e4561cb106618e971',
        'certificate usage'           : 0,
        'matching type'               : 1,
        selector                      : 0,
      }))
    })

    it('parses URI line', async () => {
      const r = await bind.parseZoneFile(`www.example.com. 3600 IN URI 1 0 "www2.example.com."`)
      assert.deepStrictEqual(r[0], new RR.URI({
        owner   : 'www.example.com.',
        ttl     : 3600,
        class   : 'IN',
        type    : 'URI',
        priority: 1,
        weight  : 0,
        target  : 'www2.example.com.',
      }))
    })

    it('parses cadillac.net zone file', async () => {
      const file = './test/fixtures/bind/cadillac.net'
      const buf = await fs.readFile(file)
      const r = await bind.parseZoneFile(buf.toString())
      // console.dir(r, { depth: null })
      assert.equal(r.length, 41)
    })

    it('parses isi.edu zone file', async () => {
      bind.zoneOpts.origin = 'isi.edu.'
      const file = './test/fixtures/bind/isi.edu'
      const buf = await fs.readFile(file)
      const rrs = await bind.parseZoneFile(buf.toString())
      // console.dir(rrs, { depth: null })
      assert.equal(rrs.length, 11)
    })

    it('parses example.com zone file', async () => {
      const file = './test/fixtures/bind/example.com'
      const buf = await fs.readFile(file)
      const rrs = await bind.parseZoneFile(buf.toString())
      // console.dir(rrs, { depth: null })
      assert.equal(rrs.length, 17)
    })

    it('parses example.net zone file (with $INCLUDE)', async () => {
      const file = './test/fixtures/bind/example.net'
      const buf = await fs.readFile(file)
      const str = await bind.includeIncludes(buf.toString(), { file: file })
      const rrs = await bind.parseZoneFile(str)
      // console.dir(rrs, { depth: null })
      assert.equal(rrs.length, 7)
    })
  })
})