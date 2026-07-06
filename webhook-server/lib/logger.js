const LOG_LEVEL = process.env.LOG_LEVEL || 'info'

const levels = { error: 0, warn: 1, info: 2, debug: 3 }

function log(level, message, meta) {
  if (levels[level] > levels[LOG_LEVEL]) return
  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
    ...(meta ? { meta } : {}),
  }
  const line = JSON.stringify(payload)
  if (level === 'error') console.error(line)
  else console.log(line)
}

module.exports = {
  error: (message, meta) => log('error', message, meta),
  warn: (message, meta) => log('warn', message, meta),
  info: (message, meta) => log('info', message, meta),
  debug: (message, meta) => log('debug', message, meta),
}
