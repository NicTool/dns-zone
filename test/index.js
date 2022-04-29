
import assert from 'assert'

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

  const cases = {
    '1w2d3h4m5s': 788645,
    '1w1d'      : 691200,
    '1w'        : 604800,
    '1d'        : 86400,
    '2h'        : 7200,
    '1m'        : 60,
    '3600'      : 3600,
    '4500s'     : 4500,
  }

  describe('toSeconds', function () {
    for (const c in cases) {
      it(`converts ${c} to ${cases[c]} seconds`, function () {
        assert.equal(dz.toSeconds(c), cases[c])
      })
    }
  })
})
