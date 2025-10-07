# ChangeLog

### Unreleased

### [1.1.6] - 2025-10-06

- style: add prettier, update eslint to v9

### [1.1.5] - 2024-11-04

- chore: use package.json[files], delete .npmignore
- chore: bump dep versions

### [1.1.4] - 2022-06-03

- ci: auto-populate node LTS versions for CI tests

### [1.1.3] - 2022-05-29

- chore(ci): updated shared GHA workflow URLs

### [1.1.2] - 2022-05-29

- chore: publish npm package in @nictool namespace

### [1.1.1] - 2022-05-28

- chore: replace .release scripts with submodule
- chore(ci): merged coverage & lint into ci-test.yml
- chore(ci): ci-test.yml -> ci.yml
- maradns: refactoring parseZoneFile for simplicity

### 1.1.0 - 2022-05-09

- feat(speed): make adding records much faster
  - for a zone with 30,000 records, reduce insertion time from 7 minutes to ~3 seconds.
  - method: populate owner index, use for duplicate and collision detection (vs linear array search)
- test: add windows CI testing
- test(bind): replace implicit \n with os.EOL
- test(index): add tests for removeChar, stripComment

### 1.0.0 - 2022-04-25

- fix(dns-zone): update import syntax for ESM RR
- feat(bin/dns-zone): when -e=tinydns fails, show entry
- feat(bin/dns-zone): usage caller specifies exit code
- feat(bind): print a . for every 500 RRs parsed
- feat(tinydns): print unparsable line before throwing
- test(dns-zone): add help and example.com tests
- test(dns-zone): import tinydns zone, export as mara

### 0.9.0 - 2022-04-19

- feat(bind): add more RR types to zoneRR pattern
- style: move class ZONE from ./index to lib/zone
- test: replace coverage reporter nyc with c8
- bind: when a RR doesn't parse, show it before the error

### 0.8.5 - 2022-04-18

- updated to work with dns-rr as ES6 module

### 0.8.0 - 2022-04-14

- style(bin/dns-zone): use fs/promises API
- bin/dns-zone.js: updates to work as ES6 module
- style(mara): replace nearley parser with custom JS
  - leans more on dns-resource-record for parsing
  - index: added hasUnquoted, removeChar, replaceChar, stripComment, serialByDate, serialByFileStat
  - dep: removed nearley
  - tests: fully parse the records and compare against fully parsed test case (robust++)
- CJS -> ESM
- add index.valueCleanup
- feat(bind): replace nearly parser with custom
- style(bin/dns-zone): use fs/promises API

### 0.7.0 - 2022-04-08

- bind: do more array unpacking in parser
- test: load example.net maradns zone file
- mara: more flattening in parser, fix ttl
- mara: add eol to comment
- mara: improve blank line handling
- style: use fs promises

### 0.6.0 - 2022-03-29

- rename: zonefile -> bind
- maradns
  - csv2 format parser
  - shortcut expansion
  - exporter
- bin/dns-zone
  - added checkZone (zone validator)
  - make import format explicit (-i)
  - make input (stdin vs file) explicit (-f)
- bind: add NAPTR test

### 0.5.1 - 2022-03-27

- hostnames: add \ to allowed chars
- dns-zone: use zf.zoneOpts directly
- bind: track lastOwner, so blank entries have correct name
- README: move -h output into synopsis, ## validation

### 0.5.0 - 2022-03-27

- rr.name -> rr.owner
- ZONE: add addCname, hasNoConflictingLabels, getOwnerMatches
- ZONE: add tests for A, SMIMEA, SSHFP, SRV, TLSA, URI
- index: add class ZONE, addRR, addNS, getRR, itMatchesSetTTL, setOrigin, setSOA, setTTL
- repo: move from msimerson -> NicTool org
- package rename: remove -validator
- dns-zone: added toHuman
- rename: bin/import -> bin/dns-zone
- grammar: start of nsec,nsec3
- move BIND specific fns from ./index to lib/bind
- move compiled grammars into ./dist

### 0.4.0 - 2022-03-26

- move compiled grammar.js into ./lib
- pass previousOwner into RR
- tinydns: move functions into lib/tinydns
- add: bind rr parsing for CAA, DNSKEY, DS, HINFO, LOC
- import: add option hide-same-name
- bind grammar (parser):
  - rewrite
  - parser uses (mostly) BNFs from RFCs 🎉
  - add RRs: naptr, rrsig, smimea, sshfp, spf, srv, tlsa, uri, TYPE{N} (generic)
- tests: added tests for MX, NS, PTR, SOA, TXT

### 0.3.0 - 2022-03-24

- import
  - added CLI options
  - added tinydns ingest support
  - encapsulated output logic
- pass zone_opts to RR exporter
- export: add JSON
- index: import fullyQualify from dns-rr
- grammar
  - improved ip6 compressed parsing
  - add PTR support in bind zone files
- test
  - added bind example.com, localhost
  - added relative CNAME test
- README: expand with examples

### 0.2.0 - 2022-03-22

- add expandShortcuts
- added bin/import
- use async for parseZoneFile and expandShortcuts
- SOA: capture comments

### 0.1.0 - 2022-03-17

- Bind zonefile parser, using nearley: #1
- stab #1: parses cadillac.net
- test #2: add isi.edu zone
- allow comments after SOA closing parens
- DRY the grammar -> object functions
- add \r to eol, for windows
- local copy of builtin-whitespace, adds \r char
- ci: remove windows support, times out, I think upstream nearley issue

[1.1.1]: https://github.com/NicTool/dns-zone/releases/tag/1.1.1
[1.1.2]: https://github.com/NicTool/dns-zone/releases/tag/1.1.2
[1.1.3]: https://github.com/NicTool/dns-zone/releases/tag/1.1.3
[1.1.4]: https://github.com/NicTool/dns-zone/releases/tag/1.1.4
[1.1.5]: https://github.com/NicTool/dns-zone/releases/tag/1.1.5
[1.1.6]: https://github.com/NicTool/dns-zone/releases/tag/v1.1.6
[0.0.2]: https://github.com/NicTool/dns-zone/releases/tag/0.0.2
[0.1.0]: https://github.com/NicTool/dns-zone/releases/tag/0.1.0
[0.2.0]: https://github.com/NicTool/dns-zone/releases/tag/0.2.0
[0.3.0]: https://github.com/NicTool/dns-zone/releases/tag/0.3.0
[0.4.0]: https://github.com/NicTool/dns-zone/releases/tag/0.4.0
[0.5.0]: https://github.com/NicTool/dns-zone/releases/tag/0.5.0
[0.5.1]: https://github.com/NicTool/dns-zone/releases/tag/0.5.1
[0.6.0]: https://github.com/NicTool/dns-zone/releases/tag/0.6.0
[0.7.0]: https://github.com/NicTool/dns-zone/releases/tag/0.7.0
[0.8.0]: https://github.com/NicTool/dns-zone/releases/tag/0.8.0
[0.8.5]: https://github.com/NicTool/dns-zone/releases/tag/0.8.5
[0.9.0]: https://github.com/NicTool/dns-zone/releases/tag/0.9.0
[1.0.0]: https://github.com/NicTool/dns-zone/releases/tag/1.0.0
[1.1.0]: https://github.com/NicTool/dns-zone/releases/tag/1.1.0
