const { createClient } = require('@supabase/supabase-js')

let admin = null

function getSupabaseAdmin() {
  if (admin) return admin

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required on the webhook server')
  }

  admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return admin
}

module.exports = { getSupabaseAdmin }
