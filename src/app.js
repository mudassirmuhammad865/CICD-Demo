const express = require('express');
const config = require('./config');
const { getBuildInfo } = require('./buildInfo');

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderPage(info) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(config.appName)}</title>
  <style>
    body { font-family: Arial, sans-serif; background:#0f172a; color:#e2e8f0;
           display:flex; align-items:center; justify-content:center; height:100vh; margin:0; }
    .card { background:#1e293b; padding:40px 56px; border-radius:16px; text-align:center;
            box-shadow:0 10px 30px rgba(0,0,0,.4); max-width:640px; }
    h1 { margin-top:0; color:#38bdf8; }
    .meta { margin-top:24px; font-size:14px; color:#94a3b8; }
    .badge { display:inline-block; background:#22c55e; color:#052e16; padding:4px 12px;
             border-radius:999px; font-weight:bold; margin-bottom:16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">LIVE IN PRODUCTION</div>
    <h1>${escapeHtml(config.appName)}</h1>
    <p id="message">${escapeHtml(config.message)}</p>
    <div class="meta">
      Version: <b>${escapeHtml(info.version)}</b> |
      Build: <b>#${escapeHtml(info.build)}</b> |
      Commit: <b>${escapeHtml(info.commit)}</b><br/>
      Built at: ${escapeHtml(info.builtAt)}
    </div>
  </div>
</body>
</html>`;
}

function createApp() {
  const app = express();
  app.disable('x-powered-by');

  app.get('/', (req, res) => {
    res.type('html').send(renderPage(getBuildInfo()));
  });

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/info', (req, res) => {
    res.json({ app: config.appName, message: config.message, ...getBuildInfo() });
  });

  return app;
}

module.exports = { createApp, escapeHtml, renderPage };
