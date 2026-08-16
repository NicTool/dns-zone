[![Tests][test-img]][test-uri]
[![Coverage][cov-img]][cov-uri]

# dns-zone

Import, export, and validate DNS zone data across common nameserver formats.

## SYNOPSIS

Parse and emit DNS zone data in RFC 1035, tinydns, and maradns formats. Normalize (expand `@`, inherit TTLs, fully-qualify names), validate (RFC 1034/1035/2181/4035 coexistence rules), and convert between formats.

## INSTALLATION

```
npm install -g @nictool/dns-zone   # CLI
npm install @nictool/dns-zone      # library
```

## SUPPORTED FORMATS

| Format   | Identifier        | Import |    Export     |
| -------- | ----------------- | :----: | :-----------: |
| RFC 1035 | `rfc1035`, `bind` |  yes   |      yes      |
| tinydns  | `tinydns`         |  yes   |      yes      |
| maradns  | `maradns`         |  yes   |      yes      |
| JSON     | `json`            |  yes   |      yes      |
| human    | —                 |  n/a   | yes (default) |

RFC 1035 is the zone file format BIND popularized and is supported by many name servers including Knot, NSD, and PowerDNS. `bind` is a finger-friendly alias for `rfc1035`.

RFC 1035 `$INCLUDE` directives are followed (paths are confined to the source file's directory).

## CLI

```
➜ dns-zone -h

 +-+-+-+ +-+-+-+-+
 |D|N|S| |Z|O|N|E|
 +-+-+-+ +-+-+-+-+

I/O

  -i, --import <json | rfc1035 | maradns | tinydns>   zone data format
  -e, --export <json | rfc1035 | maradns | tinydns>   zone data format
  -f, --file <file path | - (stdin)>                  source of zone data

Zone Settings

  -o, --origin string   zone $ORIGIN
  -t, --ttl number      zone default TTL
  -c, --class string    zone class (IN)

Output Options

  --hide-origin        remove origin from RR domain names
  --hide-class         hide class
  --hide-ttl           hide TTLs
  --hide-same-owner    hide owner when same as previous RR

Misc

  -v, --verbose    Show status messages during processing
  -h, --help       Display this usage guide
```

### Examples

Default human output:

```
➜ cat example.com | dns-zone -i rfc1035 -f - --origin=example.com.
$ORIGIN example.com.
$TTL 3600
example.com.          3600  SOA    ns.example.com. username.example.com. 2020091025 7200 3600 1209600 3600
example.com.          3600  NS     ns.example.com.
example.com.          3600  MX     10 mail.example.com.
example.com.          3600  A      192.0.2.1
www.example.com.      3600  CNAME  example.com.
mail.example.com.     3600  A      192.0.2.3
```

Convert BIND → tinydns:

```
➜ dns-zone --origin=isi.edu. -i bind -e tinydns -f isi.edu
Zisi.edu:venera.isi.edu:action\.domains.isi.edu:20:7200:600:3600000:60:60::
&isi.edu::a.isi.edu:60::
@isi.edu::venera.isi.edu:10:60::
+a.isi.edu:26.3.0.103:60::
```

Render RFC 1035 relative to origin (hide ttl/class/origin/same-owner):

```
➜ dns-zone -i rfc1035 -e rfc1035 -f isi.edu --origin=isi.edu. \
    --hide-ttl --hide-class --hide-origin --hide-same-owner
@        SOA venera  action\.domains 20  7200    600 3600000 60
         NS  a
         NS  venera
a        A   26.3.0.103
venera   A   10.1.0.52
         A   128.9.0.32
```

## PROGRAMMATIC API

```js
import { bind, json, maradns, tinydns } from '@nictool/dns-zone'

// BIND zone file → array of RR objects
const rrs = await bind.parseZoneFile(zoneText, { origin: 'example.com.', ttl: 3600 })

// BIND zone file with $INCLUDE directives (pass file path so includes can be resolved)
const rrs = await bind.parseZoneFile(zoneText, { file: '/path/to/zone.db' })

// JSON (NDJSON, one RR per line — same format as -e json output)
const rrs = await json.parseZoneFile(ndjsonText)

// tinydns data file
const rrs = await tinydns.parseData(dataText)

// maradns csv2
const rrs = await maradns.parseZoneFile(csv2Text, { origin: 'example.com.' })
```

Each RR is a [`@nictool/dns-resource-record`][dns-rr] instance; use `rr.to[Bind|Tinydns|MaraDNS}])` to emit in other formats.

The parsers validate each record. They do **not** apply the zone-level coexistence rules below. That is deliberate:

- converting a broken zone is a supported workflow
- a tinydns `data` file holds every zone

Use `validateZone` or `ZONE` to check a zone against the rules.

Parse and validate in one call:

```js
import { validateZone } from '@nictool/dns-zone'

const { RR, errors } = await validateZone(zoneText, { origin: 'example.com.', ttl: 3600 })
if (errors.length) console.error(errors)
```

`format` selects the parser (`rfc1035`, `json`, `maradns`, `tinydns`); the remaining options are passed through.

```js
const { errors } = await validateZone(data, { format: 'tinydns' })
// [ { zone: 'example.com.', rr: …, error: … } ]
```

An RFC 1035 zone file and a maradns csv2 each describe a single zone.

For multi-zone formats (tinydns, JSON), `splitByZone(RR, { manyZones: true })` partitions and exports. Records are assigned to the most specific zone that encloses them.

To validate records you already have, use the class directly:

```js
import { ZONE } from '@nictool/dns-zone'

const z = new ZONE({ origin: 'example.com.', RR: rrs })
if (z.errors.length) console.error(z.errors)
```

`ZONE` models one zone; pass it the records of a single zone.

## VALIDATION

`ZONE` enforces the following zone rules:

- single SOA per zone (RFC 1035)
- single zone class across all records
- no duplicate RRs, including tag-aware CAA and port-aware SRV (RFC 2181)
- identical TTL across an RRset (same label/class/type) (RFC 2181)
- at most one CNAME per owner (RFC 1034)
- CNAME coexists only with SIG, NXT, KEY, NSEC, RRSIG (RFC 1034, 2181, 4035)

Violations are collected on `zone.errors` and also printed by the CLI (with `-v` to include the offending record).

## RELATED PACKAGES

- [`@nictool/dns-resource-record`][dns-rr] — record-level parsing, validation, and format conversion
- [`@nictool/dns-nameserver`](https://github.com/NicTool/dns-nameserver) — nameserver config parsers (BIND, Knot, MaraDNS, NSD, tinydns)

## LICENSE

BSD-3-Clause — see [LICENSE](LICENSE).

[dns-rr]: https://github.com/NicTool/dns-resource-record
[test-img]: https://github.com/NicTool/dns-zone/actions/workflows/ci.yml/badge.svg
[test-uri]: https://github.com/NicTool/dns-zone/actions/workflows/ci.yml
[cov-img]: https://coveralls.io/repos/github/NicTool/dns-zone/badge.svg
[cov-uri]: https://coveralls.io/github/NicTool/dns-zone
