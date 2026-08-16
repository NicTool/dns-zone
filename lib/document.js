/**
 * The shape of a parsed zone array.
 *
 * The parsers produce a document, not a record set: alongside the RRs, the
 * array carries the `$ORIGIN` / `$TTL` directives inline, and — when
 * `ctx.showBlank` / `ctx.showComment` are set — the blank and comment lines
 * verbatim. Each consumer decides what to do with them.
 */

export const isRawLine = (rr) => typeof rr === 'string'

export const isBlank = (rr) => isRawLine(rr) && rr.trim() === ''

// Tested against undefined rather than truthiness: `$TTL 0` is a legal
// directive (RFC 2308), and a truthy test drops it while still synthesizing a
// replacement from opts.
export const isDirective = (rr) => rr && !rr.toBind && (rr.$ORIGIN !== undefined || rr.$TTL !== undefined)
