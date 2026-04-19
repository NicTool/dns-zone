{"owner":"example.com.","type":"SOA","ttl":3600,"class":"IN","mname":"ns.example.com.","rname":"admin.example.com.","serial":2020091025,"refresh":7200,"retry":3600,"expire":604800,"minimum":3600}
{"owner":"example.com.","type":"NS","ttl":3600,"class":"IN","dname":"ns.example.com."}
{"owner":"example.com.","type":"A","ttl":3600,"class":"IN","address":"1.2.3.4"}
{"owner":"example.com.","type":"MX","ttl":3600,"class":"IN","preference":10,"exchange":"mail.example.com."}
{"owner":"ns.example.com.","type":"AAAA","ttl":3600,"class":"IN","address":"2001:0db8:0000:0000:0000:0000:0000:0001"}
