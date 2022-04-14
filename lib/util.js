
// const fs = require('fs')

export default { serialByDate }

export function serialByDate (start, inc) {

  const d     = new Date()
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  const day   = d.getDate().toString().padStart(2, '0')
  const year  = d.getFullYear()
  const increment = (inc || '00').toString().padStart(2, '0')

  return parseInt(`${year}${month}${day}${increment}`, 10)
}

export function serialByFileStat (filePath) {
  // TODO
}