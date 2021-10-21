# dns-zone-validator

DNS zone validator


## SYNOPSIS

DNS zones have numerous rules regarding the records that can exist in them. Examples:

- serial numbers must increment when changes are made
- multiple identical RRs are not allowed - RFC 2181
- multiple CNAMES with the same name are not allowed
- CNAME cannot coexist with SIG,NXT,KEY,RRSIG,NSEC
- A cannot coexist with CNAME

Etc, etc, etc..

This module will input a collection of [dns-resource-records](https://github.com/msimerson/dns-resource-record) and validate that all the zone records can coexist.