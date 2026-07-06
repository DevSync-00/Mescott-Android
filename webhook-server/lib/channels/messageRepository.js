const { createClient } = require('@supabase/supabase-js')
const logger = require('../logger')

const TABLE = process.env.CHANNEL_MESSAGES_TABLE || 'channel_messages'

let supabase = null

function getSupabase() {
  if (supabase) return supabase
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  if (!url || !key) {
    return null
  }
  supabase = createClient(url, key)
  return supabase
}

/**
 * Persist a normalized message for the mobile app to fetch via your API.
 * Falls back to in-memory mock when Supabase is not configured.
 */
const mockStore = []

async function saveChannelMessage(normalizedMessage) {
  const client = getSupabase()

  if (!client) {
    mockStore.push({ ...normalizedMessage, id: `mock_${Date.now()}` })
    logger.warn('Supabase not configured — message stored in memory mock only', {
      sender_id: normalizedMessage.sender_id,
      platform: normalizedMessage.platform,
    })
    return { id: mockStore[mockStore.length - 1].id, mock: true }
  }

  const { data, error } = await client
    .from(TABLE)
    .insert([normalizedMessage])
    .select('id')
    .single()

  if (error) {
    logger.error('Failed to save channel message', { error: error.message, table: TABLE })
    throw error
  }

  return { id: data.id, mock: false }
}

async function listMessagesForSender(senderId, platform = 'telegram', limit = 50) {
  const client = getSupabase()

  if (!client) {
    return mockStore
      .filter((m) => m.sender_id === String(senderId) && m.platform === platform)
      .slice(-limit)
  }

  const { data, error } = await client
    .from(TABLE)
    .select('*')
    .eq('sender_id', String(senderId))
    .eq('platform', platform)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data || []
}

function getMockStore() {
  return [...mockStore]
}

module.exports = {
  saveChannelMessage,
  listMessagesForSender,
  getMockStore,
}
