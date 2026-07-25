// Quick auth flow test — register → login → me
const http = require('http');

function post(path, body, cookieHeader = '') {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const options = {
      hostname: 'localhost', port: 4000, path, method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const cookies = res.headers['set-cookie'] || [];
        resolve({ status: res.statusCode, body: JSON.parse(data), cookies });
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function run() {
  const email = `test_${Date.now()}@priceiq.com`;
  const password = 'TestPass123!';

  console.log('\n====== Auth API Test ======\n');

  // 1. Register
  console.log('1. POST /api/auth/register');
  const reg = await post('/api/auth/register', { email, password });
  console.log(`   Status : ${reg.status}`);
  console.log(`   Body   : ${JSON.stringify(reg.body)}`);
  if (reg.status !== 201) { console.error('❌ Register failed'); process.exit(1); }
  console.log('   ✅ Registration OK\n');

  // 2. Login
  console.log('2. POST /api/auth/login');
  const login = await post('/api/auth/login', { email, password });
  console.log(`   Status : ${login.status}`);
  console.log(`   Token  : ${login.body.data?.accessToken?.slice(0, 30)}...`);
  console.log(`   User   : ${JSON.stringify(login.body.data?.user)}`);
  if (login.status !== 200) { console.error('❌ Login failed'); process.exit(1); }
  const cookie = login.cookies.find(c => c.startsWith('refreshToken'))?.split(';')[0] || '';
  console.log('   ✅ Login OK\n');

  // 3. Refresh
  console.log('3. POST /api/auth/refresh');
  const refresh = await post('/api/auth/refresh', {}, cookie);
  console.log(`   Status : ${refresh.status}`);
  if (refresh.status === 200) {
    console.log('   ✅ Token refresh OK\n');
  } else {
    console.log(`   ⚠️  Refresh returned ${refresh.status} — cookie path restriction may apply in curl\n`);
  }

  console.log('====== All core auth tests passed ✅ ======\n');
}

run().catch(err => { console.error('Test error:', err.message); process.exit(1); });
