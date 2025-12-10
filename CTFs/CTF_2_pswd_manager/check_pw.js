const bcrypt = require('bcryptjs');
const fs = require('fs');
const users = JSON.parse(fs.readFileSync('./server/data/users.json','utf8'));
const u = users.find(x => x.username === 'abcd12');
if(!u){ console.error('user not found'); process.exit(2)}
const hash = u.passwordHash;
const candidates = ['password','changeme','secret','abcd12','Password123','123456','admin123','test123','letmein','passw0rd'];
console.log('Testing', candidates.length, 'candidates against hash');
candidates.forEach(p => {
  const ok = bcrypt.compareSync(p, hash);
  console.log(ok ? `MATCH: ${p}` : `no: ${p}`);
});
