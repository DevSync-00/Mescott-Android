/* global __dirname, process, require */
const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const result = spawnSync(
  process.execPath,
  [path.join(__dirname, '..', 'node_modules', 'expo', 'bin', 'cli'), 'export', '--platform', 'web', '--output-dir', 'tma/dist'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      MESCOTT_TMA_BUILD: '1',
      // Payment secrets belong exclusively to server-side Vercel functions.
      // Explicit overrides prevent a developer's mobile .env from entering the TMA bundle.
      EXPO_PUBLIC_CHAPA_SECRET_KEY: 'TMA_SERVER_ONLY',
      EXPO_PUBLIC_CHAPA_WEBHOOK_SECRET: 'TMA_SERVER_ONLY',
    },
  },
)

if (result.error) console.error(result.error)
if (result.status === 0) {
  const indexPath = path.join(__dirname, '..', 'tma', 'dist', 'index.html')
  const telegramSdk = '<script src="https://telegram.org/js/telegram-web-app.js?63"></script>'
  let html = fs.readFileSync(indexPath, 'utf8')
  if (!html.includes('telegram-web-app.js')) {
    html = html.replace('</head>', `  ${telegramSdk}\n</head>`)
  }
  html = html.replace(
    /<meta name="viewport"[^>]*>/,
    '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />',
  )
  html = html.replace(
    '</style>',
    `#root { height: var(--tg-viewport-stable-height, 100dvh); max-height: var(--tg-viewport-stable-height, 100dvh); padding: 0 var(--mescott-tg-safe-right, 0px) var(--mescott-tg-safe-bottom, 0px) var(--mescott-tg-safe-left, 0px); box-sizing: border-box; }\n</style>`,
  )
  fs.writeFileSync(indexPath, html)
  fs.writeFileSync(
    path.join(__dirname, '..', 'tma', 'dist', 'vercel.json'),
    `${JSON.stringify({
      framework: null,
      rewrites: [{ source: '/(.*)', destination: '/index.html' }],
    }, null, 2)}\n`,
  )
}
process.exit(result.status ?? 1)
