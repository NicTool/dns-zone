#!/usr/local/bin/node

import fs   from 'fs/promises'
import path from 'path'
import os   from 'os'

import chalk from 'chalk'
import cmdLineArgs from 'command-line-args'
import cmdLineUsage from 'command-line-usage'

import ZONE         from '../lib/zone.js'
import * as bind    from '../lib/bind.js'
import * as tinydns from '../lib/tinydns.js'
import * as maradns from '../lib/maradns.js'

import * as RR from 'dns-resource-record'

const rr = new RR.A(null)

// CLI argument processing
const opts = cmdLineArgs(usageOptions())._all
if (opts.verbose) console.error(opts)
if (opts.help) usage(0)

const optsObj = {
  origin: rr.fullyQualify(opts.origin) || '',
  ttl   : opts.ttl || 0,
  class : opts.class || 'IN',
  hide  : {
    class    : opts['hide-class'],
    ttl      : opts['hide-ttl'],
    origin   : opts['hide-origin'],
    sameOwner: opts['hide-same-owner'],
  },
  verbose: opts.verbose,
}
Object.assign(bind.zoneOpts, optsObj)
Object.assign(maradns.zoneOpts, optsObj)

if (opts.verbose) console.error(bind.zoneOpts)

ingestZoneData()
  .then(r => {
    switch (r.type) {
      case 'tinydns':
        return tinydns.parseData(r.data).then(checkZone)
      case 'maradns':
        return maradns.parseZoneFile(r.data).then(checkZone)
      default:
        return bind.parseZoneFile(r.data).then(checkZone)
    }
  })
  .then(output)
  .catch(e => {
    console.error(e.message)
  })


function checkZone (zoneArray) {
  return new Promise((resolve, reject) => {
    try {
      new ZONE({
        ttl: optsObj.ttl, origin: optsObj.origin, RR: zoneArray,
      })
      // console.log(z)
      resolve(zoneArray)
    }
    catch (e) {
      // console.error(e)
      reject(e)
    }
  })
}

function usage (code) {
  if (code === 0) {
    console.log(cmdLineUsage(usageSections()))
  }
  else {
    console.error(cmdLineUsage(usageSections()))
  }
  process.exit(code)
}

function usageOptions () {
  return [
    {
      name        : 'import',
      alias       : 'i',
      defaultValue: 'bind',
      type        : String,
      typeLabel   : '<json | bind | maradns | tinydns>',
      description : 'zone data format',
      group       : 'io',
    },
    {
      name        : 'export',
      alias       : 'e',
      defaultValue: 'js',
      type        : String,
      typeLabel   : '<json | bind | maradns | tinydns>',
      description : 'zone data format',
      group       : 'io',
    },
    {
      name        : 'file',
      alias       : 'f',
      defaultValue: '',
      type        : String,
      typeLabel   : '<file path | - (stdin)>',
      description : 'source of DNS zone data',
      group       : 'io',
    },
    {
      name       : 'origin',
      alias       : 'o',
      type       : String,
      description: 'zone $ORIGIN',
      group       : 'main',
    },
    {
      name       : 'ttl',
      alias      : 't',
      type       : Number,
      description: 'zone default TTL',
      group       : 'main',
    },
    {
      name        : 'class',
      alias       : 'c',
      defaultValue: 'IN',
      type        : String,
      description : 'zone class (IN)',
      group       : 'main',
    },
    {
      name        : 'hide-origin',
      defaultValue: false,
      type        : Boolean,
      // typeLabel   : '',
      description : 'remove origin from RR domain names',
      group       : 'out',
    },
    {
      name        : 'hide-class',
      defaultValue: false,
      type        : Boolean,
      // typeLabel   : '',
      description : 'hide class',
      group       : 'out',
    },
    {
      name        : 'hide-ttl',
      defaultValue: false,
      type        : Boolean,
      // typeLabel   : '',
      description : 'hide TTLs',
      group       : 'out',
    },
    {
      name        : 'hide-same-owner',
      defaultValue: false,
      type        : Boolean,
      description : 'hide owner when same as previous RR',
      group       : 'out',
    },
    {
      name       : 'verbose',
      alias      : 'v',
      description: 'Show status messages during processing',
      type       : Boolean,
    },
    {
      name       : 'help',
      description: 'Display this usage guide',
      alias      : 'h',
      type       : Boolean,
    },
  ]
}

function usageSections () {
  return [
    {
      content: chalk.blue(` +-+-+-+ +-+-+-+-+\n |D|N|S| |Z|O|N|E|\n +-+-+-+ +-+-+-+-+`),
      raw    : true,
    },
    {
      header    : 'I/O',
      optionList: usageOptions(),
      group     : 'io',
    },
    {
      header    : 'Zone Settings',
      optionList: usageOptions(),
      group     : 'main',
    },
    {
      header    : 'Output Options',
      optionList: usageOptions(),
      group     : 'out',
    },
    {
      header    : 'Misc',
      optionList: usageOptions(),
      group     : '_none',
    },
    {
      header : 'Examples',
      content: [
        {
          desc   : '1. BIND file to human',
          example: './bin/dns-zone -i bind -f isi.edu',
        },
        {
          desc   : '2. BIND file to tinydns',
          example: './bin/dns-zone -i bind -f isi.edu -e tinydns',
        },
        {
          desc   : '3. tinydns file to BIND',
          example: './bin/dns-zone -i tinydns -f data -e bind',
        },
      ],
    },
    {
      content: 'Project home: {underline https://github.com/NicTool/dns-zone}',
    },
  ]
}

function ingestZoneData () {
  return new Promise((resolve, reject) => {

    if (!opts.import) usage(1)
    if (!opts.file) usage(1)

    let filePath = opts.file

    if (filePath === '-') {
      filePath = '/dev/stdin' // process.stdin.fd
    }
    else {
      if (!bind.zoneOpts.origin) bind.zoneOpts.origin = rr.fullyQualify(path.basename(filePath))
    }

    if (opts.verbose) console.error(`reading file ${filePath}`)

    fs.readFile(filePath).then(buf => {
      resolve({
        type: opts.import,
        data: buf.toString(),
      })
    }).catch(reject)
  })
}

function output (zoneArray) {
  // console.error(zoneArray)
  switch (opts.export.toLowerCase()) {
    case 'json'   : return toJSON(zoneArray)
    case 'bind'   : return toBind(zoneArray, bind.zoneOpts.origin)
    case 'tinydns': return toTinydns(zoneArray)
    case 'maradns': return toMaraDNS(zoneArray)
    default:
      toHuman(zoneArray)
  }
}

function isBlank (rr) {
  if (rr === os.EOL) {
    process.stdout.write(rr)
    return true
  }
}

function toBind (zoneArray, origin) {
  for (const rr of zoneArray) {
    if (isBlank(rr)) continue
    if (!rr.toBind) {
      process.stdout.write(`${Object.keys(rr)[0]} ${Object.values(rr)[0]}\n`)
      continue
    }
    process.stdout.write(rr.toBind(bind.zoneOpts))
    bind.zoneOpts.previousOwner = rr.get('owner')
  }
}

function toTinydns (zoneArray) {
  for (const rr of zoneArray) {
    if (rr === os.EOL) continue
    if (rr.$TTL || rr.$ORIGIN) continue
    try {
      process.stdout.write(rr.toTinydns())
    }
    catch (e) {
      console.error(rr)
      throw e
    }
  }
}

function toJSON (zoneArray) {
  for (const rr of zoneArray) {
    if (isBlank(rr)) continue
    if (rr.get('comment')) rr.delete('comment')
    process.stdout.write(JSON.stringify(Object.fromEntries(rr)))
  }
}

function toHuman (zoneArray) {
  const widest = { owner: 0, ttl: 0, type: 0, rdata: 0 }
  const fields = [ 'owner', 'ttl', 'type' ]
  zoneArray.map(r => {
    if (r === os.EOL) return
    if (!r.get) return
    for (const f of fields) {
      if (getWidth(r.get(f)) > widest[f]) widest[f] = getWidth(r.get(f))
    }
    const rdataLen = r.getRdataFields().map(f => r.get(f)).join(' ').length
    if (rdataLen > widest.rdata) widest.rdata = rdataLen
  })

  // console.log(widest)
  let rdataWidth = process.stdout.columns - widest.owner - widest.type - 10
  if (!bind.zoneOpts.hide.ttl) rdataWidth -= widest.ttl

  for (const r of zoneArray) {
    if (isBlank(r)) continue
    if (!r.get) {
      process.stdout.write(`${Object.keys(r)[0]} ${Object.values(r)[0]}\n`)
      continue
    }

    process.stdout.write(r.get('owner').padEnd(widest.owner + 2, ' '))

    if (!bind.zoneOpts.hide.ttl) {
      process.stdout.write(r.get('ttl').toString().padStart(widest.ttl, ' ') + '  ')
    }

    process.stdout.write(r.get('type').padEnd(widest.type + 2, ' '))

    const rdata = r.getRdataFields().map(f => r.get(f)).join(' ')
    process.stdout.write(rdata.substring(0, rdataWidth))
    if (rdata.length > rdataWidth) process.stdout.write('...')

    process.stdout.write('\n')
  }
}

function toMaraDNS (zoneArray) {
  for (const rr of zoneArray) {
    if (rr === os.EOL) continue
    if (rr.$TTL) {
      process.stdout.write(`/ttl ${rr.$TTL}\n`); continue
    }
    if (rr.$ORIGIN) {
      process.stdout.write(`/origin ${rr.$ORIGIN}\n`); continue
    }
    process.stdout.write(rr.toMaraDNS())
  }
}

function getWidth (str) {
  // console.log(str)
  if ('number' === typeof (str)) return str.toString().length
  return str.length
}