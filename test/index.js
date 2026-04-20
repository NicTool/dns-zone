import assert from 'assert'
import os from 'os'
import { describe, it } from 'node:test'

import * as dz from '../index.js'

describe('dns-zone', function () {
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
