@builtin "string.ne"

main            -> entry:*
entry           -> blank | comment | rr

blank           -> _ (comment):? eol         {% flatten %}
comment         -> "#" anyToEOL              {% flatten %}
ttl             -> uint                      {% flatten %}
serialauto      -> "/serial"                 {% flatten %}
ttldefault      -> "/ttl"                    {% flatten %}

rr              -> hostname __ ("+" ttl __):? rr_type __ "~" (comment):?

times_3[X]      -> $X $X $X

eol             -> [\n\r]
_               -> wschar:*                  {% asNull %}
__              -> wschar:+ | "|"            {% asNull %}
wschar          -> [ \t\v\f]                 {% id %}
anyToEOL        -> [^\n\r]:*
hostname        -> host_char:*               {% asString %}
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

txt_bare        -> txt_no_ws:+               {% flatten %}
txt_no_ws       -> [A-Za-z0-9\-_+%!^=]       {% id %}

txt_sqword      -> "'" sq_str_chars:* "'"    {% flatten %}
sq_str_chars    -> [!"$%&(-{! }]             {% id %}
                 | ("\\'" | "\\" [\s] | "\\" digit digit digit digit)

txt_sq_str      -> "'"  sqchars:* "'"        {% (d) => {return d[1].join(""); } %}
sqchars         -> [^\\'\n\r]                {% id %}
                 | "\\" strescape {% (d) => { return JSON.parse("\""+d.join("")+"\""); } %}
                 | "\\'"                     {% (d) => { return "'"; } %}
strescape       -> ["\\/bfnrt]                {% id %}
                 | "u" hex hex hex hex {% (d) => { return d.join(""); } %}
#asciiprintable -> [ -~]

txt_comment     -> "\\" _ (comment):? eol _

rr_type         -> a | aaaa | fqdn4 | fqdn6 | hinfo | loc | naptr
                 | ns | ptr | raw | soa | srv | txt | spf

a        -> "A"i     __ ip4 _ (comment):?          {% asRR %}
#rr_d    ->             ip4 _ (comment):?          {% asRR %}
aaaa     -> "AAAA"i  __ ip6 _ (comment):?          {% asRR %}
fqdn4    -> "FQDN4"i __ ip4 _ (comment):?          {% asRR %}
fqdn6    -> "FQDN6"i __ ip6 _ (comment):?          {% asRR %}
hinfo    -> "HINFO"i __ sqstring ";" sqstring _ (comment):?  {% asRR %}
loc      -> "LOC"i   __ uint (__ uint):? (__ udec __):? ("N" | "S")
                     __ uint (__ uint):? (__ udec __):? ("E" | "W")
                     __ (word "m") (__ word "m"):? (__ word "m"):? (__ word "m"):?  {% asRR %}
naptr    -> "NAPTR"i __ uint __ uint __ sqstring ";" sqstring ";" sqstring _ word {% asRR %}
ns       -> "NS"i    __ hostname _ (comment):?     {% asRR %}
ptr      -> "PTR"i   __ hostname _ (comment):?       {% asRR %}
raw      -> "RAW"i   __ uint __ anyToEOL {% asRR %}
soa      -> "SOA"i   __ hostname __ hostname __ (uint | serialauto)
                        __ uint __ uint __ uint __ uint                 {% asRR %}
spf      -> "SPF"i   __ sqstring ("\\x7e" sqstring):* _ (comment):?
srv      -> "SRV"i   __ uint __ uint __ uint __ hostname _ (comment):?  {% asRR %}
txt      -> "TXT"i   __ (  (txt_no_ws | txt_sq_str) txt_comment:?)
                        (_ (txt_no_ws | txt_sq_str) txt_comment:?):*    {% asRR %}


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
  return Array.isArray(d[0]) ? parseInt(d[0].join('')) : parseInt(d[0], 10)
}
function asUDec   (d) {
  return parseFloat(d[0].join('') + (d[1] ? `.${d[1][1].join('')}` : ''))
}
function asRR (d) {
  const r = { type: d[0].toUpperCase() }
  switch (r.type) {
    case 'A':     return { ...r, address: d[2] }
    case 'FQDN4': return { ...r, address: d[2] }
    case 'AAAA':  return { ...r, address: d[2] }
    case 'FQDN6': return { ...r, address: d[2] }
    case 'CAA':
      return { ...r, flags: parseInt(d[2]), tag: d[4], value: flatten(d[6]) }
    case 'CNAME': return { ...r, cname: d[2] }
    case 'HINFO':
      return {
        ...r,
        cpu : flatten(d[2]),
        os  : flatten(d[4]),
      }
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
    case 'MX':
      return {
        type      : d[0],
        preference: d[2],
        exchange  : d[4],
      }
    case 'NAPTR':
      return {
        ...r,
        order: d[2],
        preference: d[4],
        flags: d[6],
        service: d[8],
        regexp: d[10],
        replacement: d[12],
      }
    case 'NS': return { ...r, dname: d[2] }
    case 'PTR':
      return {
        type : d[0],
        dname: d[2],
      }
    case 'RAW': return { ...r, typeid: flatten(d[2]), rdata: flatten(d[4]) }
    case 'SOA':
      return {
        type   : d[0],
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
      return {
        ...r,
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
        type    : d[0],
        priority: d[2],
        weight  : d[4],
        target  : d[6],
      }
    default:
      if (/[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/.test(d[0])) {
        return { type: 'A', address: d[2] }
      }
      throw new Error(`undefined type: ${d[0]}`)
  }
}
%}