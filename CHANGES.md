
#### 1.N.N - YYYY-MM-DD


#### 0.3.0 - 2022-03-23

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