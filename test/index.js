
const assert = require('assert')
const fs     = require('fs')

const RR = require('dns-resource-record')
const zf = require('../lib/zonefile')

beforeEach(function () {
  zf.zoneOpts = {}
})

describe('parseZoneFile', function () {

  it('parses blank line', async () => {
    const r = await zf.parseZoneFile(`\n`)
    // console.dir(r[0], { depth: null })
    assert.deepStrictEqual(r, [ '\n' ])
  })

  it('parses two blank lines', async () => {
    const r = await zf.parseZoneFile(`\n\n`)
    // console.dir(r, { depth: null })
    assert.deepStrictEqual(r, [ '\n', '\n' ])
  })

  it('parses line with only whitespace', async () => {
    const r = await zf.parseZoneFile(` \t\n`)
    // console.dir(r, { depth: null })
    assert.deepStrictEqual(r, [ ' \t\n' ])
  })

  it('parses comment line', async () => {
    const r = await zf.parseZoneFile(`; blank comment\n`)
    // console.dir(r, { depth: null })
    assert.deepStrictEqual(r, [ '; blank comment\n' ])
  })

  it('parses comment line with leading ws', async () => {
    const r = await zf.parseZoneFile(` ; blank comment with leading ws\n`)
    // console.dir(r, { depth: null })
    assert.deepStrictEqual(r, [ '; blank comment with leading ws\n' ])
  })

  it('parses $TTL line', async () => {
    const r = await zf.parseZoneFile(`$TTL 86400\n`)
    // console.dir(r, { depth: null })
    assert.deepStrictEqual(r[0], { $TTL: 86400 })
  })

  it('parses $TTL line with a comment', async () => {
    const r = await zf.parseZoneFile(`$TTL 86400; yikers\n`)
    // console.dir(r, { depth: null })
    assert.deepStrictEqual(r[0], { $TTL: 86400, comment: '; yikers' })
  })

  it(`parses SOA`, async () => {
    const r = await zf.parseZoneFile(`example.com.   86400   IN  SOA ns1.example.com.    hostmaster.example.com. (
                    2021102100    ; serial
                    16384   ; refresh
                    2048     ; retry
                    604800    ; expiry
                    2560   ; minimum
                    )\n`)

    // console.dir(r, { depth: null })
    assert.deepStrictEqual(r[0], {
      name   : 'example.com.',
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
      comment: {
        expire : '    ; expiry',
        minimum: '   ; minimum',
        refresh: '   ; refresh',
        retry  : '     ; retry',
        serial : '    ; serial',
      },
    })
  })

  it('parses NS line', async () => {
    const r = await zf.parseZoneFile(`cadillac.net.   14400   IN  NS  ns1.cadillac.net.\n`)
    // console.dir(r, { depth: null })
    assert.deepStrictEqual(r[0], {
      name : 'cadillac.net.',
      ttl  : 14400,
      class: 'IN',
      type : 'NS',
      dname: 'ns1.cadillac.net.',
    })
  })

  it('parses A line', async () => {
    const r = await zf.parseZoneFile(`cadillac.net.   86400   IN  A   66.128.51.173\n`)
    // console.dir(r, { depth: null })
    assert.deepStrictEqual(r[0], {
      name   : 'cadillac.net.',
      ttl    : 86400,
      class  : 'IN',
      type   : 'A',
      address: '66.128.51.173',
    })
  })

  const testCAAs = [
    { bind  : 'nocerts.example.com       CAA 0 issue ";"\n',
      result: {
        flags: 0,
        name : 'nocerts.example.com',
        tag  : 'issue',
        ttl  : null,
        type : 'CAA',
        value: '";"',
      },
    },
    { bind  : 'certs.example.com       CAA 0 issue "example.net"\n',
      result: {
        flags: 0,
        name : 'certs.example.com',
        tag  : 'issue',
        ttl  : null,
        type : 'CAA',
        value: '"example.net"',
      },
    },
  ]

  for (const t of testCAAs) {
    it(`parses CAA record: ${t.result.name}`, async () => {
      const r = await zf.parseZoneFile(t.bind)
      assert.deepStrictEqual(r[0], t.result)
    })
  }

  it('parses CNAME line, absolute', async () => {
    const r = await zf.parseZoneFile(`www 28800 IN  CNAME vhost0.theartfarm.com.\n`)
    // console.dir(r, { depth: null })
    assert.deepStrictEqual(r[0], {
      name : 'www',
      ttl  : 28800,
      class: 'IN',
      type : 'CNAME',
      cname: 'vhost0.theartfarm.com.',
    })
  })

  it('parses CNAME line, relative', async () => {
    zf.zoneOpts = { origin: 'theartfarm.com' }
    const r = await zf.parseZoneFile(`www 28800 IN  CNAME vhost0\n`).then(zf.expandShortcuts)
    // console.dir(r, { depth: null })
    assert.deepStrictEqual(r[0], new RR.CNAME({
      name : 'www.theartfarm.com.',
      ttl  : 28800,
      class: 'IN',
      type : 'CNAME',
      cname: 'vhost0.theartfarm.com.',
    }))
  })

  it('parses DNAME line', async () => {
    const r = await zf.parseZoneFile(`_tcp 86400 IN  DNAME _tcp.theartfarm.com.\n`)
    // console.dir(r, { depth: null })
    assert.deepStrictEqual(r[0], {
      name  : '_tcp',
      ttl   : 86400,
      class : 'IN',
      type  : 'DNAME',
      target: '_tcp.theartfarm.com.',
    })
  })

  it('parses DNSKEY record', async () => {
    const r = await zf.parseZoneFile(
      `example.com. 86400 IN DNSKEY 256 3 5 ( AQPSKmynfzW4kyBv015MUG2DeIQ3
                                          Cbl+BBZH4b/0PY1kxkmvHjcZc8no
                                          kfzj31GajIQKY+5CptLr3buXA10h
                                          WqTkF7H6RfoRqXQeogmMHfpftf6z
                                          Mv1LyBUgia7za6ZEzOJBOztyvhjL
                                          742iU/TpPSEDhm2SNKLijfUppn1U
                                          aNvv4w==  )\n`)
    // console.dir(r, { depth: null })
    assert.deepStrictEqual(r[0], {
      name     : 'example.com.',
      ttl      : 86400,
      class    : 'IN',
      type     : 'DNSKEY',
      flags    : 256,
      protocol : 3,
      algorithm: 5,
      publickey: 'AQPSKmynfzW4kyBv015MUG2DeIQ3Cbl+BBZH4b/0PY1kxkmvHjcZc8nokfzj31GajIQKY+5CptLr3buXA10hWqTkF7H6RfoRqXQeogmMHfpftf6zMv1LyBUgia7za6ZEzOJBOztyvhjL742iU/TpPSEDhm2SNKLijfUppn1UaNvv4w==',
    })
  })

  it('parses DS record', async () => {
    const r = await zf.parseZoneFile(
      `dskey.example.com. 86400 IN DS 60485 5 1 ( 2BB183AF5F22588179A53B0A
                                              98631FAD1A292118 )\n`)
    // console.dir(r, { depth: null })
    assert.deepStrictEqual(r[0], {
      name         : 'dskey.example.com.',
      ttl          : 86400,
      class        : 'IN',
      type         : 'DS',
      'key tag'    : 60485,
      algorithm    : 5,
      'digest type': 1,
      digest       : '2BB183AF5F22588179A53B0A98631FAD1A292118',
    })
  })

  it('parses HINFO line', async () => {
    const r = await zf.parseZoneFile(`SRI-NIC.ARPA. HINFO   DEC-2060 TOPS20\n`)
    // console.dir(r, { depth: null })
    assert.deepStrictEqual(r[0], {
      name: 'SRI-NIC.ARPA.',
      ttl : null,
      type: 'HINFO',
      cpu : 'DEC-2060',
      os  : 'TOPS20',
    })
  })

  it('parses LOC line', async () => {
    const r = await zf.parseZoneFile(`rwy04l.logan-airport.boston. 3600 IN LOC 42 21 28.764 N 71 0 51.617 W -44m 2000m\n`)
    // console.dir(r, { depth: null })
    assert.deepStrictEqual(r[0], {
      name    : 'rwy04l.logan-airport.boston.',
      ttl     : 3600,
      class   : 'IN',
      type    : 'LOC',
      latitude: {
        degrees   : 42,
        hemisphere: 'N',
        minutes   : 21,
        seconds   : 28.764,
      },
      longitude: {
        degrees   : 71,
        hemisphere: 'W',
        minutes   : 0,
        seconds   : 51.617,
      },
      altitude : '-44m',
      size     : '2000m',
      precision: {
        horizontal: '10000m',
        vertical  : '10m',
      },
    })
  })

  it('parses MX line', async () => {
    const r = await zf.parseZoneFile(`test.example.com. 3600 IN MX 0  mail.example.com.\n`)
    assert.deepStrictEqual(r[0], {
      class     : 'IN',
      exchange  : 'mail.example.com.',
      name      : 'test.example.com.',
      preference: 0,
      ttl       : 3600,
      type      : 'MX',
    })
  })

  // cid.urn.arpa.   86400    IN    NAPTR 100    10    ""    ""    "!^urn:cid:.+@([^\\.]+\\.)(.*)$!\x02!i"   .

  it('parses NS line', async () => {
    const r = await zf.parseZoneFile(`example.com.  3600  IN  NS  ns1.example.com.\n`)
    assert.deepStrictEqual(r[0], {
      class: 'IN',
      dname: 'ns1.example.com.',
      name : 'example.com.',
      ttl  : 3600,
      type : 'NS',
    })
  })

  it('parses PTR line', async () => {
    const r = await zf.parseZoneFile(`2.2.0.192.in-addr.arpa. 86400  IN  PTR dhcp.example.com.\n`)
    assert.deepStrictEqual(r[0], {
      class: 'IN',
      dname: 'dhcp.example.com.',
      name : '2.2.0.192.in-addr.arpa.',
      ttl  : 86400,
      type : 'PTR',
    })
  })

  it('parses SOA line', async () => {
    zf.zoneOpts = { origin: 'example.com', ttl: 3600 }
    const r = await zf.parseZoneFile(`example.com.  IN  SOA ns1.example.com. matt.example.com. (
    1
    7200
    3600
    1209600
    3600
    )\n`)
    assert.deepStrictEqual(r[0], {
      name   : 'example.com.',
      ttl    : null,
      type   : 'SOA',
      mname  : 'ns1.example.com.',
      rname  : 'matt.example.com.',
      serial : 1,
      refresh: 7200,
      retry  : 3600,
      expire : 1209600,
      minimum: 3600,
      comment: {
        expire : '',
        minimum: '',
        refresh: '',
        retry  : '',
        serial : '',
      },
    })
  })

  it('parses TXT line', async () => {
    const r = await zf.parseZoneFile(`oct2021._domainkey.example.com. 86400  IN  TXT "v=DKIM1;p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAoyUzGOTSOmakY8BcxXgi0mN/nFegLBPs7aaGQUtjHfa8yUrt9T2j6GSXgdjLuG3R43WjePQv3RHzc+bwwOkdw0XDOXiztn5mhrlaflbVr5PMSTrv64/cpFQKLtgQx8Vgqp7Dh3jw13rLomRTqJFgMrMHdhIibZEa69gtuAfDqoeXo6QDSGk5JuBAeRHEH27FriHulg5ob" "4F4lmh7fMFVsDGkQEF6jaIVYqvRjDyyQed3R3aTJX3fpb3QrtRqvfn/LAf+3kzW58AjsERpsNCSTD2RquxbnyoR/1wdGKb8cUlD/EXvqtvpVnOzHeSeMEqex3kQI8HOGsEehWZlKd+GqwIDAQAB"\n`)
    assert.deepStrictEqual(r[0], {
      name : 'oct2021._domainkey.example.com.',
      ttl  : 86400,
      class: 'IN',
      type : 'TXT',
      data : [
        'v=DKIM1;p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAoyUzGOTSOmakY8BcxXgi0mN/nFegLBPs7aaGQUtjHfa8yUrt9T2j6GSXgdjLuG3R43WjePQv3RHzc+bwwOkdw0XDOXiztn5mhrlaflbVr5PMSTrv64/cpFQKLtgQx8Vgqp7Dh3jw13rLomRTqJFgMrMHdhIibZEa69gtuAfDqoeXo6QDSGk5JuBAeRHEH27FriHulg5ob',
        '4F4lmh7fMFVsDGkQEF6jaIVYqvRjDyyQed3R3aTJX3fpb3QrtRqvfn/LAf+3kzW58AjsERpsNCSTD2RquxbnyoR/1wdGKb8cUlD/EXvqtvpVnOzHeSeMEqex3kQI8HOGsEehWZlKd+GqwIDAQAB',
      ],
    })
  })

  it('parses SMIMEA line', async () => {
    const r = await zf.parseZoneFile(`_443._tcp.www.example.com.  3600    IN    SMIMEA    0 0  1   ( d2abde240d7cd3ee6b4b28c54df034b9 7983a1d16e8a410e4561cb106618e971 )`)
    assert.deepStrictEqual(r[0], {
      name : '_443._tcp.www.example.com.',
      ttl  : 3600,
      class: 'IN',
      type : 'SMIMEA',
      'certificate association data': 'd2abde240d7cd3ee6b4b28c54df034b97983a1d16e8a410e4561cb106618e971',
      'certificate usage': 0,
      'matching type': 1,
      'selector': 0,
    })
  })

  it('parses SSHFP line', async () => {
    const r = await zf.parseZoneFile(`mail.example.com.   86400    IN    SSHFP 1  1   ed8c6e16fdae4f633eee6a7b8f64fdd356bbb32841d535565d777014c9ea4c26`)
    assert.deepStrictEqual(r[0], {
      name : 'mail.example.com.',
      ttl  : 86400,
      class: 'IN',
      type : 'SSHFP',
      algorithm: 1,
      fingerprint: 'ed8c6e16fdae4f633eee6a7b8f64fdd356bbb32841d535565d777014c9ea4c26',
      fptype: 1,
    })
  })

  it('parses SRV line', async () => {
    const r = await zf.parseZoneFile(`_imaps._tcp.example.com.    3600  IN  SRV 1  0   993    mail.example.com.`)
    assert.deepStrictEqual(r[0], {
      name : '_imaps._tcp.example.com.',
      class: 'IN',
      ttl  : 3600,
      type : 'SRV',
      port : 0,
      priority: 1,
      target: 'mail.example.com.',
      weight: 993,
    })
  })

  it('parses TLSA line', async () => {
    const r = await zf.parseZoneFile(`_443._tcp.www.example.com. 3600 IN TLSA 0 0 1 ( d2abde240d7cd3ee6b4b28c54df034b9 7983a1d16e8a410e4561cb106618e971 )`)
    assert.deepStrictEqual(r[0], {
      name: '_443._tcp.www.example.com.',
      ttl: 3600,
      class: 'IN',
      type: 'TLSA',
      'certificate association data': 'd2abde240d7cd3ee6b4b28c54df034b97983a1d16e8a410e4561cb106618e971',
      'certificate usage': 0,
      'matching type': 1,
      selector: 0,
    })
  })

  it('parses URI line', async () => {
    const r = await zf.parseZoneFile(`www.example.com. 3600 IN URI 1 0 "www2.example.com."`)
    assert.deepStrictEqual(r[0], {
      name: 'www.example.com.',
      ttl: 3600,
      class: 'IN',
      type: 'URI',
      priority: 1,
      weight: 0,
      target: 'www2.example.com.',
    })
  })

  it('parses cadillac.net zone file', async () => {
    const file = './test/fixtures/zones/cadillac.net'
    fs.readFile(file, (err, buf) => {
      if (err) throw err

      zf.parseZoneFile(buf.toString()).then(r => {
        // console.dir(r, { depth: null })
        assert.equal(r.length, 41)
      })
    })
  })

  it('parses isi.edu zone file', async () => {
    const file = './test/fixtures/zones/isi.edu'
    fs.readFile(file, (err, buf) => {
      if (err) throw err

      zf.parseZoneFile(buf.toString()).then(zf.expandShortcuts).then(r => {
        // console.dir(r, { depth: null })
        assert.equal(r.length, 11)
      })
    })
  })

  it('parses example.com zone file', async () => {
    const file = './test/fixtures/zones/example.com'
    fs.readFile(file, (err, buf) => {
      if (err) throw err

      zf.parseZoneFile(buf.toString())
        .then(zf.expandShortcuts)
        .then(r => {
          // console.dir(r, { depth: null })
          assert.equal(r.length, 15)
        })
        .catch(e => {
          console.error(e)
        })
    })
  })
})

describe('expandShortcuts', function () {
  const testCase = [
    { $TTL: 3600 },
    { $ORIGIN: 'test.example.com.' },
    { name: '@', type: 'A', address: '1.2.3.4' },
  ]

  it('expands @ name to $ORIGIN', async () => {
    const input = JSON.parse(JSON.stringify(testCase))
    input[2].name = '@'
    const out = await zf.expandShortcuts(input)
    assert.deepEqual(out, [ new RR.A({
      address: '1.2.3.4',
      class  : 'IN',
      name   : 'test.example.com.',
      ttl    : 3600,
      type   : 'A',
    }) ])
  })

  it('expands empty name to $ORIGIN', async () => {
    const input = JSON.parse(JSON.stringify(testCase))
    input[2].name = ''

    const out = await zf.expandShortcuts(input)
    assert.deepEqual(out, [ new RR.A({
      address: '1.2.3.4',
      class  : 'IN',
      name   : 'test.example.com.',
      ttl    : 3600,
      type   : 'A',
    }) ])
  })

  it('expands empty name to previous', async () => {
    const input = JSON.parse(JSON.stringify(testCase))
    input[2] = {
      address: '1.2.3.4',
      class  : 'IN',
      name   : 'previous.example.com.',
      ttl    : 3600,
      type   : 'A',
    }
    input[3] = {
      address: '1.2.3.4',
      class  : 'IN',
      name   : '',
      ttl    : 3600,
      type   : 'A',
    }

    const out = await zf.expandShortcuts(input)
    assert.deepEqual(out[1], new RR.A({
      address: '1.2.3.4',
      class  : 'IN',
      name   : 'previous.example.com.',
      ttl    : 3600,
      type   : 'A',
    }))
  })

  it('expands TTL to zone minimum', async () => {
    let input = JSON.parse(JSON.stringify(testCase))
    input = input.filter(e => !e.$TTL)

    const r = await zf.parseZoneFile(`@ 55 IN  SOA ns1.cadillac.net. hostmaster.cadillac.net. (2021102100 16384 2048 604800 2560)\n`)
    const out = await zf.expandShortcuts([ input[0], r[0], input[1] ])
    assert.deepEqual(out[1], new RR.A({
      address: '1.2.3.4',
      class  : 'IN',
      name   : 'test.example.com.',
      ttl    : 2560,
      type   : 'A',
    }))
  })
})