
import assert from 'assert'
import * as child from 'child_process'
import path   from 'path'
import util   from 'util'

const execFile = util.promisify(child.execFile)

describe('nt-zone.js', function () {
  it('prints help message', async function () {
    const binPath = path.resolve('bin', 'dns-zone.js')
    const args = [ '-h' ]
    try {
      const { stdout, stderr } = await execFile(binPath, args)
      // console.log(stdout)
      // console.log(stderr)
      assert.ok(/|Z|O|N|E|/.test(stdout))
      assert.strictEqual(stderr, '')
    }
    catch (e) {
      assert.ifError(e)
    }
  })

  it('parses example zone file', async function () {
    const binPath = path.resolve('bin', 'dns-zone.js')
    const args = [ '-i', 'bind', '-f', './test/fixtures/bind/example.com', '-o', 'cadillac.net' ]
    // console.log(`${binPath} ${args.join(' ')}`)
    try {
      const { stdout, stderr } = await execFile(binPath, args)
      assert.strictEqual(stdout, `$ORIGIN example.com.
$TTL 3600
example.com.          3600  SOA    
example.com.          3600  NS     
example.com.          3600  NS     
example.com.          3600  MX     
example.com.          3600  MX     
example.com.          3600  MX     
example.com.          3600  A      
example.com.          3600  AAAA   
ns.example.com.       3600  A      
ns.example.com.       3600  AAAA   
www.example.com.      3600  CNAME  
wwwtest.example.com.  3600  CNAME  
mail.example.com.     3600  A      
mail2.example.com.    3600  A      
mail3.example.com.    3600  A      
`)
      assert.strictEqual(stderr, ``)
    }
    catch (e) {
      assert.ifError(e)
    }
  })
})