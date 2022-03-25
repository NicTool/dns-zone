# This is a parser, not a validator. Don't go crazy with rules here,
# we validate after parsing

@builtin "string.ne"

main            -> (statement eol):+

statement       -> blank | ttl | origin | a | aaaa | caa | cname | dname | dnskey |
                  ds | hinfo | loc | mx | ns | ptr | soa | txt

times_3[X]      -> $X $X $X
eol             -> "\n" | "\r"

blank           -> _

comment         -> ";" [^\n\r]:*

ttl             -> "$TTL" __ uint _ (comment):? _           {% asTTL %}

origin          -> "$ORIGIN" __ hostname _ (comment):? _    {% asOrigin %}

a               -> hostname (__ uint):? (__ class):? __ "A"
                   __ ip4 _ (comment):? _                    {% asRR %}

aaaa            -> hostname (__ uint):? (__ class):? __ "AAAA"
                   __ ip6 _ (comment):? _                    {% asRR %}

caa             -> hostname (__ uint):? (__ class):? __ "CAA"
                   __ uint __ (ALPHA_LC_NUM):+ __ QUOTE_OR_NO_WS _ (comment):? _ {% asRR %}

cname           -> hostname (__ uint):? (__ class):? __ "CNAME"
                   __ hostname _ (comment):? _               {% asRR %}

dname           -> hostname (__ uint):? (__ class):? __ "DNAME"
                   __ hostname _ (comment):? _               {% asRR %}

dnskey          -> hostname (__ uint):? (__ class):? __ "DNSKEY"
                   __ uint __ uint __ uint __
                   "(" _ (BASE64):+ _ ")" _ (comment):? _    {% asRR %}

ds              -> hostname (__ uint):? (__ class):? __ "DS"
                   __ uint __ uint __ uint __
                   "(" _ (HEX_WS):+ _ ")" _ (comment):?   {% asRR %}

hinfo           -> hostname (__ uint):? (__ class):? __ "HINFO"
                   __ (wordchars):+ __ (wordchars):+
                   _ (comment):?                             {% asRR %}

loc             -> hostname (__ uint):? (__ class):? __ "LOC"
                   __ uint (__ uint):? (__ udec __):? ("N" | "S")
                   __ uint (__ uint):? (__ udec __):? ("E" | "W")
                   __ (word "m") times_3[(__ (word "m")):?]
                   _ (comment):?                 {% asRR %}

mx              -> hostname (__ uint):? (__ class):? __ "MX"
                   __ uint __ hostname _ (comment):?         {% asRR %}

#naptr           -> hostname (__ uint):? (__ class):? __ "NAPTR"
                   #__ uint __ uint __ QUOTED __ QUOTED
                   #__ QUOTED __ replacement _ (comment):?   {% asRR %}

ns              -> hostname (__ uint):? (__ class):? __ "NS"
                   __ hostname _ (comment):? _               {% asRR %}

ptr             -> hostname (__ uint):? (__ class):? __ "PTR"
                   __ hostname _ (comment):? _               {% asRR %}

#rrsig           -> hostname (__ uint):? (__ class):? __ "RRSIG"

#smimea          -> hostname (__ uint):? (__ class):? __ "SMIMEA"

soa             -> hostname ( __ uint ):? ( __ class ):? __ "SOA"
                   __ hostname __ hostname __ "("
                     _ uint (ws comment):?
                     __ uint (ws comment):?
                     __ uint (ws comment):?
                     __ uint (ws comment):?
                     __ uint (ws comment):?
                   _ ")" _ (comment):?                       {% asRR %}

#spf             -> hostname (__ uint):? (__ class):? __ "SPF"
#srv             -> hostname (__ uint):? (__ class):? __ "SRV"
#sshfp           -> hostname (__ uint):? (__ class):? __ "SSHFP"
#tlsa            -> hostname (__ uint):? (__ class):? __ "TLSA"

txt             -> hostname (__ uint):? (__ class):? __ "TXT"
                   __ (dqstring _):+ (comment):? _           {% asRR %}

#uri            -> hostname (__ uint):? (__ class):? __ "URI"

uint            -> [0-9]:+                                  {% asUint %}
udec            -> [0-9]:+ ("." [0-9]:+):?                  {% asUDec %}

hostname        -> ALPHA_NUM_DASH_U:* {% asString %}

class           -> "IN" | "CS" | "CH" | "HS" | "NONE" | "ANY"

word            -> (wordchars):+   {% flatten %}
wordchars       -> [^\s] {% id %}

#times_3[X]      -> $X $X $X
times_5[X]      -> $X $X $X $X $X
times_7[X]      -> $X $X $X $X $X $X $X

ip4             -> int8 times_3["."  int8]   {% flatten %}

ip6             -> ip6_full | ip6_compressed | IPv6v4_full | IPv6v4_comp

int8            -> DIGIT |
                   [1-9] DIGIT |
                   "1" DIGIT DIGIT |
                   "2" [0-4] DIGIT |
                   "25" [0-5]

ALPHA_LC_NUM    -> [0-9a-z]                       {% id %}
ALPHA_NUM_DASH_U-> [0-9A-Za-z\u0080-\uFFFF\.\-_@] {% id %}
DIGIT           -> [0-9]             {% id %}
HEXDIG          -> [0-9A-Fa-f]       {% id %}
HEX_WS          -> [0-9A-Fa-f\s]     {% id %}
BASE64          -> [A-Za-z0-9+/=\s]  {% id %}
#BASE64_URL_SAFE-> [A-Za-z0-9_\-=\s]  {% id %}
QUOTED          -> ("\"" ([^\\"]):+ "\"") | ("'" ([^\\"]):+ "'")
QUOTE_OR_NO_WS  -> "\"" ([^\\"]):+ "\"" | "'" ([^\\"]):+ "'" | ([^\s]):+

IPv6_hex       -> HEXDIG |
                  HEXDIG HEXDIG |
                  HEXDIG HEXDIG HEXDIG |
                  HEXDIG HEXDIG HEXDIG HEXDIG

ip6_full       -> IPv6_hex times_7[":" IPv6_hex] {% flatten %}

ip6_compressed -> "::"                           {% flatten %} |
                  "::" IPv6_hex                  {% flatten %} |
                  IPv6_hex (":" IPv6_hex):* "::" IPv6_hex (":" IPv6_hex):* {% flatten %}

IPv6v4_full    -> IPv6_hex times_5[":" IPv6_hex] ":" ip4                   {% flatten %}

IPv6v4_comp    -> (IPv6_hex times_3[":" IPv6_hex]):? "::"
                  (IPv6_hex times_3[":" IPv6_hex] ":"):? ip4               {% flatten %}

# Whitespace: `_` is optional, `__` is mandatory.
_  -> wschar:* {% asNull %}
__ -> wschar:+ {% asNull %}
ws -> wschar:* {% id %}

wschar -> [ \t\n\r\v\f] {% id %}

@{%
function flatten (d) {
  if (!d) return ''
  if (Array.isArray(d)) return d.flat(Infinity).join('')
  return d
}

function asNull   (d) { return null; }
function asString (d) { return d[0].join(''); }
function asUint   (d) { return parseInt(d[0].join('')) }
function asUDec   (d) {
  return parseFloat(d[0].join('') + (d[1] ? `.${d[1][1].join('')}` : ''))
}

function asTTL    (d) { return { $TTL: parseInt(flatten(d[2]), 10) }; }
function asOrigin (d) { return { $ORIGIN: d[2] }; }

function asRR (d) {
  const r = {
    name:  d[0],
    ttl :  d[1] ? d[1][1]    : d[1],
    class: d[2] ? d[2][1][0] : d[2],
    type:  d[4],
  }

  switch (r.type) {
    case 'A':
      r.address = d[6]
      break
    case 'AAAA':
      r.address = d[6][0]
      break
    case 'CAA':
      r.flags = d[6]
      r.tag   = flatten(d[8])
      r.value = flatten(d[10])
      break
    case 'CNAME':
      r.cname = d[6]
      break
    case 'DNAME':
      r.target = d[6]
      break
    case 'DNSKEY':
      r.flags  = d[6]
      r.protocol = d[8]
      r.algorithm = d[10]
      r.publickey = flatten(d[14]).split(/\s+/).join('')
      break
    case 'DS':
      r['key tag']     = d[6]
      r.algorithm      = d[8]
      r['digest type'] = d[10]
      r.digest = flatten(d[14]).split(/\s+/).join('')
      break
    case 'HINFO':
      r.cpu = flatten(d[6])
      r.os  = flatten(d[8])
      break
    case 'LOC':
      r.latitude = {
        degrees: d[6],
        minutes: d[7][1] || 0,
        seconds: d[8][1] || 0,
        hemisphere: d[9][0],
      }
      r.longitude = {
        degrees: d[11],
        minutes: d[12][1] || 0,
        seconds: d[13][1] || 0,
        hemisphere: d[14][0],  // E | W
      }
      r.altitude = flatten(d[16]),
      r.size     = flatten(d[17]) || '1m',
      r.precision = {
        horizontal: flatten(d[18]) || '10000m',
        vertical:   flatten(d[19]) || '10m',
      }
      break
    case 'MX':
      r.preference = d[6]
      r.exchange  = d[8]
      break
    case 'NS':
      r.dname = d[6]
      break
    case 'PTR':
      r.dname = d[6]
      break
    case 'SOA':
      r.comment = {}
      r.mname   = d[6]
      r.rname   = d[8]
      r.serial  = d[12]
      r.comment.serial = flatten(d[13])
      r.refresh = d[15]
      r.comment.refresh = flatten(d[16])
      r.retry   = d[18]
      r.comment.retry = flatten(d[19])
      r.expire  = d[21]
      r.comment.expire = flatten(d[22])
      r.minimum = d[24]
      r.comment.minimum = flatten(d[25])
      break
    case 'TXT':
      r.data = d[6].map(e => e[0])
      break
    default:
      throw new Error(`undefined type: ${r.type}`)
  }
  return r
}
%}
