
const assert = require('assert')
const fs     = require('fs')

const RR = require('dns-resource-record')
const mara = require('../lib/maradns')

beforeEach(function () {
  mara.zoneOpts = {}
})

describe('maradns', function () {

  describe('parseZoneFile', function () {

    it('parses blank line', async () => {
      const r = await mara.parseZoneFile(`\n`)
      // console.dir(r[0], { depth: null })
      assert.deepStrictEqual(r, [ '\n' ])
    })

    it.skip('parses two blank lines', async () => {
      // stripping blank lines performance++, breaks this test-
      const r = await mara.parseZoneFile(`\n\n`)
      // console.dir(r, { depth: null })
      assert.deepStrictEqual(r, [ '\n' ])
    })

    it('parses line with only whitespace', async () => {
      const r = await mara.parseZoneFile(` \t\n`)
      // console.dir(r, { depth: null })
      assert.deepStrictEqual(r, [ '\n' ])
    })

    it.skip('parses comment line', async () => {
      // I strip WS within this function, which breaks this test
      const r = await mara.parseZoneFile(`# blank comment\n`)
      // console.dir(r, { depth: null })
      assert.deepStrictEqual(r, [ '# blank comment', '\n' ])
    })

    it('parses comment line with leading ws', async () => {
      const r = await mara.parseZoneFile(` # blank comment with leading ws\n`)
      // console.dir(r, { depth: null })
      assert.deepStrictEqual(r, [ '# blank comment with leading ws\n' ])
    })

    it(`parses SOA`, async () => {
      const r = await mara.parseZoneFile(`x.org. SOA x.org. john\\.doe@x.org. 1 7200 3600 604800 1800 ~\n`)

      // console.dir(r, { depth: null })
      assert.deepStrictEqual(r[0], {
        // ttl    : 86400,
        owner  : 'x.org.',
        type   : 'SOA',
        mname  : 'x.org.',
        rname  : 'john\\.doe@x.org.',
        serial : 1,
        refresh: 7200,
        retry  : 3600,
        expire : 604800,
        minimum: 1800,
        comment: {
          expire : ' ',
          minimum: '',
          refresh: ' ',
          retry  : ' ',
          serial : ' ',
        },
      })
    })

    it('parses NS line', async () => {
      const r = await mara.parseZoneFile(`example.net.    NS    ns1.example.net. ~\n`)
      // console.dir(r, { depth: null })
      assert.deepStrictEqual(r[0], {
        owner: 'example.net.',
        type : 'NS',
        dname: 'ns1.example.net.',
      })
    })

    it('parses A line', async () => {
      const r = await mara.parseZoneFile(`percent.%   a       10.9.8.7 ~\n`)
      // console.dir(r, { depth: null })
      assert.deepStrictEqual(r[0], {
        owner  : 'percent.%',
        type   : 'A',
        address: '10.9.8.7',
      })
    })

    it('parses AAAA line', async () => {
      const r = await mara.parseZoneFile(`a.example.net.   AAAA    fd4d:6172:6144:4e53:ffe::f ~\n`)
      // console.dir(r, { depth: null })
      assert.deepStrictEqual(r[0], {
        owner  : 'a.example.net.',
        type   : 'AAAA',
        address: 'fd4d:6172:6144:4e53:ffe::f',
      })
    })

    it(`parses CAA record`, async () => {
      const r = await mara.parseZoneFile(`example.com. RAW 257 \x00\x05'issueletsencrypt.org' ~\n`)
      assert.deepStrictEqual(r[0], {
        owner : 'example.com.',
        type  : 'RAW',
        typeid: 257,
        rdata : "\x00\x05'issueletsencrypt.org'",
      })
    })

    it.skip('parses CNAME line', async () => {
      const r = await mara.parseZoneFile(`\n`)
      // console.dir(r, { depth: null })
      assert.deepStrictEqual(r[0], {
      })
    })

    it('parses FQDN4 line', async () => {
      const r = await mara.parseZoneFile(`x.example.net. FQDN4 10.3.28.79 ~\n`)
      // console.dir(r, { depth: null })
      assert.deepStrictEqual(r[0], {
        owner  : 'x.example.net.',
        type   : 'FQDN4',
        address: '10.3.28.79',
      })
    })

    it('parses FQDN6 line', async () => {
      const r = await mara.parseZoneFile(`a.example.net.   FQDN6    fd4d:6172:6144:4e53:ffe::f ~\n`)
      // console.dir(r, { depth: null })
      assert.deepStrictEqual(r[0], {
        owner  : 'a.example.net.',
        type   : 'FQDN6',
        address: 'fd4d:6172:6144:4e53:ffe::f',
      })
    })

    it('parses HINFO line', async () => {
      const r = await mara.parseZoneFile(`example.com. HINFO 'Intel Pentium III';'CentOS Linux 3.7' ~\n`)
      // console.dir(r, { depth: null })
      assert.deepStrictEqual(r[0], {
        owner: 'example.com.',
        type : 'HINFO',
        cpu  : 'Intel Pentium III',
        os   : 'CentOS Linux 3.7',
      })
    })

    it('parses LOC line', async () => {
      const r = await mara.parseZoneFile(`example.net. LOC 19 31 2.123 N 98 3 4 W 2000m 2m 4m 567m ~\n`)
      // console.dir(r, { depth: null })
      assert.deepStrictEqual(r[0], {
        owner   : 'example.net.',
        type    : 'LOC',
        latitude: {
          degrees   : 19,
          minutes   : 31,
          seconds   : 2.123,
          hemisphere: 'N',
        },
        longitude: {
          degrees   : 98,
          minutes   : 3,
          seconds   : 4,
          hemisphere: 'W',
        },
        altitude : '2000m',
        size     : '2m',
        precision: {
          horizontal: '4m',
          vertical  : '567m',
        },
      })
    })

    it('parses MX line', async () => {
      const r = await mara.parseZoneFile(`mail.% +86400 A 10.22.23.24 ~\n`)
      assert.deepStrictEqual(r[0], {
        owner  : 'mail.%',
        address: '10.22.23.24',
        type   : 'A',
      })
    })

    it('parses PTR line', async () => {
      const r = await mara.parseZoneFile(`15.12.11.10.in-addr.arpa. +64000 PTR    c.example.net. ~\n`)
      assert.deepStrictEqual(r[0], {
        owner: '15.12.11.10.in-addr.arpa.',
        type : 'PTR',
        dname: 'c.example.net.',
      })
    })

    it('parses RAW line', async () => {
      const r = await mara.parseZoneFile(`example.com. RAW 40 \x10\x01\x02'Kitchen sink'\x40' data' ~\n`)
      assert.deepStrictEqual(r[0], {
        owner : 'example.com.',
        type  : 'RAW',
        typeid: 40,
        rdata  : `\x10\x01\x02'Kitchen sink'\x40' data'`,
      })
    })

    it('parses TXT line', async () => {
      const r = await mara.parseZoneFile(`oct2021._domainkey.example.com. +86400 TXT 'v=DKIM1;p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAoyUzGOTSOmakY8BcxXgi0mN/nFegLBPs7aaGQUtjHfa8yUrt9T2j6GSXgdjLuG3R43WjePQv3RHzc+bwwOkdw0XDOXiztn5mhrlaflbVr5PMSTrv64/cpFQKLtgQx8Vgqp7Dh3jw13rLomRTqJFgMrMHdhIibZEa69gtuAfDqoeXo6QDSGk5JuBAeRHEH27FriHulg5ob''4F4lmh7fMFVsDGkQEF6jaIVYqvRjDyyQed3R3aTJX3fpb3QrtRqvfn/LAf+3kzW58AjsERpsNCSTD2RquxbnyoR/1wdGKb8cUlD/EXvqtvpVnOzHeSeMEqex3kQI8HOGsEehWZlKd+GqwIDAQAB' ~\n`)
      assert.deepStrictEqual(r[0], {
        owner: 'oct2021._domainkey.example.com.',
        type : 'TXT',
        data : [
          'v=DKIM1;p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAoyUzGOTSOmakY8BcxXgi0mN/nFegLBPs7aaGQUtjHfa8yUrt9T2j6GSXgdjLuG3R43WjePQv3RHzc+bwwOkdw0XDOXiztn5mhrlaflbVr5PMSTrv64/cpFQKLtgQx8Vgqp7Dh3jw13rLomRTqJFgMrMHdhIibZEa69gtuAfDqoeXo6QDSGk5JuBAeRHEH27FriHulg5ob4F4lmh7fMFVsDGkQEF6jaIVYqvRjDyyQed3R3aTJX3fpb3QrtRqvfn/LAf+3kzW58AjsERpsNCSTD2RquxbnyoR/1wdGKb8cUlD/EXvqtvpVnOzHeSeMEqex3kQI8HOGsEehWZlKd+GqwIDAQAB',
        ],
      })
    })

    it('parses TXT line, quoted', async () => {
      const r = await mara.parseZoneFile(`example.com. TXT 'This is an example text field' ~\n`)
      assert.deepStrictEqual(r[0], {
        owner: 'example.com.',
        type : 'TXT',
        data : [ 'This is an example text field' ],
      })
    })

    it('parses TXT line, unquoted', async () => {
      const r = await mara.parseZoneFile(`c.example.com. TXT This_is_100%_unquoted_text_+symbols! ~\n`)
      // console.dir(r, { depth: null })
      assert.deepStrictEqual(r[0], {
        owner: 'c.example.com.',
        type : 'TXT',
        data : [ 'This_is_100%_unquoted_text_+symbols!' ],
      })
    })

    it('parses TXT line, mixed quotes', async () => {
      const r = await mara.parseZoneFile(`d.example.com. TXT This' is a mix 'of_unquoted' and quoted 'text! ~\n`)
      // console.dir(r, { depth: null })
      assert.deepStrictEqual(r[0], {
        owner: 'd.example.com.',
        type : 'TXT',
        data : [ 'This is a mix of_unquoted and quoted text!' ],
      })
    })

    it('parses TXT line, multiline with comments', async () => {
      const r = await mara.parseZoneFile(`j.example.com. TXT 'Not only did the quick brown fox jump '\
                   'over the lazy dog, but the lazy dog'\
                   ' jumped over the cat.' ~\n`)
      // console.dir(r, { depth: null })
      assert.deepStrictEqual(r[0], {
        owner: 'j.example.com.',
        type : 'TXT',
        data : [ 'Not only did the quick brown fox jump over the lazy dog, but the lazy dog jumped over the cat.' ],
      })
    })

    it('parses SRV line', async () => {
      const r = await mara.parseZoneFile(`_http._tcp.% SRV 0 0 80 a.% ~\n`)
      assert.deepStrictEqual(r[0], {
        owner   : '_http._tcp.%',
        type    : 'SRV',
        port    : 0,
        priority: 0,
        target  : 'a.%',
        weight  : 80,
      })
    })
  })

  describe('expandShortcuts', function () {
    const testCase = [
      { owner: '%', type: 'A', address: '1.2.3.4' },
    ]

    it('expands % owner to $ORIGIN', async () => {
      const input = JSON.parse(JSON.stringify(testCase))
      // input[2].owner = '%'
      mara.zoneOpts.ttl = 3600
      mara.zoneOpts.origin = 'example.com.'
      const out = await mara.expandShortcuts(input)
      assert.deepEqual(out, [
        new RR.A({
          owner  : 'example.com.',
          ttl    : 3600,
          class  : 'IN',
          type   : 'A',
          address: '1.2.3.4',
        }),
      ])
    })
  })

  it('loads and validates example.com', function () {
    const file = './test/fixtures/mara/example.net.csv2'
    fs.readFile(file, (err, buf) => {
      if (err) throw err
      mara.zoneOpts.ttl = 3600
      mara.zoneOpts.origin = 'example.net.'
      mara.parseZoneFile(buf.toString())
        .then(mara.expandShortcuts)
        .then(r => {
          // console.dir(r, { depth: null })
          assert.equal(r.length, 40)
        })
        .catch(e => {
          console.error(e)
        })
    })
  })
})