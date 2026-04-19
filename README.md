[![Module Tests](https://github.com/NicTool/dns-zone/actions/workflows/ci.yml/badge.svg)](https://github.com/NicTool/dns-zone/actions/workflows/ci.yml)
[![Coverage Status](https://coveralls.io/repos/github/NicTool/dns-zone/badge.svg?branch=main)](https://coveralls.io/github/NicTool/dns-zone?branch=main)

# dns-zone

Import, export, and validate DNS zone data across common nameserver formats.

## SYNOPSIS

Parse and emit DNS zone data in BIND, tinydns, and maradns formats. Normalize (expand `@`, inherit TTLs, fully-qualify names), validate (RFC 1034/1035/2181/4035 coexistence rules), and convert between formats.

## INSTALLATION

```
npm install -g @nictool/dns-zone   # CLI
npm install @nictool/dns-zone      # library
```

## SUPPORTED FORMATS

| Format  | Import |    Export     |
| ------- | :----: | :-----------: |
| BIND    |  yes   |      yes      |
| tinydns |  yes   |      yes      |
| maradns |  yes   |      yes      |
| JSON    |  yes   |      yes      |
| human   |  n/a   | yes (default) |

BIND `$INCLUDE` directives are followed (paths are confined to the source file's directory).

## CLI

```
➜ dns-zone -h

 +-+-+-+ +-+-+-+-+
 |D|N|S| |Z|O|N|E|
 +-+-+-+ +-+-+-+-+

I/O

  -i, --import <json | bind | maradns | tinydns>   zone data format
  -e, --export <json | bind | maradns | tinydns>   zone data format
  -f, --file <file path | - (stdin)>               source of DNS zone data

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
➜ cat example.com | dns-zone -i bind -f - --origin=example.com.
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

Render BIND relative to origin (hide ttl/class/origin/same-owner):

```
➜ dns-zone -i bind -e bind -f isi.edu --origin=isi.edu. \
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

Each RR is a [`@nictool/dns-resource-record`](https://github.com/NicTool/dns-resource-record) instance; use `rr.toBind()`, `rr.toTinydns()`, `rr.toMaraDNS()` to emit in other formats.

Zone-level validation:

```js
import ZONE from '@nictool/dns-zone/lib/zone.js'

const z = new ZONE({ origin: 'example.com.', RR: rrs })
if (z.errors.length) console.error(z.errors)
```

## VALIDATION

`ZONE` enforces the following rules on the records you feed it:

- single SOA per zone (RFC 1035)
- single zone class across all records
- no duplicate RRs, including tag-aware CAA and port-aware SRV (RFC 2181)
- identical TTL across an RRset (same label/class/type) (RFC 2181)
- at most one CNAME per owner (RFC 1034)
- CNAME coexists only with SIG, NXT, KEY, NSEC, RRSIG (RFC 1034, 2181, 4035)

Violations are collected on `zone.errors` and also printed by the CLI (with `-v` to include the offending record).

## RELATED PACKAGES

- [`@nictool/dns-resource-record`](https://github.com/NicTool/dns-resource-record) — record-level parsing, validation, and format conversion
- [`@nictool/dns-nameserver`](https://github.com/NicTool/dns-nameserver) — nameserver config parsers (BIND, Knot, MaraDNS, NSD, tinydns)

## LICENSE

BSD-3-Clause — see [LICENSE](LICENSE).
