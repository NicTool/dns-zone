
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
})
