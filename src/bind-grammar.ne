
#@builtin "number.ne"
@builtin "string.ne"
@builtin "whitespace.ne"


main            -> (statement "\n"):+

statement       -> blank | ttl | origin | soa | ns | mx | a | txt | aaaa | cname | dname

blank           -> _

comment         -> ";" [^\n]:*

ttl             -> "$TTL" __ uint _ (comment):? _
                   {% (d) => ttlAsObject(d) %}

origin          -> "$ORIGIN" __ hostname (comment):? _
                   {% (d) => originAsObject(d) %}

soa             -> hostname ( __ uint ):? ( __ class ):? __ "SOA"
                   __ hostname
                   __ hostname
                   __ "("
                       __ uint (_ comment):?
                       __ uint (_ comment):?
                       __ uint (_ comment):?
                       __ uint (_ comment):?
                       __ uint (_ comment):?
                   _ ")" _
                   {% (d) => soaAsObject(d) %}

ns              -> hostname (__ uint):? (__ class):? __ "NS"
                   __ hostname _ (comment):? _
                   {% (d) => nsAsObject(d) %}

mx              -> hostname (__ uint):? (__ class):? __ "MX"
                   __ uint __ hostname _ (comment):?
                   {% (d) => mxAsObject(d) %}

a               -> hostname (__ uint):? (__ class):? __ "A"
                   __ ip4 _ (comment):? _
                   {% (d) => aAsObject(d) %}

txt             -> hostname (__ uint):? (__ class):? __ "TXT"
                   __ (dqstring _):+ (comment):? _
                   {% (d) => txtAsObject(d) %}

aaaa            -> hostname (__ uint):? (__ class):? __ "AAAA"
                   __ ip6 _ (comment):? _
                   {% (d) => aaaaAsObject(d) %}

cname           -> hostname (__ uint):? (__ class):? __ "CNAME"
                   __ hostname _ (comment):? _
                   {% (d) => cnameAsObject(d) %}

dname           -> hostname (__ uint):? (__ class):? __ "DNAME"
                   __ hostname _ (comment):? _
                   {% (d) => dnameAsObject(d) %}

uint            -> [0-9]:+ {% (d) => parseInt(d[0].join("")) %}

hostname        -> ALPHA_NUM_DASH_U:* {% (d) => d[0].join("") %}

ALPHA_NUM_DASH_U -> [-0-9A-Za-z\u0080-\uFFFF._] {% id %}

class           -> "IN" | "CH" | "HS" | "CHAOS" | "ANY"

times_3[X]      -> $X $X $X
times_5[X]      -> $X $X $X $X $X
times_7[X]      -> $X $X $X $X $X $X $X

ip4             -> Snum times_3["."  Snum] {% (d) => flat_string(d) %}

ip6             -> IPv6_full | IPv6_comp | IPv6v4_full | IPv6v4_comp

Snum            -> DIGIT |
                 ( [1-9] DIGIT ) |
                 ( "1" DIGIT DIGIT ) |
                 ( "2" [0-4] DIGIT ) |
                 ( "2" "5" [0-5] )

DIGIT          -> [0-9] {% id %}
HEXDIG         -> [0-9A-Fa-f] {% id %}

IPv6_hex       -> HEXDIG |
                ( HEXDIG HEXDIG ) |
                ( HEXDIG HEXDIG HEXDIG ) |
                ( HEXDIG HEXDIG HEXDIG HEXDIG )

IPv6_full      -> IPv6_hex times_7[":" IPv6_hex]
                  {% (d) => flat_string(d) %}

IPv6_comp      -> (IPv6_hex times_5[":" IPv6_hex]):? "::"
                  (IPv6_hex times_5[":" IPv6_hex]):?
                  {% (d) => flat_string(d) %}

IPv6v4_full    -> IPv6_hex times_5[":" IPv6_hex] ":" ip4
                  {% (d) => flat_string(d) %}

IPv6v4_comp    -> (IPv6_hex times_3[":" IPv6_hex]):? "::"
                  (IPv6_hex times_3[":" IPv6_hex] ":"):?
                  ip4
                  {% (d) => flat_string(d) %}


#ALPHA_NUM      -> [0-9A-Za-z]
#ALPHA_NUM_U    -> [0-9A-Za-z\u0080-\uFFFF] {% id %}


# https://datatracker.ietf.org/doc/html/rfc1035#page-12
#domain      -> subdomain | " "
#subdomain   -> label | subdomain "." label
#label       -> letter ldh-str let-dig
#ldh-str     -> let-dig-hyp | let-dig-hyp ldh-str
#let-dig-hyp -> let-dig | "-"
#let-dig     -> letter | digit
#letter      -> [a-zA-Z]
#digit       -> [0-9]


@{%
function flat_string(d) {
  if (d) {
    if (Array.isArray(d)) return d.flat(Infinity).join("")
    return d
  }
  return ''
}

function ttlAsObject (d) {
    return { ttl: d[2] }
}

function originAsObject (d) {
    return { origin: d[2] }
}

function soaAsObject (d) {
    return {
        name   : d[0],
        ttl    : d[1][1],
        class  : d[2][1][0],
        type   : d[4],
        mname  : d[6],
        rname  : d[8],
        serial : d[12],
        refresh: d[15],
        retry  : d[18],
        expire : d[21],
        minimum: d[24],
    }
}

function nsAsObject (d) {
    return {
        name:  d[0],
        ttl :  d[1][1],
        class: d[2][1][0],
        type:  d[4],
        dname: d[6]
    }
}

function mxAsObject (d) {
    return {
        name:  d[0],
        ttl :  d[1][1],
        class: d[2][1][0],
        type:  d[4],
        preference: d[6],
        exchange  : d[8]
    }
}

function aAsObject (d) {
    return {
        name   : d[0],
        ttl    : d[1][1],
        class  : d[2][1][0],
        type   : d[4],
        address: d[6],
    }
}

function txtAsObject (d) {
    return {
        name  : d[0],
        ttl   : d[1][1],
        class : d[2][1][0],
        type  : d[4],
        data  : d[6].map(e => e[0]),
    }
}

function aaaaAsObject (d) {
    return {
        name   : d[0],
        ttl    : d[1][1],
        class  : d[2][1][0],
        type   : d[4],
        address: d[6][0],
    }
}

function cnameAsObject (d) {
    return {
        name   : d[0],
        ttl    : d[1][1],
        class  : d[2][1][0],
        type   : d[4],
        cname  : d[6][0],
    }
}

function dnameAsObject (d) {
    return {
        name   : d[0],
        ttl    : d[1][1],
        class  : d[2][1][0],
        type   : d[4],
        target : d[6][0],
    }
}

%}