#!node

const fs   = require('fs')
const path = require('path')
const os   = require('os')

const chalk = require('chalk')
const cmdLineArgs = require('command-line-args')
const cmdLineUsage = require('command-line-usage')

const dz = require('../index')

// CLI argument processing
const opts = cmdLineArgs(usageOptions())._all
if (opts.verbose) console.error(opts)
if (opts.help) usage()

const zone_opts = {
  origin: dz.fullyQualify(opts.origin) || '',
  ttl   : opts.ttl || 0,
  class : opts.class || 'IN',
  hide  : {
    class : opts['hide-class'],
    ttl   : opts['hide-ttl'],
    origin: opts['hide-origin'],
  },
}
if (opts.verbose) console.error(zone_opts)

// determine where to ingest data from
let filePath = opts.import
if (!filePath) usage()
if (filePath === 'stdin') {
  filePath = process.stdin.fd
}
else {
  if (!opts.origin) zone_opts.origin = dz.fullyQualify(path.basename(filePath))
}

if (opts.verbose) console.error(`reading file ${filePath}`)

fs.readFile(filePath, (err, buf) => {
  if (err) throw err

  const origin = zone_opts.origin ? dz.fullyQualify(zone_opts.origin) : ''

  dz.parseZoneFile(fileAsString(buf, origin))
    .then(dz.expandShortcuts)
    .then(zoneArray => {
      // console.error(zoneArray)
      switch (opts.export.toLowerCase()) {
        case 'json':
          toJSON(zoneArray)
          break
        case 'bind':
          toBind(zoneArray, origin)
          break
        case 'tinydns':
          toTinydns(zoneArray)
          break
        default:
          console.log(zoneArray)
      }
    })
    .catch(e => {
      console.error(e.message)
    })
})

function usage () {
  console.error(cmdLineUsage(usageSections()))
  process.exit(1)
}

function usageOptions () {
  return [
    {
      name        : 'import',
      alias       : 'i',
      defaultValue: 'stdin',
      type        : String,
      typeLabel   : '<stdin | file path>',
      description : 'source of DNS zone data (default: stdin)',
      group       : 'io',
    },
    {
      name        : 'export',
      alias       : 'e',
      defaultValue: 'js',
      type        : String,
      typeLabel   : '<js | json | bind | tinydns>',
      description : 'zone data export format (default: js)',
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
      description : 'zone class (default: IN)',
      group       : 'main',
    },
    {
      name        : 'hide-origin',
      defaultValue: false,
      type        : Boolean,
      // typeLabel   : '',
      description : 'remove origin from RR domain names (default: false)',
      group       : 'out',
    },
    {
      name        : 'hide-class',
      defaultValue: false,
      type        : Boolean,
      // typeLabel   : '',
      description : 'hide class (default: false)',
      group       : 'out',
    },
    {
      name        : 'hide-ttl',
      defaultValue: false,
      type        : Boolean,
      // typeLabel   : '',
      description : 'hide TTLs (default: false)',
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
          desc   : '1. BIND file to tinydns',
          example: './bin/import -i ./isi.edu -e tinydns',
        },
        {
          desc   : '2. BIND file to JS objects',
          example: './bin/import -i ./isi.edu',
        },
        {
          desc   : '3. tinydns file to BIND',
          example: './bin/import -i ./data -e bind',
        },
      ],
    },
    {
      content: 'Project home: {underline https://github.com/msimerson/dns-zone-validator}',
    },
  ]
}

function fileAsString (buf, origin) {
  let str = buf.toString()

  if (!/^\$ORIGIN/m.test(str)) {
    if (opts.verbose) console.error(`inserting $ORIGIN ${origin}`)
    str = `$ORIGIN ${origin}${os.EOL}${str}`
  }
  // console.error(str)
  return str
}

function toBind (zoneArray, origin) {
  for (const rr of zoneArray) {
    process.stdout.write(rr.toBind(zone_opts))
  }
}

function toTinydns (zoneArray) {
  for (const rr of zoneArray) {
    process.stdout.write(rr.toTinydns())
  }
}

function toJSON (zoneArray) {
  for (const rr of zoneArray) {
    // console.error(rr)
    if (rr.get('comment')) rr.delete('comment')
    process.stdout.write(JSON.stringify(Object.fromEntries(rr)))
  }
}