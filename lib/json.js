import * as RR from '@nictool/dns-resource-record'

export const zoneOpts = {}

export default { zoneOpts, parseZoneFile }

export async function parseZoneFile(str, ctx = zoneOpts) {
  const res = []

  for (const line of str.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const obj = JSON.parse(trimmed)
    if (!obj.type) throw new Error(`JSON record missing 'type': ${trimmed}`)
    if (!RR[obj.type]) throw new Error(`unknown RR type: ${obj.type}`)

    res.push(new RR[obj.type](obj))
  }

  return res
}
