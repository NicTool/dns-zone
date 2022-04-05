@builtin "string.ne"

main            -> entry:*  {% id %}
entry           -> blank {% id %} | comment {% id %} | rr {% id %}

blank           -> _ (comment):? eol         {% flatten %}
comment         -> "#" anyToEOL eol          {% flatten %}
ttl             -> uint                      {% asUint %}
serialauto      -> "/serial"                 {% flatten %}
ttldefault      -> "/ttl"                    {% flatten %}
class           -> "IN"                      {% id %}

rr              -> hostname __    (comment eol _):?
                   ("+" ttl __):? (comment eol _):?
                   (class   __):? (comment eol _):?
                   rr_type  __    (comment eol _):? "~" (_ comment):? {% asRR %}

times_3[X]      -> $X $X $X

eol             -> [\n\r]
_               -> wschar:*                  {% asNull %}
__              -> wschar:+ | "|"            {% asNull %}
wschar          -> [ \t\v\f]                 {% id %}
anyToEOL        -> [^\n\r]:*
hostname        -> host_char:+               {% asString %}
host_char       -> [0-9A-Za-z\u0080-\uFFFF\.\-_@\\%] {% id %}
ip6_chars       -> [0-9A-Fa-f:]:*            {% id %}
digit           -> [0-9]                     {% id %}
uint            -> [0-9]:+                   {% asUint %}
udec            -> [0-9]:+ ("." [0-9]:+):?   {% asUDec %}
ip4             -> int8 times_3["."  int8]   {% flatten %}
ip6             -> ip6_chars                 {% flatten %}
int8            -> digit | [1-9] digit | "1" digit digit | "2" [0-4] digit | "25" [0-5]
hex             -> [a-fA-F0-9]
word            -> (wordchars):+             {% flatten %}
wordchars       -> [^\s]                     {% id %}

txt_no_ws       -> [A-Za-z0-9\-_+%!^=]       {% id %}

sq_str_chars    -> [!"$%&(-{! }]             {% id %}
                 | ("\\'" | "\\" [\s] | "\\" digit digit digit digit) {% id %}

txt_sq_str      -> "'"  sqchars:* "'"        {% (d) => {return d[1].join(""); } %}
sqchars         -> [^\\'\n\r]                {% id %}
                 | "\\" strescape {% (d) => { return JSON.parse("\""+d.join("")+"\""); } %}
                 | "\\'"                     {% (d) => { return "'"; } %}
strescape       -> ["\\/bfnrt]                {% id %}
                 | "u" hex hex hex hex {% (d) => { return d.join(""); } %}

txt_comment     -> "\\" _ (comment):? eol _

rr_type         -> a     {% id %} | aaaa {% id %} | fqdn4 {% id %} | fqdn6   {% id %}
                 | hinfo {% id %} | loc  {% id %} | mx    {% id %} | naptr   {% id %}
                 | ns    {% id %} | ptr  {% id %} | raw   {% id %} | soa     {% id %}
                 | srv   {% id %} | txt  {% id %} | spf   {% id %} | default {% id %}

a        -> "A"i    (__ comment eol):? __ ip4 _ (comment):?             {% asRdata %}
default  ->             ip4 _ (comment):?                               {% asRdata %}
aaaa     -> "AAAA"i  __ ip6 _ (comment):?                               {% asRdata %}
fqdn4    -> "FQDN4"i __ ip4 _ (comment):?                               {% asRdata %}
fqdn6    -> "FQDN6"i __ ip6 _ (comment):?                               {% asRdata %}
hinfo    -> "HINFO"i __ sqstring ";" sqstring _ (comment):?             {% asRdata %}
loc      -> "LOC"i   __ uint (__ uint):? (__ udec __):? ("N" | "S")
                     __ uint (__ uint):? (__ udec __):? ("E" | "W")
                     __ (word "m") (__ word "m"):? (__ word "m"):? (__ word "m"):?  {% asRdata %}
mx       -> "MX"i    __ uint __ hostname _ (comment):?                  {% asRdata %}
naptr    -> "NAPTR"i __ uint __ uint __ sqstring ";" sqstring ";" sqstring _ word {% asRdata %}
ns       -> "NS"i    __ hostname _ (comment):?                          {% asRdata %}
ptr      -> "PTR"i   __ hostname _ (comment):?                          {% asRdata %}
raw      -> "RAW"i   __ uint __ anyToEOL                                {% asRdata %}
soa      -> "SOA"i   __ hostname __ hostname __ (uint | serialauto)
                        __ uint __ uint __ uint __ uint                 {% asRdata %}
spf      -> "SPF"i   __ sqstring ("\\x7e" sqstring):* _ (comment):?     {% asRdata %}
srv      -> "SRV"i   __ uint __ uint __ uint __ hostname _ (comment):?  {% asRdata %}
txt      -> "TXT"i   __ (  (txt_no_ws | txt_sq_str) txt_comment:?)
                        (_ (txt_no_ws | txt_sq_str) txt_comment:?):*    {% asRdata %}

@{%
function asRR (d) {
  if (!d) return ''
  if (!Array.isArray(d)) return ''
  return {
    owner: d[0],
    ...(d[3] && d[3][1] ? { 'ttl'  : d[3][1] } : {}),
  ...(d[5] && d[5][0] ? { 'class': d[5][0] } : {}),
  ...d[7],
  }
}
function flatten (d) {
  if (!d) return ''
  return Array.isArray(d) ? d.flat(Infinity).join('') : d
}
function asNull   (d) { return null; }
function asString (d) { return d[0].join(''); }
function asUint   (d) {
  return Array.isArray(d[0]) ? parseInt(d[0].join('')) : parseInt(d[0], 10)
}
function asUDec   (d) {
  return parseFloat(d[0].join('') + (d[1] ? `.${d[1][1].join('')}` : ''))
}
function asRdata (d) {
  const r = { type: d[0].toUpperCase() }
  switch (r.type) {
    case 'A'    : return { ...r, address: d[3] }
    case 'FQDN4': return { ...r, address: d[2] }
    case 'AAAA' : return { ...r, address: d[2] }
    case 'FQDN6': return { ...r, address: d[2] }
    case 'CAA':
      return { ...r, flags: parseInt(d[2]), tag: d[4], value: flatten(d[6]) }
    case 'CNAME': return { ...r, cname: d[2] }
    case 'HINFO': return { ...r, cpu: flatten(d[2]), os: flatten(d[4]) }
    case 'LOC':
      return {
        ...r,
        latitude: {
          degrees: flatten(d[2]),
          minutes: parseInt(flatten(d[3])),
          seconds: parseFloat(flatten(d[4]).trim()),
          hemisphere: flatten(d[5]),
        },
        longitude: {
          degrees: flatten(d[7]),
          minutes: parseInt(flatten(d[8])),
          seconds: parseFloat(flatten(d[9])),
          hemisphere: flatten(d[10]),  // E | W
        },
        altitude: flatten(d[12]),
        size    : flatten(d[13]).trim() || '1m',
        precision: {
          horizontal: flatten(d[14]).trim() || '10000m',
          vertical:   flatten(d[15]).trim() || '10m',
        },
      }
    case 'MX' : return { ...r, preference: d[2], exchange: d[4] }
    case 'NAPTR':
      return {
        ...r,
        order: d[2],
        preference: d[4],
        flags: d[6].toUpperCase(),
        service: d[8],
        regexp: d[10],
        replacement: d[12],
      }
    case 'NS' : return { ...r, dname: d[2] }
    case 'PTR': return { ...r, dname: d[2] }
    case 'RAW': return { ...r, typeid: flatten(d[2]), rdata: flatten(d[4]) }
    case 'SOA':
      return {
        ...r,
        mname  : d[2],
        rname  : d[4],
        serial : d[6][0],
        refresh: parseInt(d[8], 10),
        retry  : parseInt(d[10], 10),
        expire : parseInt(d[12], 10),
        minimum: parseInt(d[14], 10),
        comment: {
          serial : flatten(d[7]),
          refresh: flatten(d[9]),
          retry  : flatten(d[11]),
          expire : flatten(d[13]),
          minimum: flatten(d[15]),
        },
      }
    case 'SMIMEA':
      return {
        ...r,
        'certificate usage': d[2],
        selector: d[4],
        'matching type': d[6],
        'certificate association data': flatten(d[10]).split(/\s+/).join(''),
      }
    case 'SPF':
      return { ...r, data: `${d[2]}${d[3]}` }
    case 'SRV':
      return {
        ...r,
        priority: d[2],
        port    : d[4],
        weight  : d[6],
        target  : d[8],
      }
    case 'SSHFP':
      return {
        ...r,
        algorithm: d[2],
        fptype: d[4],
        fingerprint: flatten(d[5]).split(/\s+/).join(''),
      }
    case 'TLSA':
      return {
        ...r,
        'certificate usage': d[2],
        selector: d[4],
        'matching type': d[6],
        'certificate association data': flatten(d[10]).split(/\s+/).join(''),
      }
    case 'TXT':
      return {
        ...r,
        data: [ flatten(d[2]) + flatten(d[3]) ],
      }
    case 'URI':
      return {
        ...r,
        priority: d[2],
        weight  : d[4],
        target  : d[6],
      }
    default:
      // console.dir(d, { depth: null })
      const ip4re = /[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/
      if (ip4re.test(d[0])) {
        return { type: 'A', address: d[0] }
      }
      throw new Error(`undefined type: ${d[0]}`)
  }
}
%}