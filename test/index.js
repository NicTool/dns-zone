
const assert = require('assert')
const fs     = require('fs')

const RR = require('dns-resource-record')
const zv = require('../index')

describe('parseZoneFile', function () {

  it('parses a blank line', async () => {
    const r = await zv.parseZoneFile(`\n`)
    // console.dir(r, { depth: null })
    assert.deepStrictEqual(r, [])
  })

  it('parses two blank lines', async () => {
    const r = await zv.parseZoneFile(`\n\n`)
    // console.dir(r, { depth: null })
    assert.deepStrictEqual(r, [])
  })

  it('parses a $TTL line', async () => {
    const r = await zv.parseZoneFile(`$TTL 86400\n`)
    // console.dir(r, { depth: null })
    assert.deepStrictEqual(r[0], { $TTL: 86400 })
  })

  it('parses a $TTL line with a comment', async () => {
    const r = await zv.parseZoneFile(`$TTL 86400; yikers\n`)
    // console.dir(r, { depth: null })
    assert.deepStrictEqual(r[0], { $TTL: 86400 })
  })

  it(`parses a SOA`, async () => {
    const r = await zv.parseZoneFile(`example.com.   86400   IN  SOA ns1.example.com.    hostmaster.example.com. (
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

  it('parses a NS line', async () => {
    const r = await zv.parseZoneFile(`cadillac.net.   14400   IN  NS  ns1.cadillac.net.\n`)
    // console.dir(r, { depth: null })
    assert.deepStrictEqual(r[0], {
      name : 'cadillac.net.',
      ttl  : 14400,
      class: 'IN',
      type : 'NS',
      dname: 'ns1.cadillac.net.',
    })
  })

  it('parses an A line', async () => {
    const r = await zv.parseZoneFile(`cadillac.net.   86400   IN  A   66.128.51.173\n`)
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
        class: null,
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
        class: null,
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
      const r = await zv.parseZoneFile(t.bind)
      assert.deepStrictEqual(r[0], t.result)
    })
  }

  it('parses a CNAME line, absolute', async () => {
    const r = await zv.parseZoneFile(`www 28800 IN  CNAME vhost0.theartfarm.com.\n`)
    // console.dir(r, { depth: null })
    assert.deepStrictEqual(r[0], {
      name : 'www',
      ttl  : 28800,
      class: 'IN',
      type : 'CNAME',
      cname: 'vhost0.theartfarm.com.',
    })
  })

  it('parses a CNAME line, relative', async () => {
    const r = await zv.parseZoneFile(`$ORIGIN theartfarm.com.\nwww 28800 IN  CNAME vhost0\n`).then(zv.expandShortcuts)
    // console.dir(r, { depth: null })
    assert.deepStrictEqual(r[0], new RR.CNAME({
      name : 'www.theartfarm.com.',
      ttl  : 28800,
      class: 'IN',
      type : 'CNAME',
      cname: 'vhost0.theartfarm.com.',
    }))
  })

  it('parses a DNAME line', async () => {
    const r = await zv.parseZoneFile(`_tcp 86400 IN  DNAME _tcp.theartfarm.com.\n`)
    // console.dir(r, { depth: null })
    assert.deepStrictEqual(r[0], {
      name  : '_tcp',
      ttl   : 86400,
      class : 'IN',
      type  : 'DNAME',
      target: '_tcp.theartfarm.com.',
    })
  })

  it('parses a DNSKEY record', async () => {
    const r = await zv.parseZoneFile(
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

  it('parses a DS record', async () => {
    const r = await zv.parseZoneFile(
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

  it('parses a HINFO line', async () => {
    const r = await zv.parseZoneFile(`SRI-NIC.ARPA. HINFO   DEC-2060 TOPS20\n`)
    // console.dir(r, { depth: null })
    assert.deepStrictEqual(r[0], {
      name : 'SRI-NIC.ARPA.',
      ttl  : null,
      class: null,
      type : 'HINFO',
      cpu  : 'DEC-2060',
      os   : 'TOPS20',
    })
  })

  it('parses a LOC line', async () => {
    const r = await zv.parseZoneFile(`rwy04l.logan-airport.boston. 3600 IN LOC 42 21 28.764 N 71 0 51.617 W -44m 2000m\n`)
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

  it('parses the cadillac.net zone file', async () => {
    const file = './test/fixtures/zones/cadillac.net'
    fs.readFile(file, (err, buf) => {
      if (err) throw err

      zv.parseZoneFile(buf.toString()).then(r => {
        // console.dir(r, { depth: null })
        assert.equal(r.length, 41)
      })
    })
  })

  it('parses the isi.edu zone file', async () => {
    const file = './test/fixtures/zones/isi.edu'
    fs.readFile(file, (err, buf) => {
      if (err) throw err

      zv.parseZoneFile(buf.toString()).then(zv.expandShortcuts).then(r => {
        // console.dir(r, { depth: null })
        assert.equal(r.length, 11)
      })
    })
  })

  it('parses the example.com zone file', async () => {
    const file = './test/fixtures/zones/example.com'
    fs.readFile(file, (err, buf) => {
      if (err) throw err

      zv.parseZoneFile(buf.toString()).then(zv.expandShortcuts).then(r => {
        // console.dir(r, { depth: null })
        assert.equal(r.length, 14)
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
    const out = await zv.expandShortcuts(input)
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

    const out = await zv.expandShortcuts(input)
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

    const out = await zv.expandShortcuts(input)
    assert.deepEqual(out[1], new RR.A({
      address: '1.2.3.4',
      class  : 'IN',
      name   : 'previous.example.com.',
      ttl    : 3600,
      type   : 'A',
    }))
  })

  it('expands TTL to zone minimum', async () => {
    const input = JSON.parse(JSON.stringify(testCase))
    input[0] = input[1]
    const r = await zv.parseZoneFile(`@ 55 IN  SOA ns1.cadillac.net. hostmaster.cadillac.net. (2021102100 16384 2048 604800 2560)\n`)
    input[1] = r[0]

    const out = await zv.expandShortcuts(input)
    assert.deepEqual(out[1], new RR.A({
      address: '1.2.3.4',
      class  : 'IN',
      name   : 'test.example.com.',
      ttl    : 2560,
      type   : 'A',
    }))
  })
})