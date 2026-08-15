import assert from 'assert'
import fs from 'node:fs/promises'
import os from 'os'
import path from 'node:path'
import { describe, it } from 'node:test'

import * as dz from '../index.js'

describe('dns-zone', function () {
  describe('public exports', function () {
    // These are the package's API surface; losing one is a breaking change.
    for (const name of ['bind', 'json', 'maradns', 'tinydns', 'zoneExport']) {
      it(`exports ${name}`, function () {
        assert.strictEqual(typeof dz[name], 'object')
      })
    }

    for (const name of ['toBind', 'toTinydns', 'toMaraDNS', 'toJSON']) {
      it(`exports ${name}`, function () {
        assert.strictEqual(typeof dz[name], 'function')
        assert.strictEqual(typeof dz.zoneExport[name], 'function')
      })
    }

    it('exposes zoneExport as a plain object, like the parser modules', function () {
      assert.ok(!Object.keys(dz.zoneExport).includes('default'))
    })

    it('exports ZONE, so validation needs no lib/ deep import', function () {
      assert.strictEqual(typeof dz.ZONE, 'function')
    })

    it('exports validateZone', function () {
      assert.strictEqual(typeof dz.validateZone, 'function')
    })
  })

  describe('validateZone', function () {
    const soa = `@	IN	SOA	ns1.example.com. hostmaster.example.com. 1 7200 3600 1209600 3600
@	IN	NS	ns1.example.com.`

    it('returns the parsed records and no errors for a valid zone', async function () {
      const { RR, errors } = await dz.validateZone(`$ORIGIN example.com.\n$TTL 3600\n${soa}\n`)
      assert.deepEqual(errors, [])
      assert.ok(RR.length > 0)
    })

    it('reports a CNAME sharing an owner with another type', async function () {
      const zone = `$ORIGIN example.com.
$TTL 3600
${soa}
@	IN	CNAME	other.example.net.
@	IN	TXT	"v=spf1 -all"
`
      const { errors } = await dz.validateZone(zone)
      assert.equal(errors.length, 1)
      assert.match(errors[0].error.message, /CNAME not allowed/)
    })

    it('parses the format named in opts', async function () {
      const { RR, errors } = await dz.validateZone(
        await fs.readFile(path.join('test', 'fixtures', 'tinydns', 'data'), 'utf8'),
        { format: 'tinydns' },
      )
      assert.deepEqual(errors, [])
      assert.ok(RR.length > 0)
    })

    it('ignores blank lines and comments the parser was asked to keep', async function () {
      const zone = `$ORIGIN example.com.\n$TTL 3600\n; a comment\n\n${soa}\n`
      const { RR, errors } = await dz.validateZone(zone, { showBlank: true, showComment: true })
      assert.deepEqual(errors, [])
      assert.ok(RR.some((r) => typeof r === 'string' && r.includes('a comment')))
    })

    it('accepts $TTL 0, RFC 2308', async function () {
      const { errors } = await dz.validateZone(`$ORIGIN example.com.\n$TTL 0\n${soa}\n`)
      assert.deepEqual(errors, [])
    })

    it('throws on an unknown format', async function () {
      await assert.rejects(dz.validateZone('', { format: 'nope' }), /unknown zone format/)
    })
  })

  describe('hasUnquoted', function () {
    it('returns true when char is in string unquoted', function () {
      assert.strictEqual(dz.hasUnquoted('this is a ( string of text', '"', '('), true)
    })

    it('returns false when char is not in string', function () {
      assert.strictEqual(dz.hasUnquoted('this is a string of text', '"', '('), false)
    })

    it('returns false when char is in quoted string', function () {
      assert.strictEqual(dz.hasUnquoted('this is a string "of ( quoted" text', '"', '('), false)
    })
  })

  describe('removeChar', function () {
    const removeCases = [
      ['this ( has opening paran', '"', '(', 'this  has opening paran'],
      ['this ) has closing paran', '"', ')', 'this  has closing paran'],
    ]

    for (const c of removeCases) {
      it(`removes unquoted chacter ${c[2]}`, function () {
        assert.equal(dz.removeChar(c[0], c[1], c[2]), c[3])
      })
    }

    const remainCases = [
      ['this "(" quoted open remains', '"', '(', 'this "(" quoted open remains'],
      ['this ")" quoted open remains', '"', ')', 'this ")" quoted open remains'],
    ]

    for (const c of remainCases) {
      it(`retains quoted char ${c[2]}`, function () {
        assert.equal(dz.removeChar(c[0], c[1], c[2]), c[3])
      })
    }
  })

  describe('stripCommment', function () {
    it('removes a trailing comment', async function () {
      assert.equal(dz.stripComment('This line has a ; trailing comment', '"', ';'), 'This line has a ')
    })

    it('removes multiline comments', async function () {
      assert.equal(
        dz.stripComment(
          `This line has a ; trailing comment${os.EOL}and so too does ;this one${os.EOL}`,
          '"',
          ';',
        ),
        'This line has a ',
      )
    })
  })

  describe('valueCleanup', function () {
    it('strips double quotes from a quoted string', function () {
      assert.equal(dz.valueCleanup('"quoted value"'), 'quoted value')
    })

    it('returns numeric strings as numbers', function () {
      assert.strictEqual(dz.valueCleanup('3600'), 3600)
    })

    it('returns unquoted non-numeric strings as-is', function () {
      assert.equal(dz.valueCleanup('example.com.'), 'example.com.')
    })
  })

  describe('serialByDate', function () {
    it('returns a 10-digit date-based serial', function () {
      const serial = dz.serialByDate()
      assert.ok(Number.isInteger(serial))
      assert.ok(serial > 2020010100)
      assert.match(serial.toString(), /^\d{10}$/)
    })

    it('uses provided increment', function () {
      const s1 = dz.serialByDate(0)
      const s5 = dz.serialByDate(5)
      assert.equal(s5 - s1, 5)
    })

    it('pads single-digit increment', function () {
      const serial = dz.serialByDate(3)
      assert.equal(serial.toString().slice(-2), '03')
    })
  })

  describe('toSeconds', function () {
    const cases = {
      '1w2d3h4m5s': 788645,
      '1w1d': 691200,
      '1w': 604800,
      '1d': 86400,
      '2h': 7200,
      '1m': 60,
      3600: 3600,
      '4500s': 4500,
    }

    for (const c in cases) {
      it(`converts ${c} to ${cases[c]} seconds`, function () {
        assert.equal(dz.toSeconds(c), cases[c])
      })
    }
  })
})
