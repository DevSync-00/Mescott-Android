const logger = require('../lib/logger')
const { parseTelegramUpdate } = require('../lib/telegram/parseUpdate')
const { sendTelegramMessage } = require('../lib/telegram/telegramApi')
const channelService = require('./channelService')
const verificationRepository = require('../lib/channels/verificationRepository')

const OTP_HELP =
  'Welcome to Mescott!\n\n' +
  '• Tap the app link to verify sign up / sign in\n' +
  '• Or send your 6-digit code here after receiving it\n' +
  '• Send /help for commands'

/**
 * Parse /start payload: signin_<token> or signup_<token> or verify_<phone>
 */
function parseStartParam(startParam) {
  if (!startParam) return { purpose: 'sign_in', sessionToken: null, phone: null }

  if (startParam.startsWith('signup_')) {
    return { purpose: 'sign_up', sessionToken: startParam.slice(7), phone: null }
  }
  if (startParam.startsWith('signin_')) {
    return { purpose: 'sign_in', sessionToken: startParam.slice(7), phone: null }
  }
  if (startParam.startsWith('verify_')) {
    return { purpose: 'sign_in', sessionToken: null, phone: startParam.slice(7) }
  }

  return { purpose: 'sign_in', sessionToken: startParam, phone: null }
}

async function handleVerificationStart(inbound) {
  const { purpose, sessionToken, phone } = parseStartParam(inbound.startParam)
  const purposeLabel = purpose === 'sign_up' ? 'sign up' : 'sign in'

  let codeResult

  if (sessionToken) {
    codeResult = await verificationRepository.activateSessionFromBot(
      sessionToken,
      inbound.telegramUserId,
    )
    if (!codeResult) {
      await sendTelegramMessage(
        inbound.chatId,
        'This link expired. Open Mescott, enter your phone, and tap "Verify with Telegram" again.',
      )
      return { handled: true, action: 'session_expired' }
    }
  } else {
    codeResult = await verificationRepository.createVerificationCode({
      telegramUserId: inbound.telegramUserId,
      phone,
      purpose,
      sessionToken: null,
    })
  }

  const { code, expiresAt } = codeResult

  await sendTelegramMessage(
    inbound.chatId,
    `Your Mescott ${purposeLabel} code is:\n\n` +
      `${code}\n\n` +
      `Valid for ${verificationRepository.CODE_TTL_MINUTES} minutes.\n` +
      `Enter this code in the Mescott app.`,
  )

  await channelService.persistOutbound({
    senderId: inbound.telegramUserId,
    platform: 'telegram',
    messageBody: `OTP sent for ${purposeLabel}`,
    metadata: { type: 'otp_sent', expires_at: expiresAt, purpose, session_token: sessionToken },
  })

  return { handled: true, action: 'otp_sent', purpose }
}

async function handleOtpReply(inbound) {
  const digits = inbound.messageBody.replace(/\D/g, '')
  if (digits.length !== 6) return { handled: false }

  const result = await verificationRepository.verifyCode(inbound.telegramUserId, digits)

  if (!result.valid) {
    const messages = {
      expired: 'That code has expired. Open the app and request a new code.',
      invalid: 'Invalid code. Please check and try again.',
      no_code: 'No active code found. Open Mescott in the app and tap Verify with Telegram.',
    }
    await sendTelegramMessage(inbound.chatId, messages[result.reason] || messages.invalid)
    return { handled: true, action: 'otp_failed', reason: result.reason }
  }

  await sendTelegramMessage(
    inbound.chatId,
    '✅ Verified successfully! You can return to the Mescott app to continue.',
  )

  await channelService.persistOutbound({
    senderId: inbound.telegramUserId,
    platform: 'telegram',
    messageBody: 'Verification successful',
    metadata: {
      type: 'otp_verified',
      purpose: result.purpose,
      session_token: result.sessionToken,
    },
  })

  return { handled: true, action: 'otp_verified', ...result }
}

async function processInboundUpdate(update) {
  const inbound = parseTelegramUpdate(update)

  if (!inbound || inbound.kind === 'unsupported') {
    logger.debug('Ignoring non-message update', { updateId: inbound?.updateId })
    return { ok: true, skipped: true }
  }

  try {
    return await processInboundMessage(inbound)
  } catch (error) {
    logger.error('Telegram message processing failed', {
      message: error.message,
      telegramUserId: inbound.telegramUserId,
    })
    try {
      await sendTelegramMessage(
        inbound.chatId,
        'Something went wrong on our side. Please try again in a minute or use SMS verification in the app.',
      )
    } catch (sendErr) {
      logger.error('Failed to send error message to user', { message: sendErr.message })
    }
    throw error
  }
}

async function processInboundMessage(inbound) {
  try {
    await channelService.persistInbound({
      senderId: inbound.telegramUserId,
      platform: 'telegram',
      messageBody: inbound.messageBody,
      createdAt: inbound.timestamp,
      media: inbound.media,
      metadata: {
        username: inbound.username,
        chat_id: inbound.chatId,
        message_id: inbound.messageId,
        start_param: inbound.startParam,
      },
    })
  } catch (persistError) {
    logger.warn('Could not persist inbound message (OTP will still be sent)', {
      message: persistError.message,
    })
  }

  if (inbound.startParam || inbound.messageBody.startsWith('/start')) {
    return handleVerificationStart(inbound)
  }

  if (inbound.messageBody === '/help') {
    await sendTelegramMessage(inbound.chatId, OTP_HELP)
    return { handled: true, action: 'help' }
  }

  const otpResult = await handleOtpReply(inbound)
  if (otpResult.handled) return otpResult

  await sendTelegramMessage(
    inbound.chatId,
    'Thanks for messaging Mescott support. A team member will follow up soon.\n\n' + OTP_HELP,
  )

  return { handled: true, action: 'support_ack' }
}

module.exports = {
  processInboundUpdate,
  processInboundMessage,
  sendTelegramMessage,
  parseStartParam,
}
