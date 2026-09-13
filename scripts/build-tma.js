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
      // Payment secrets belong exclusively to server-side Vercel functions.
      // Explicit overrides prevent a developer's mobile .env from entering the TMA bundle.
      EXPO_PUBLIC_CHAPA_SECRET_KEY: 'TMA_SERVER_ONLY',
      EXPO_PUBLIC_CHAPA_WEBHOOK_SECRET: 'TMA_SERVER_ONLY',
    },
  },
)

if (result.error) console.error(result.error)
if (result.status === 0) {
  fs.writeFileSync(
    path.join(__dirname, '..', 'tma', 'dist', 'vercel.json'),
    `${JSON.stringify({
      framework: null,
      rewrites: [{ source: '/(.*)', destination: '/index.html' }],
    }, null, 2)}\n`,
  )
}
process.exit(result.status ?? 1)
