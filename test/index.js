
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

  it('parses a CNAME line', async () => {
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