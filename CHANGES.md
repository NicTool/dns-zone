
#### 1.N.N - YYYY-MM-DD


#### 0.5.0 - 2022-03-27

- rr.name -> rr.owner
- ZONE: add addCname, hasNoConflictingLabels, getOwnerMatches
- ZONE: add tests for A, SMIMEA, SSHFP, SRV, TLSA, URI
- index: add class ZONE, addRR, addNS, getRR, itMatchesSetTTL, setOrigin, setSOA, setTTL
- repo: move from msimerson -> nictool org
- package rename: remove -validator
- dns-zone: added toHuman
- rename: bin/import -> bin/dns-zone
- grammar: start of nsec,nsec3
- move BIND specific fns from ./index to lib/zonefile
- move compiled grammars into ./dist


#### 0.4.0 - 2022-03-26

- move compiled grammar.js into ./lib
- pass previousOwner into RR
- tinydns: move functions into lib/tinydns
- add: bind rr parsing for CAA, DNSKEY, DS, HINFO, LOC 
- import: add option hide-same-name
- rewrite the parser grammar
    - parser uses (mostly) BNFs from RFCs 🎉
- add parsing for RRs: naptr, rrsig, smimea, sshfp, spf, srv, tlsa, uri, TYPE{N} (generic)
- tests: added tests for MX, NS, PTR, SOA, TXT


#### 0.3.0 - 2022-03-24

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
    - added zonefile example.com, localhost
    - added relative CNAME test
- README: expand with examples


#### 0.2.0 - 2022-03-22

- add expandShortcuts
- added bin/import
- use async for parseZoneFile and expandShortcuts
- SOA: capture comments


#### 0.1.0 - 2022-03-17

- Bind zonefile parser, using nearley: #1
    
- stab #1: parses cadillac.net
- test #2: add isi.edu zone
- allow comments after SOA closing parens
- DRY the grammar -> object functions
- add \r to eol, for windows
- local copy of builtin-whitespace, adds \r char
- ci: remove windows support, times out, I think upstream nearley issue
