#!node

const fs   = require('fs')
const path = require('path')
const os   = require('os')

const dz = require('../index')

const filePath = process.argv[2]
if (!filePath) usage()

function usage () {
  console.log(`\n  ${process.argv[1]} file\n`)
  process.exit(1)
}

console.log(`reading file ${filePath}`)

fs.readFile(filePath, (err, buf) => {
  if (err) throw err

  const base = path.basename(filePath)
  const asString = fileAsString(buf, base)

  dz.parseZoneFile(asString)
    .then(dz.expandShortcuts)
    .then(zoneArray => {
      // console.log(zoneArray)
      switch (process.argv[3]) {
        case 'toBind':
          toBind(zoneArray, base)
          break
        case 'toTinydns':
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

function fileAsString (buf, base) {
  let str = buf.toString()

  if (!/^\$ORIGIN/m.test(str)) {
    console.log(`inserting $ORIGIN ${base}`)
    str = `$ORIGIN ${base}.${os.EOL}${str}`
  }
  // console.log(str)
  return str
}

function toBind (zoneArray, origin) {
  for (const rr of zoneArray) {
    let out = rr.toBind()
    const reduceRE = new RegExp(`^([^\\s]+).${origin}.`)
    out = out.replace(reduceRE, '$1')
    process.stdout.write(out)
  }
}

function toTinydns (zoneArray) {
  for (const rr of zoneArray) {
    process.stdout.write(rr.toTinydns())
  }
}