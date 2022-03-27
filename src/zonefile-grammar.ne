@builtin "string.ne"

main            -> (entry):*
entry           -> blank_line | comment_line | origin | zone_ttl | rr

blank_line      -> ws eol                                    {% flatten %}
comment_line    -> _ comment eol                             {% flatten %}
origin          -> "$ORIGIN" __ hostname _ (comment):? _ eol {% asOrigin %}
zone_ttl        -> "$TTL" __ uint _ (comment):? _ eol        {% asZoneTTL %}

comment         -> ";" anyToEOL                              {% flatten %}
ttl             -> uint                                      {% asUint %}
class           -> "IN" | "CS" | "CH" | "HS" | "NONE" | "ANY" | "CLASS" uint
rr              -> (hostname __) (ttl __):? (class __):? rr_type  {% flat %}

rr_type         -> a | aaaa | caa | cname | dname | dnskey | ds
                 | hinfo | loc | mx | naptr | ns | ptr | rrsig
                 | smimea | sshfp | soa | spf | srv
                 | tlsa | txt | uri | "TYPE" uint

# MACROS
times_3[X]      -> $X $X $X

# CHARACTER GROUPS
_               -> wschar:*             {% asNull %}
__              -> wschar:+             {% asNull %}
ws              -> wschareol:*          {% id %}
wschar          -> [ \t\v\f]            {% id %}
wschareol       -> [ \t\n\r\v\f]        {% id %}
wordchars       -> [^\s]                {% id %}
ip6_chars       -> [0-9A-Fa-f:]:*       {% id %}
digit           -> [0-9]                {% id %}
uint            -> [0-9]:+              {% asUint %}
udec            -> [0-9]:+ ("." [0-9]:+):? {% asUDec %}
eol             -> "\n" | "\r"
anyToEOL        -> [^\n\r]:*
alpha_NUM       -> [0-9a-z]:+           {% flatten %}
BASE64          -> [A-Za-z0-9+/=\s]     {% id %}
HEX_WS          -> [0-9A-Fa-f\s]        {% id %}

QUOTE_OR_NO_WS  -> "\"" ([^\\"]):+ "\"" | "'" ([^\\"]):+ "'" | ([^\s]):+

domain_name     -> host_char:*         {% asString %}
hostname        -> host_char:*         {% asString %}
host_char       -> [0-9A-Za-z\u0080-\uFFFF\.\-_@] {% id %}
word            -> (wordchars):+       {% flatten %}

ip4             -> int8 times_3["."  int8]   {% flatten %}
ip6             -> ip6_chars                 {% flatten %}
int8            -> digit | [1-9] digit | "1" digit digit | "2" [0-4] digit | "25" [0-5]


a        -> "A"      __ ip4 _ (comment):? _ eol                   {% asRR %}
aaaa     -> "AAAA"   __ ip6 _ (comment):? _ eol                   {% asRR %}
caa      -> "CAA"    __ uint __ alpha_NUM __ QUOTE_OR_NO_WS
                     _ (comment):? _ eol                          {% asRR %}
cname    -> "CNAME"  __ hostname _ (comment):? _ eol              {% asRR %}
dname    -> "DNAME"  __ hostname _ (comment):? _ eol              {% asRR %}
dnskey   -> "DNSKEY" __ uint __ uint __ uint __
                     "(" _ (BASE64):+ _ ")" _ (comment):? _ eol   {% asRR %}
ds       -> "DS"     __ uint __ uint __ uint __
                     "(" _ (HEX_WS):+ _ ")" _ (comment):? _ eol   {% asRR %}
hinfo    -> "HINFO"  __ (wordchars):+ __ (wordchars):+
                     _ (comment):? eol                            {% asRR %}
loc      -> "LOC"    __ uint (__ uint):? (__ udec __):? ("N" | "S")
                     __ uint (__ uint):? (__ udec __):? ("E" | "W")
                     __ (word "m") times_3[(__ (word "m")):?]
                     _ (comment):? eol                            {% asRR %}
mx       -> "MX"     __ uint __ hostname _ (comment):? eol        {% asRR %}
naptr    -> "NAPTR"  __ uint __ uint __ dqstring __ dqstring
                     __ word __ word _ (comment):? eol            {% asRR %}
ns       -> "NS"     __ hostname _ (comment):? _ eol              {% asRR %}
ptr      -> "PTR"    __ hostname _ (comment):? _ eol              {% asRR %}
rrsig    -> "RRSIG"  __ word __ word __ uint __ ttl __ uint __ "("
                     _ uint __ uint __ hostname __ (BASE64):+
                    _ ")" _ (comment):? _ eol                     {% asRR %}
smimea   -> "SMIMEA" __ uint __ uint __ uint __ "(" _ (HEX_WS):+
                     _ ")" _ (comment):? _ eol                    {% asRR %}
soa      -> "SOA"    __ hostname __ hostname __ "("
                     ws uint (ws comment):?
                     ws uint (ws comment):?
                     ws uint (ws comment):?
                     ws uint (ws comment):?
                     ws uint (ws comment):?
                     ws ")" (ws comment):? eol                       {% asRR %}
spf      -> "SPF"    __ (dqstring _):+ (comment):? _ eol            {% asRR %}
srv      -> "SRV"    __ uint __ uint __ uint __ hostname _ (comment):? _ eol {% asRR %}
sshfp    -> "SSHFP"  __ uint __ uint (HEX_WS):+ _ (comment):? _ eol {% asRR %}
tlsa     -> "TLSA"   __ uint __ uint __ uint __ "(" _ (HEX_WS):+ _ ")" _ (comment):? _ eol {% asRR %}
txt      -> "TXT"    __ (dqstring _):+ (comment):? _ eol            {% asRR %}
uri      -> "URI"    __ uint __ uint __ dqstring (comment):? _ eol  {% asRR %}



@{%
function flat (d) {
  if (!d) return ''
  return Array.isArray(d) ? d.flat(Infinity) : d
}

function flatten (d) {
  if (!d) return ''
  return Array.isArray(d) ? d.flat(Infinity).join('') : d
}

function asNull   (d) { return null; }
function asString (d) { return d[0].join(''); }
function asUint   (d) {
  return Array.isArray(d[0])     ? parseInt(d[0].join('')) : parseInt(d[0], 10)
}
function asUDec   (d) {
  return parseFloat(d[0].join('') + (d[1] ? `.${d[1][1].join('')}` : ''))
}

function asZoneTTL (d) {
  const r = { $TTL   : parseInt(d[2], 10) }
  if (d[4]) r.comment = flatten(d[4])
  return r
}
function asOrigin (d) { return { $ORIGIN: d[2] } }

function asRR (d) {
  switch (d[0]) {
    case 'A':
      return { type: d[0], address: d[2] }
    case 'AAAA':
      return { type: d[0], address: d[2] }
    case 'CAA':
      return { type: d[0], flags: parseInt(d[2]), tag: d[4], value: flatten(d[6]) }
    case 'CNAME':
      return { type: d[0], cname: d[2] }
    case 'DNAME':
      return { type: d[0], target: d[2] }
    case 'DNSKEY':
      return {
        type: d[0],
        flags: d[2],
        protocol: d[4],
        algorithm: d[6],
        publickey: flatten(d[10]).split(/\s+/).join(''),
      }
    case 'DS':
      return {
        type: d[0],
        'key tag': d[2],
        algorithm: d[4],
        'digest type': d[6],
        digest: flatten(d[10]).split(/\s+/).join(''),
      }
    case 'HINFO':
      return {
        type: d[0],
        cpu : flatten(d[2]),
        os  : flatten(d[4]),
      }
    case 'LOC':
      return {
        type: d[0],
        latitude: {
          degrees: d[2],
          minutes: d[3][1],
          seconds: d[4][1],
          hemisphere: d[5][0],
        },
        longitude: {
          degrees: d[7],
          minutes: d[8][1] || 0,
          seconds: d[9][1] || 0,
          hemisphere: d[10][0],  // E | W
        },
        altitude: flatten(d[12]),
        size    : flatten(d[13][0]) || '1m',
        precision: {
          horizontal: flatten(d[13][1]) || '10000m',
          vertical:   flatten(d[13][2]) || '10m',
        },
      }
    case 'MX':
      return {
        type      : d[0],
        preference: d[2],
        exchange  : d[4],
      }
    case 'NAPTR':
      return {
        type: d[0],
        order: d[2],
        preference: d[4],
        flags: d[6],
        service: d[8],
        regexp: d[10],
        replacement: d[12],
      }
    case 'NS':
      return {
        type: d[0],
        dname: d[2],
      }
    case 'PTR':
      return {
        type : d[0],
        dname: d[2],
      }
    case 'RRSIG':
      return {
        type: d[0],
        'type covered': d[2],
        algorithm     : d[4],
        labels        : d[6],
        'original ttl': d[8],
        'signature expiration': d[10],
        'signature inception': d[14],
        'key tag': d[16],
        'signers name': d[18],
        'signature': flatten(d[20]).split(/\s+/).join(''),
      }
    case 'SOA':
      return {
        type   : d[0],
        comment: {
          serial : flatten(d[9]),
          refresh: flatten(d[12]),
          retry  : flatten(d[15]),
          expire : flatten(d[18]),
          minimum: flatten(d[21]),
        },
        mname  : d[2],
        rname  : d[4],
        serial : parseInt(d[8], 10),
        refresh: parseInt(d[11], 10),
        retry  : parseInt(d[14], 10),
        expire : parseInt(d[17], 10),
        minimum: parseInt(d[20], 10),
      }
    case 'SMIMEA':
      return {
        type: d[0],
        'certificate usage': d[2],
        selector: d[4],
        'matching type': d[6],
        'certificate association data': flatten(d[10]).split(/\s+/).join(''),
      }
    case 'SPF':
      return {
        type: d[0],
        data: d[2].map(e => e[0]),
      }
    case 'SRV':
      return {
        type    : d[0],
        priority: d[2],
        port    : d[4],
        weight  : d[6],
        target  : d[8],
      }
    case 'SSHFP':
      return {
        type: d[0],
        algorithm: d[2],
        fptype: d[4],
        fingerprint: flatten(d[5]).split(/\s+/).join(''),
      }
    case 'TLSA':
      return {
        type: d[0],
        'certificate usage': d[2],
        selector: d[4],
        'matching type': d[6],
        'certificate association data': flatten(d[10]).split(/\s+/).join(''),
      }
    case 'TXT':
      return {
        type: d[0],
        data: d[2].map(e => e[0]),
      }
    case 'URI':
      return {
        type    : d[0],
        priority: d[2],
        weight  : d[4],
        target  : d[6],
      }
    default:
      throw new Error(`undefined type: ${d[0]}`)
  }
}
%}