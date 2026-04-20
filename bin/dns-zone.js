#!node

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import * as RR from '@nictool/dns-resource-record'
import chalk from 'chalk'
import cmdLineArgs from 'command-line-args'
import cmdLineUsage from 'command-line-usage'

import * as dz from '../index.js'
import * as bind from '../lib/bind.js'
import * as json from '../lib/json.js'
import * as maradns from '../lib/maradns.js'
import * as tinydns from '../lib/tinydns.js'
import ZONE from '../lib/zone.js'

const rr = new RR.A(null)

// CLI argument processing
let opts
try {
  opts = cmdLineArgs(usageOptions())._all
} catch (e) {
  console.error(e.message)
  usage(1)
}
if (opts.verbose) console.error(opts)
if (opts.help) usage(0)

const optsObj = {
  origin: rr.fullyQualify(opts.origin) || '',
  ttl: opts.ttl || 0,
  class: opts.class || 'IN',
  hide: {
    class: opts['hide-class'],
    ttl: opts['hide-ttl'],
    origin: opts['hide-origin'],
    sameOwner: opts['hide-same-owner'],
  },
  verbose: opts.verbose,
}
Object.assign(bind.zoneOpts, optsObj)
Object.assign(maradns.zoneOpts, optsObj)

if (opts.verbose) console.error(bind.zoneOpts)

try {
  const r = await ingestZoneData()
  let zoneArray
  switch (r.type) {
    case 'json':
      zoneArray = checkZone(await json.parseZoneFile(r.data))
      break
    case 'tinydns':
      zoneArray = checkZone(await tinydns.parseData(r.data))
      break
    case 'maradns':
      maradns.zoneOpts.serial = await dz.serialByFileStat(opts.file)
      zoneArray = checkZone(await maradns.parseZoneFile(r.data))
      break
    default:
      zoneArray = checkZone(await bind.parseZoneFile(r.data))
  }
  output(zoneArray)
} catch (e) {
  console.error(e.message)
  process.exitCode = 1
}

function checkZone(zoneArray) {
  const z = new ZONE({
    ttl: optsObj.ttl,
    origin: optsObj.origin,
    RR: zoneArray,
  })
  if (z.errors.length) {
    for (const { rr, error } of z.errors) {
      console.error(error.message)
      if (opts.verbose) console.error(rr)
    }
    throw new Error(`zone validation failed: ${z.errors.length} error(s)`)
  }
  return zoneArray
}

function usage(code) {
  if (code === 0) {
    console.log(cmdLineUsage(usageSections()))
  } else {
    console.error(cmdLineUsage(usageSections()))
  }
  process.exit(code)
}

function usageOptions() {
  return [
    {
      name: 'import',
      alias: 'i',
      defaultValue: 'bind',
      type: String,
      typeLabel: '<json | bind | maradns | tinydns>',
      description: 'zone data format',
      group: 'io',
    },
    {
      name: 'export',
      alias: 'e',
      defaultValue: 'js',
      type: String,
      typeLabel: '<json | bind | maradns | tinydns>',
      description: 'zone data format',
      group: 'io',
    },
    {
      name: 'file',
      alias: 'f',
      defaultValue: '',
      type: String,
      typeLabel: '<file path | - (stdin)>',
      description: 'source of DNS zone data',
      group: 'io',
    },
    {
      name: 'origin',
      alias: 'o',
      type: String,
      description: 'zone $ORIGIN',
      group: 'main',
    },
    {
      name: 'ttl',
      alias: 't',
      type: Number,
      description: 'zone default TTL',
      group: 'main',
    },
    {
      name: 'class',
      alias: 'c',
      defaultValue: 'IN',
      type: String,
      description: 'zone class (IN)',
      group: 'main',
    },
    {
      name: 'hide-origin',
      defaultValue: false,
      type: Boolean,
      // typeLabel   : '',
      description: 'remove origin from RR domain names',
      group: 'out',
    },
    {
      name: 'hide-class',
      defaultValue: false,
      type: Boolean,
      // typeLabel   : '',
      description: 'hide class',
      group: 'out',
    },
    {
      name: 'hide-ttl',
      defaultValue: false,
      type: Boolean,
      // typeLabel   : '',
      description: 'hide TTLs',
      group: 'out',
    },
    {
      name: 'hide-same-owner',
      defaultValue: false,
      type: Boolean,
      description: 'hide owner when same as previous RR',
      group: 'out',
    },
    {
      name: 'verbose',
      alias: 'v',
      description: 'Show status messages during processing',
      type: Boolean,
    },
    {
      name: 'help',
      description: 'Display this usage guide',
      alias: 'h',
      type: Boolean,
    },
  ]
}

function usageSections() {
  return [
    {
      content: chalk.blue(` +-+-+-+ +-+-+-+-+\n |D|N|S| |Z|O|N|E|\n +-+-+-+ +-+-+-+-+`),
      raw: true,
    },
    {
      header: 'I/O',
      optionList: usageOptions(),
      group: 'io',
    },
    {
      header: 'Zone Settings',
      optionList: usageOptions(),
      group: 'main',
    },
    {
      header: 'Output Options',
      optionList: usageOptions(),
      group: 'out',
    },
    {
      header: 'Misc',
      optionList: usageOptions(),
      group: '_none',
    },
    {
      header: 'Examples',
      content: [
        {
          desc: '1. BIND file to human',
          example: './bin/dns-zone -i bind -f isi.edu',
        },
        {
          desc: '2. BIND file to tinydns',
          example: './bin/dns-zone -i bind -f isi.edu -e tinydns',
        },
        {
          desc: '3. tinydns file to BIND',
          example: './bin/dns-zone -i tinydns -f data -e bind',
        },
      ],
    },
    {
      content: 'Project home: {underline https://github.com/NicTool/dns-zone}',
    },
  ]
}

async function ingestZoneData() {
  if (!opts.import) usage(1)
  if (!opts.file) usage(1)

  let raw
  if (opts.file === '-') {
    if (opts.verbose) console.error('reading from stdin')
    const chunks = []
    for await (const chunk of process.stdin) chunks.push(chunk)
    raw = Buffer.concat(chunks).toString()
  } else {
    if (!bind.zoneOpts.origin) bind.zoneOpts.origin = rr.fullyQualify(path.basename(opts.file))
    bind.zoneOpts.file = opts.file
    if (opts.verbose) console.error(`reading file ${opts.file}`)
    raw = await fs.readFile(opts.file, 'utf8')
  }

  return { type: opts.import, data: raw }
}

function output(zoneArray) {
  // console.error(zoneArray)
  switch (opts.export.toLowerCase()) {
    case 'json':
      return toJSON(zoneArray)
    case 'bind':
      return toBind(zoneArray, bind.zoneOpts.origin)
    case 'tinydns':
      return toTinydns(zoneArray)
    case 'maradns':
      return toMaraDNS(zoneArray)
    default:
      toHuman(zoneArray)
  }
}

function isBlank(rr) {
  if (rr === os.EOL) {
    process.stdout.write(rr)
    return true
  }
  return false
}

function toBind(zoneArray, origin) {
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

function toTinydns(zoneArray) {
  for (const rr of zoneArray) {
    if (rr === os.EOL) continue
    if (rr.$TTL || rr.$ORIGIN) continue
    try {
      process.stdout.write(rr.toTinydns())
    } catch (e) {
      console.error(rr)
      throw e
    }
  }
}

function toJSON(zoneArray) {
  for (const rr of zoneArray) {
    if (isBlank(rr)) continue
    if (!rr.get) continue // skip $TTL, $ORIGIN directives
    if (rr.get('comment')) rr.delete('comment')
    process.stdout.write(JSON.stringify(Object.fromEntries(rr)) + '\n')
  }
}

function toHuman(zoneArray) {
  const widest = { owner: 0, ttl: 0, type: 0, rdata: 0 }
  const fields = ['owner', 'ttl', 'type']
  for (const r of zoneArray) {
    if (r === os.EOL || !r.get) continue
    for (const f of fields) {
      if (getWidth(r.get(f)) > widest[f]) widest[f] = getWidth(r.get(f))
    }
    const rdataLen = r
      .getRdataFields()
      .map((f) => r.get(f))
      .join(' ').length
    if (rdataLen > widest.rdata) widest.rdata = rdataLen
  }

  // console.log(widest)
  let rdataWidth = process.stdout.columns - widest.owner - widest.type - 10
  if (!bind.zoneOpts.hide.ttl) rdataWidth -= widest.ttl

  for (const r of zoneArray) {
    if (isBlank(r)) continue
    if (!r.get) {
      process.stdout.write(`${Object.keys(r)[0]} ${Object.values(r)[0]}\n`)
      continue
    }

    let line = r.get('owner').padEnd(widest.owner + 2, ' ')
    if (!bind.zoneOpts.hide.ttl) {
      line += r.get('ttl').toString().padStart(widest.ttl, ' ') + '  '
    }
    line += r.get('type').padEnd(widest.type + 2, ' ')

    const rdata = r
      .getRdataFields()
      .map((f) => r.get(f))
      .join(' ')
    line += rdata.slice(0, rdataWidth)
    if (rdata.length > rdataWidth) line += '...'
    line += '\n'

    process.stdout.write(line)
  }
}

function toMaraDNS(zoneArray) {
  for (const rr of zoneArray) {
    if (rr === os.EOL) continue
    if (rr.$TTL) {
      process.stdout.write(`/ttl ${rr.$TTL}\n`)
      continue
    }
    if (rr.$ORIGIN) {
      process.stdout.write(`/origin ${rr.$ORIGIN}\n`)
      continue
    }
    process.stdout.write(rr.toMaraDNS())
  }
}

function getWidth(str) {
  if (typeof str === 'number') return str.toString().length
  return str.length
}
