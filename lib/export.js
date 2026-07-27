import os from 'node:os'

/**
 * Zone data generators, the counterpart to the parsers in bind.js / tinydns.js
 * / maradns.js. Each takes the resource records a parser produced (or that a
 * caller built) and returns the file's text.
 *
 * A zone array may also hold the `$ORIGIN` / `$TTL` directive objects the
 * parsers emit, and blank-line markers; each format decides what to do with
 * them.
 */

const isBlank = (rr) => rr === os.EOL || rr === '\n'
const isDirective = (rr) => rr && !rr.toBind && (rr.$ORIGIN || rr.$TTL)

/**
 * RFC 1035 zone file.
 *
 * `opts` is the zone_opts the RR classes read: `origin` and `ttl` for the
 * directives, and `hide` to shorten the output — `hide.origin` writes owners
 * relative to $ORIGIN (`@` at the apex), `hide.ttl` drops TTLs matching $TTL,
 * `hide.class` drops the IN, `hide.sameOwner` blanks a repeated owner.
 */
export function toBind(rrs, opts = {}) {
  const zoneOpts = { ...opts }
  const out = []

  // A parsed zone already carries its own directives; only synthesize the ones
  // it lacks, so round-tripping does not duplicate them.
  const has = (key) => rrs.some((rr) => isDirective(rr) && rr[key] !== undefined)
  if (opts.origin && !has('$ORIGIN')) out.push(`$ORIGIN ${opts.origin}`)
  if (opts.ttl && !has('$TTL')) out.push(`$TTL ${opts.ttl}`)

  for (const rr of rrs) {
    if (isBlank(rr)) continue
    if (isDirective(rr)) {
      out.push(`${Object.keys(rr)[0]} ${Object.values(rr)[0]}`)
      continue
    }
    if (!rr?.toBind) continue

    out.push(rr.toBind(zoneOpts).trimEnd())
    zoneOpts.previousOwner = rr.get('owner')
  }

  return out.join('\n') + '\n'
}

/** djbdns data file. tinydns has no directives; every name is absolute. */
export function toTinydns(rrs) {
  const out = []
  for (const rr of rrs) {
    if (isBlank(rr) || isDirective(rr)) continue
    if (!rr?.toTinydns) continue
    out.push(rr.toTinydns().trimEnd())
  }
  return out.join('\n') + '\n'
}

/**
 * MaraDNS csv2 zone file. Directives become /origin and /ttl lines.
 *
 * `terminator` is the `~` that ends a record in MaraDNS 2.x csv2. MaraDNS 1.2
 * has no terminator — its parser counts the fields each type needs (see
 * csv2(5) for 1.2) — and rejects `~` as an unexpected character, so pass
 * `terminator: ''` for that.
 */
export function toMaraDNS(rrs, opts = {}) {
  const terminator = opts.terminator ?? '~'
  const out = []
  const has = (key) => rrs.some((rr) => isDirective(rr) && rr[key] !== undefined)
  if (opts.origin && !has('$ORIGIN')) out.push(`/origin ${opts.origin}`)
  if (opts.ttl && !has('$TTL')) out.push(`/ttl ${opts.ttl}`)

  for (const rr of rrs) {
    if (isBlank(rr)) continue
    if (rr?.$TTL) {
      out.push(`/ttl ${rr.$TTL}`)
      continue
    }
    if (rr?.$ORIGIN) {
      out.push(`/origin ${rr.$ORIGIN}`)
      continue
    }
    if (!rr?.toMaraDNS) continue
    const line = rr.toMaraDNS().trimEnd()
    out.push(terminator === '~' ? line : line.replace(/\s*~$/, ''))
  }

  return out.join('\n') + '\n'
}

/** Newline-delimited JSON, one record per line. */
export function toJSON(rrs) {
  const out = []
  for (const rr of rrs) {
    if (isBlank(rr) || !rr?.get) continue
    if (rr.get('comment')) delete rr.comment
    out.push(JSON.stringify(rr))
  }
  return out.join('\n') + '\n'
}

export default { toBind, toTinydns, toMaraDNS, toJSON }
