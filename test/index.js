
const assert = require('assert')
const fs     = require('fs')

const zv = require('../index')

describe('parseZoneFile', function () {

  it('parses a blank line', function (done) {
    const r = zv.parseZoneFile(`\n`)
    // console.dir(r, { depth: null })
    assert.deepStrictEqual(r, [])
    done()
  })

  it('parses two blank lines', function (done) {
    const r = zv.parseZoneFile(`\n\n`)
    // console.dir(r, { depth: null })
    assert.deepStrictEqual(r, [])
    done()
  })

  it('parses a $TTL line', function (done) {
    const r = zv.parseZoneFile(`$TTL 86400\n`)
    // console.dir(r, { depth: null })
    assert.deepStrictEqual(r[0], { ttl: 86400 })
    done()
  })

  it('parses a $TTL line with a comment', function (done) {
    const r = zv.parseZoneFile(`$TTL 86400; yikers\n`)
    // console.dir(r, { depth: null })
    assert.deepStrictEqual(r[0], { ttl: 86400 })
    done()
  })

  it(`parses a SOA`, function (done) {
    const r = zv.parseZoneFile(`example.com.   86400   IN  SOA ns1.example.com.    hostmaster.example.com. (
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
    })
    done()
  })

  it('parses a NS line', function (done) {
    const r = zv.parseZoneFile(`cadillac.net.   14400   IN  NS  ns1.cadillac.net.\n`)
    // console.dir(r, { depth: null })
    assert.deepStrictEqual(r[0], {
      name : 'cadillac.net.',
      ttl  : 14400,
      class: 'IN',
      type : 'NS',
      dname: 'ns1.cadillac.net.',
    })
    done()
  })

  it('parses an A line', function (done) {
    const r = zv.parseZoneFile(`cadillac.net.   86400   IN  A   66.128.51.173\n`)
    // console.dir(r, { depth: null })
    assert.deepStrictEqual(r[0], {
      name   : 'cadillac.net.',
      ttl    : 86400,
      class  : 'IN',
      type   : 'A',
      address: '66.128.51.173',
    })
    done()
  })

  it('parses the cadillac.net zone file', function (done) {
    const file = './test/fixtures/zones/cadillac.net'
    fs.readFile(file, (err, buf) => {
      if (err) throw err

      const r = zv.parseZoneFile(buf.toString())
      // console.dir(r, { depth: null })
      assert.equal(r.length, 41)
    })
    done()
  })

  it('parses the isi.edu zone file', function (done) {
    const file = './test/fixtures/zones/isi.edu'
    fs.readFile(file, (err, buf) => {
      if (err) throw err

      const r = zv.parseZoneFile(buf.toString())
      // console.dir(r, { depth: null })
      assert.equal(r.length, 11)
      done()
    })
  })
})
