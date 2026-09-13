const fs = require('fs')
const path = require('path')

function parseEnvFile(content) {
  const env = {}
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    env[key] = val
  }
  return env
}

function applyEnv(parsed) {
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined || process.env[key] === '') {
      process.env[key] = value
    }
  }
}

function mapExpoToServer() {
  if (!process.env.SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_URL) {
    process.env.SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL
  }
  if (!process.env.SUPABASE_ANON_KEY && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    process.env.SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  }
  if (!process.env.TELEGRAM_WEBHOOK_BASE_URL && process.env.EXPO_PUBLIC_API_URL) {
    process.env.TELEGRAM_WEBHOOK_BASE_URL = process.env.EXPO_PUBLIC_API_URL
  }
  if (!process.env.EXPO_PUBLIC_API_URL && process.env.TELEGRAM_WEBHOOK_BASE_URL) {
    process.env.EXPO_PUBLIC_API_URL = process.env.TELEGRAM_WEBHOOK_BASE_URL
  }
}

/**
 * Load env files for local scripts (register-webhook, vercel dev).
 * Later files do not override non-empty process.env values.
 */
function loadEnv() {
  const root = path.join(__dirname, '..')
  const repoRoot = path.join(root, '..')
  const files = [
    path.join(repoRoot, '.env'),
    path.join(root, '.env'),
    path.join(root, '.env.local'),
    path.join(root, '.env.production.local'),
  ]

  for (const file of files) {
    if (!fs.existsSync(file)) continue
    applyEnv(parseEnvFile(fs.readFileSync(file, 'utf8')))
  }

  mapExpoToServer()
}

function isPlaceholder(value) {
  if (!value || typeof value !== 'string') return true
  const v = value.trim().toLowerCase()
  return (
    !v ||
    v.includes('your_') ||
    v.includes('change_me') ||
    v.includes('botfather') ||
    v === 'optional'
  )
}

module.exports = { loadEnv, parseEnvFile, isPlaceholder }
