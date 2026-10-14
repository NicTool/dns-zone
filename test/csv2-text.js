// Copyright (c) 2026, The NicTool Contributors

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { maradns } from '../index.js'

test('CSV2 preserves quoted backslashes without BIND interpretation', async () => {
  const [record] = await maradns.parseZoneFile(`fixture.example. TXT 'a\\x7eb"c' ~\n`)
  assert.equal(record.get('data'), 'a\\x7eb"c')
})

test('CSV2 decodes unquoted hex and octal escapes', async () => {
  const [record] = await maradns.parseZoneFile(`fixture.example. SPF 'prefix '\\x7e'all'\\040'done' ~\n`)
  assert.equal(record.get('data'), 'prefix ~all done')
})

test('CSV2 retains chunk boundaries and empty chunks', async () => {
  const [record] = await maradns.parseZoneFile(`fixture.example. TXT 'one';;'three' ~\n`)
  assert.deepEqual(record.get('data'), ['one', '', 'three'])
})

test('CSV2 rejects malformed escapes instead of changing text', async () => {
  for (const value of ['\\xzz', '\\999', '\\q']) {
    await assert.rejects(maradns.parseZoneFile(`fixture.example. TXT ${value} ~\n`))
  }
})
