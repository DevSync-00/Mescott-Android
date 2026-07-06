/**
 * GET /api/auth/telegram-login
 * Query: { state, code_challenge }
 *
 * Intermediary secure redirector for Telegram OIDC.
 * Serves a small HTML page that redirects the browser to Telegram using JavaScript.
 * This ensures that the web browser sets the correct 'Origin' and 'Referer' headers 
 * matching your registered domain (api.mescott.co), bypassing the "origin required" error.
 */
module.exports = async function handler(req, res) {
  const { state, code_challenge: codeChallenge } = req.query || {}

  if (!state || !codeChallenge) {
    return res.status(400).send('Missing state or code_challenge parameter')
  }

  const clientId = process.env.TELEGRAM_OIDC_CLIENT_ID || process.env.TELEGRAM_BOT_CLIENT_ID
  if (!clientId) {
    return res.status(500).send('TELEGRAM_OIDC_CLIENT_ID is not configured on the server')
  }

  const host = req.headers.host || 'api.mescott.co'
  const protocol = req.headers['x-forwarded-proto'] || 'https'
  const redirectUri = `${protocol}://${host}/api/auth/telegram-callback`

  const q = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid profile phone',
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })

  const targetUrl = `https://oauth.telegram.org/auth?${q.toString()}`

  res.setHeader('Content-Type', 'text/html')
  return res.status(200).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Connecting to Telegram...</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          margin: 0;
          background-color: #f5f5f7;
          color: #1d1d1f;
        }
        .container {
          text-align: center;
          padding: 24px;
        }
        .spinner {
          border: 4px solid rgba(0, 0, 0, 0.1);
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border-left-color: #0088CC;
          animation: spin 1s linear infinite;
          margin: 0 auto 16px;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        h1 { font-size: 20px; margin-bottom: 8px; font-weight: 600; }
        p { font-size: 14px; color: #86868b; margin: 0; }
        a { display: inline-block; margin-top: 16px; color: #0088CC; text-decoration: none; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="spinner"></div>
        <h1>Connecting to Telegram</h1>
        <p>Please wait while we establish a secure connection...</p>
        <a href="${targetUrl}">Tap here if you are not redirected automatically</a>
      </div>
      <script>
        setTimeout(function() {
          window.location.replace("${targetUrl}");
        }, 100);
      </script>
    </body>
    </html>
  `)
}
