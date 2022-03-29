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
  -f, --file <stdin | file path>                   source of DNS zone data (stdin)

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

  1. BIND file to human     ./bin/dns-zone -i ./isi.edu
  2. BIND file to tinydns   ./bin/dns-zone -i ./isi.edu -e tinydns
  3. tinydns file to BIND   ./bin/dns-zone -i ./data -e bind

  Project home: https://github.com/nictool/dns-zone
````

## bin/dns-zone

#### import from STDIN to human

````
➜ cat example.com | ./bin/dns-zone --origin=example.com
example.com.          3600  SOA    ns.example.com. username.example.com. 2020091025 7200 3600 1209600 3600
example.com.          3600  NS     ns.example.com.
example.com.          3600  NS     ns.somewhere.example.
example.com.          3600  MX     10 mail.example.com.
example.com.          3600  MX     20 mail2.example.com.
example.com.          3600  MX     50 mail3.example.com.
example.com.          3600  A      192.0.2.1
example.com.          3600  AAAA   2001:0db8:0010:0000:0000:0000:0000:0001
ns.example.com.       3600  A      192.0.2.2
example.com.          3600  AAAA   2001:0db8:0010:0000:0000:0000:0000:0002
www.example.com.      3600  CNAME  example.com.
wwwtest.example.com.  3600  CNAME  www.example.com.
mail.example.com.     3600  A      192.0.2.3
mail2.example.com.    3600  A      192.0.2.4
mail3.example.com.    3600  A      192.0.2.5
````

#### from bind file to bind

````
➜ ./bin/dns-zone -f isi.edu -i import -e bind
$TTL    60
$ORIGIN isi.edu.
isi.edu.    IN  SOA venera.isi.edu. action.domains.isi.edu. (
          20     ; SERIAL
          7200   ; REFRESH
          600    ; RETRY
          3600000; EXPIRE
          60
          )

isi.edu.    60  IN  NS  A.ISI.EDU.
isi.edu.    60  IN  NS  venera.isi.edu.
isi.edu.    60  IN  NS  vaxa.isi.edu.
isi.edu.    60  IN  MX  10  venera.isi.edu.
isi.edu.    60  IN  MX  20  vaxa.isi.edu.
a   60  IN  A   26.3.0.103
venera  60  IN  A   10.1.0.52
venera  60  IN  A   128.9.0.32
vaxa    60  IN  A   10.2.0.27
vaxa    60  IN  A   128.9.0.33
````

#### from bind to bind (relative)

````
➜ ./bin/dns-zone -f isi.edu -i bind -e bind --ttl=60 \
  --hide-ttl --hide-class --hide-origin --hide-same-owner
$TTL    60
$ORIGIN isi.edu.
@   IN  SOA venera  action\.domains (
        20     ; SERIAL
        7200   ; REFRESH
        600    ; RETRY
        3600000; EXPIRE
        60
        )

            NS  a
            NS  venera
            NS  vaxa
            MX  10  venera
            MX  20  vaxa

a           A   26.3.0.103

venera      A   10.1.0.52
            A   128.9.0.32

vaxa        A   10.2.0.27
            A   128.9.0.33
````


#### from bind to tinydns

````
➜  ./bin/dns-zone -f isi.edu -i bind -e tinydns
Zisi.edu:venera.isi.edu:action\.domains.isi.edu:20:7200:600:3600000:60:60::
&isi.edu::A.ISI.EDU:60::
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

## VALIDATION

DNS zones have numerous rules regarding the records that can exist in them. Examples:

- serial numbers must increment when changes are made
- [x] multiple identical RRs are not allowed - RFC 2181
    - [x] CAA takes tag into account, SRV: port
- [x] RFC 2181: RR sets (identical label, class, type) must have identical TTL
- [x] multiple CNAMES with the same name are not allowed
- [x] CNAME label cannot coexist except for SIG,NXT,KEY,RRSIG,NSEC
- MX and NS records cannot point to CNAME

Etc, etc, etc..

This module will input a collection of [dns-resource-records](https://github.com/nictool/dns-resource-record) and validate that all the zone records can coexist.


## TODO

- importing
    - [ ] write a named.conf file parser
    - [x] write a bind zone file parser
    - [x] write a tinydns data file parser
    - [x] add BIND parsing for all RRs supported by dns-rr
    - [ ] add support for $INCLUDE (RFC 1035)
    - [ ] write a maradns parser
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
- [ ] make it easy to add test cases: eg, test/fixtures/rr/{mx|a|*}/*
