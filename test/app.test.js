const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { createApp, escapeHtml } = require('../src/app');
const config = require('../src/config');

let server;
let baseUrl;

before(async () => {
  server = createApp().listen(0); // random free port
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
});

test('GET /health returns status ok', async () => {
  const res = await fetch(`${baseUrl}/health`);
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(await res.json(), { status: 'ok' });
});

test('GET / returns the HTML page with the configured message', async () => {
  const res = await fetch(`${baseUrl}/`);
  assert.strictEqual(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  const body = await res.text();
  assert.ok(body.includes(escapeHtml(config.message)), 'page should show the message');
  assert.ok(body.includes('<h1>'), 'page should have a heading');
});

test('GET /api/info returns version information', async () => {
  const res = await fetch(`${baseUrl}/api/info`);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.ok(data.version, 'version should be present');
  assert.ok(data.message, 'message should be present');
});

test('escapeHtml prevents HTML injection', () => {
  assert.strictEqual(escapeHtml('<script>"x"</script>'), '&lt;script&gt;&quot;x&quot;&lt;/script&gt;');
});
