# dns-zone-validator

DNS zone validator


## SYNOPSIS

DNS zones have numerous rules regarding the records that can exist in them. Examples:

- serial numbers must increment when changes are made
- multiple identical RRs are not allowed - RFC 2181
    - CAA takes tag into account, SRV: port
- multiple CNAMES with the same name are not allowed
- CNAME cannot coexist with SIG,NXT,KEY,RRSIG,NSEC,A,AAAA
- MX and NS records cannot point to CNAME

Etc, etc, etc..

This module will input a collection of [dns-resource-records](https://github.com/msimerson/dns-resource-record) and validate that all the zone records can coexist.


## TODO

- [ ] write a named.conf file parser
- [x] write a bind zone file parser
- normalize the zone records
    - [x] expand `@` to zone name
    - [x] empty names are same as previous RR record
    - [x] missing TTLs inherit zone TTL, or zone MINIMUM
    - [x] expand hostnames to FQDNs
        - [x] ALL: name field
        - [x] MX: exchange, CNAME: cname, SOA: mname, rname, NS: dname