
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

  it('parses BIND example zone file', async function () {
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

  it('parses tinydns example data file to maradns', async function () {
    const binPath = path.resolve('bin', 'dns-zone.js')
    const args = [ '-i', 'tinydns', '-f', './test/fixtures/tinydns/data', '-e', 'maradns' ]
    // console.log(`${binPath} ${args.join(' ')}`)
    try {
      const { stdout, stderr } = await execFile(binPath, args)
      assert.strictEqual(stdout, `theartfarm.com.\t SOA\tns3.theartfarm.com.\thostmaster.theartfarm.com.\t2022032700\t16384\t2048\t1048576\t2560 ~
theartfarm.com.\t+14400\tNS\tns3.theartfarm.com. ~
theartfarm.com.\t+14400\tNS\tns1.theartfarm.com. ~
theartfarm.com.\t+14400\tNS\tns2.theartfarm.com. ~
theartfarm.com.\t+28800\tMX\t10\tmail.theartfarm.com. ~
theartfarm.com.\t+86400\tTXT\t'v=spf1 include:mx.theartfarm.com ip4:69.64.153.131 ip4:172.16.16.5 -all' ~
theartfarm.com.\t+28800\tA\t66.128.51.172 ~
www.theartfarm.com.\t+28800\tMX\t10\tmail.theartfarm.com. ~
dmarc.theartfarm.com.\t+86400\tMX\t10\tmail.theartfarm.com. ~
theartfarm.com.\t+86400\tTXT\t'stripe-verification=a5fd4f2f0595baed5ff34b5faa4fbbfe1a3c558edb5d3e1f79a1b47c17034045' ~
localhost.theartfarm.com.\t+86400\tA\t127.0.0.1 ~
ns1.theartfarm.com.\t+86400\tA\t192.48.85.147 ~
www.theartfarm.com.\t+28800\tA\t66.128.51.172 ~
art.theartfarm.com.\t+86400\tCNAME\tmail.theartfarm.com. ~
ftp.theartfarm.com.\t+28800\tCNAME\twww.theartfarm.com. ~
pop.theartfarm.com.\t+28800\tCNAME\tmail.theartfarm.com. ~
smtp.theartfarm.com.\t+28800\tCNAME\tmail.theartfarm.com. ~
imap.theartfarm.com.\t+28800\tCNAME\tmail.theartfarm.com. ~
dns.theartfarm.com.\t+86400\tCNAME\tdns.tnpi.net. ~
www2.theartfarm.com.\t+3600\tCNAME\tns2.theartfarm.com. ~
ns2.theartfarm.com.\t+28800\tA\t66.128.51.172 ~
mail.theartfarm.com.\t+28800\tTXT\t'v=spf1 a -all' ~
www.theartfarm.com.\t+86400\tTXT\t'v=spf1 a mx ip4:127.0.0.24 -all' ~
vhost0.theartfarm.com.\t+86400\tA\t66.128.51.173 ~
mail.theartfarm.com.\t+28800\tA\t66.128.51.165 ~
toaster.theartfarm.com.\t+3600\tCNAME\tmail.theartfarm.com. ~
ns3.theartfarm.com.\t+28800\tA\t138.210.133.60 ~
lo.mail.theartfarm.com.\t+86400\tA\t127.0.0.6 ~
mar2013._domainkey.theartfarm.com.\t+3600\tTXT\t'v=DKIM1;p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA5Q41fZ8CqpSgzSWpDY88oGq+bXKHdROGHmyjY6+b8qLUmdoHgpcaBUhL2zhZChvx5uayVJRV/gWxPZtODsozOqPk6fl8Mn1VH1MBsuQdShnC0a/Tcm8bPW0NE2viHysUamvL+X5Ea9H2GyVGKpe6rdKrmUiCzZyRYwTYqLvC9HhkTNWjR3TuP5mA2rmBO8IBPBFkdaz7W' 'veNaiR8ImegA+wv1uCYcQLwcz3bn/U2yK2UzFGsJLZ1KCTqr8WMPTuy1zc5zClHpZZMmCl3uk02bE59RVa7zzyZwVEGeRcjouq0rh5JCl057rMK2cwA2wu//8svN+pGZAKJCnuFlpC0bwIDAQAB' ~
_dmarc.theartfarm.com.\t+86400\tTXT\t'v=DMARC1; p=reject; rua=mailto:dmarc-feedback@theartfarm.com; ruf=mailto:dmarc-feedback@theartfarm.com; pct=100' ~
_dmarc.dmarc.theartfarm.com.\t+86400\tTXT\t'v=DMARC1; p=reject; pct=100' ~
dmarc.theartfarm.com.\t+86400\tTXT\t'v=spf1 include:mx.theartfarm.com -all' ~
dmarc.theartfarm.com.\t+86400\tA\t66.128.51.165 ~
mx.theartfarm.com.\t+86400\tTXT\t'v=spf1 ip4:66.128.51.160/27 ip4:192.48.85.146/29 ip4:173.45.131.0/27 ip4:204.11.99.0/27 ip6:2605:7900:20:a::/64 ip6:2605:ae00:329::0/64 -all' ~
htpta.theartfarm.com.\t+86400\tCNAME\tvhost0.theartfarm.com. ~
vhost0.theartfarm.com.\t+86400\tTXT\t'v=spf1 include:mx.theartfarm.com -all' ~
ns3.theartfarm.com.\t+86400\tTXT\t'v=spf1 a ip4:138.210.133.60 ip4:46.105.8.147 -all' ~
wordpress.theartfarm.com.\t+86400\tCNAME\twww.theartfarm.com. ~
apr2019._domainkey.mail.theartfarm.com.\t+86400\tTXT\t'v=DKIM1;p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAoW91trHF9nBzY3DeFtauDbPbr904YNBgW7mh/8s5Fcmsi3TPB1bSqyBcr2BjYGqCG1KPFBvs+IRZNMDgHJ4wMSdC+4Pt6wXkMJpElNg4DjuP7q2UALJsOQ/H54VtH8TWVMOekmc4W3um8ZqxePGJkWd2UGV+YT00dR8jLne5d+9MXo3CayOe3L7rK9uEvm0u8dLYLJaTm' 'PdKI+8LWEIuxC4KeRsaB/10M7NIaR73C5wB0HlTOm7MQW3806rTdlFYpO9Rtx2uV3stqCIfUYK9qeGLJFXHjLxh0nki4ztVIZdPi9TkZnj+juS5k8GTADSGy7PWawUnbhjEDyd4JX5YxwIDAQAB' ~
ns1.theartfarm.com.\t+86400\tA\t173.45.131.5 ~
ns1.theartfarm.com.\t+86400\tA\t204.11.99.5 ~
mx-out.theartfarm.com.\t+86400\tA\t66.128.51.178 ~
bounce.theartfarm.com.\t+86400\tCNAME\tcustom-email-domain.stripe.com. ~
`)
      assert.strictEqual(stderr, '')
    }
    catch (e) {
      assert.ifError(e)
    }
  })
})