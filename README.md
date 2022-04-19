[![Module Tests](https://github.com/NicTool/dns-zone/actions/workflows/ci-test.yml/badge.svg)](https://github.com/NicTool/dns-zone/actions/workflows/ci-test.yml)
[![Coverage Status](https://coveralls.io/repos/github/NicTool/dns-zone/badge.svg?branch=master)](https://coveralls.io/github/NicTool/dns-zone?branch=master)

# dns-zone

DNS zone tool

## SYNOPSIS

Import and export DNS data to and from common nameserver formats. Normalize, validate, and optionally apply transformations at the same time.


````
➜ ./bin/dns-zone -h

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

Examples

  1. BIND file to human     ./bin/dns-zone -i bind -f isi.edu
  2. BIND file to tinydns   ./bin/dns-zone -i bind -f isi.edu -e tinydns
  3. tinydns file to BIND   ./bin/dns-zone -i tinydns -f data -e bind

  Project home: https://github.com/NicTool/dns-zone
````

## bin/dns-zone

#### import from STDIN to human

````
➜ cat example.com| ./bin/dns-zone.js -i bind -f - --origin=example.com.
$ORIGIN example.com.
$TTL 3600
example.com.          3600  SOA    ns.example.com. username.example.com. 2020091025 7200 3600 1209600 3600
example.com.          3600  NS     ns.example.com.
example.com.          3600  NS     ns.somewhere.example.
example.com.          3600  MX     10 mail.example.com.
example.com.          3600  MX     20 mail2.example.com.
example.com.          3600  MX     50 mail3.example.com.
example.com.          3600  A      192.0.2.1
example.com.          3600  AAAA   2001:0db8:0010:0000:0000:0000:0000:0001
ns.example.com.       3600  A      192.0.2.2
ns.example.com.       3600  AAAA   2001:0db8:0010:0000:0000:0000:0000:0002
www.example.com.      3600  CNAME  example.com.
wwwtest.example.com.  3600  CNAME  www.example.com.
mail.example.com.     3600  A      192.0.2.3
mail2.example.com.    3600  A      192.0.2.4
mail3.example.com.    3600  A      192.0.2.5
````

#### from bind file to bind

````
➜ ./bin/dns-zone.js -i bind -e bind -f isi.edu --origin=isi.edu.
isi.edu.    60  IN  SOA venera.isi.edu. action\.domains.isi.edu.    20  7200    600 3600000 60
isi.edu.    60  IN  NS  a.isi.edu.
isi.edu.    60  IN  NS  venera.isi.edu.
isi.edu.    60  IN  NS  vaxa.isi.edu.
isi.edu.    60  IN  MX  10  venera.isi.edu.
isi.edu.    60  IN  MX  20  vaxa.isi.edu.
a.isi.edu.  60  IN  A   26.3.0.103
venera.isi.edu. 60  IN  A   10.1.0.52
venera.isi.edu. 60  IN  A   128.9.0.32
vaxa.isi.edu.   60  IN  A   10.2.0.27
vaxa.isi.edu.   60  IN  A   128.9.0.33
````

#### from bind to bind (relative)

````
➜ ./bin/dns-zone.js -i bind -e bind -f isi.edu --ttl=60 \
   --origin=isi.edu. --hide-ttl --hide-class --hide-origin --hide-same-owner
@   60  IN  SOA venera  action\.domains 20  7200    600 3600000 60
            NS  a
            NS  venera
            NS  vaxa
            MX  10  venera
            MX  20  vaxa
a           A   26.3.0.103
venera          A   10.1.0.52
            A   128.9.0.32
vaxa            A   10.2.0.27
            A   128.9.0.33
````


#### from bind to tinydns

````
➜ ./bin/dns-zone.js --origin=isi.edu. -i bind -e tinydns -f isi.edu
Zisi.edu:venera.isi.edu:action\.domains.isi.edu:20:7200:600:3600000:60:60::
&isi.edu::a.isi.edu:60::
&isi.edu::venera.isi.edu:60::
&isi.edu::vaxa.isi.edu:60::
@isi.edu::venera.isi.edu:10:60::
@isi.edu::vaxa.isi.edu:20:60::
+a.isi.edu:26.3.0.103:60::
+venera.isi.edu:10.1.0.52:60::
+venera.isi.edu:128.9.0.32:60::
+vaxa.isi.edu:10.2.0.27:60::
+vaxa.isi.edu:128.9.0.33:60::
````

#### from bind to maradns

````
./bin/dns-zone.js -i bind -e maradns -f isi.edu --origin=isi.edu.
isi.edu.     SOA    venera.isi.edu. action\.domains.isi.edu.    20  7200    600 3600000 60 ~
isi.edu.    +60 NS  a.isi.edu. ~
isi.edu.    +60 NS  venera.isi.edu. ~
isi.edu.    +60 NS  vaxa.isi.edu. ~
isi.edu.    +60 MX  10  venera.isi.edu. ~
isi.edu.    +60 MX  20  vaxa.isi.edu. ~
a.isi.edu.  +60 A   26.3.0.103 ~
venera.isi.edu. +60 A   10.1.0.52 ~
venera.isi.edu. +60 A   128.9.0.32 ~
vaxa.isi.edu.   +60 A   10.2.0.27 ~
vaxa.isi.edu.   +60 A   128.9.0.33 ~
````

## VALIDATION

DNS zones have numerous rules regarding the records that can exist in them. Examples:

- [ ] serial numbers must increment when changes are made
- [x] multiple identical RRs are not allowed - RFC 2181
    - [x] CAA takes tag into account, SRV: port
- [x] RFC 2181: RR sets (identical label, class, type) must have identical TTL
- [x] multiple CNAMES with the same name are not allowed
- [x] CNAME label cannot coexist except for SIG,NXT,KEY,RRSIG,NSEC
- [ ] MX and NS records cannot point to CNAME

Etc, etc, etc..

This module will input a collection of [dns-resource-records](https://github.com/NicTool/dns-resource-record) and validate that all the zone records can coexist.


## TODO

- importing
    - [x] write a bind zone file parser
    - [x] write a tinydns data file parser
    - [x] add BIND parsing for all RRs supported by dns-rr
    - [x] write a maradns parser
- normalize BIND zone records
    - [x] expand `@` to zone name
    - [x] empty names are same as previous RR record
    - [x] missing TTLs inherit zone TTL, or zone MINIMUM
    - expand hostnames to FQDNs
        - [x] ALL: name field
        - [x] MX: exchange
        - [x] CNAME: cname,
        - [x] SOA: mname, rname,
        - [x] NS,PTR: dname
    - [x] suppress hostname when identical to previous RR
- [x] validate zone rules
- [x] make it easy to add test cases: eg, test/fixtures/zones

## GOALS

- 2040 compatibility
    + the software stack should evolve gracefully with the tech industry
    + loosely coupled dependencies
- modularity
    + easy to add a new DNS [resource record type](https://github.com/NicTool/dns-resource-record)
    + easy to add/modify/update DNS [zone rules](https://github.com/NicTool/dns-zone)
- easily coupled with many DNS servers
- distribution of DNS data should be secure, fast, and efficient
