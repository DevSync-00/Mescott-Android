/**
 * GET /api/auth/telegram-callback
 * Query: { code, state, error, error_description }
 *
 * Official Telegram Login (OIDC) callback.
 * Telegram redirects the browser here with code and state.
 * This route parses the target mobile app scheme from state and performs a client-side redirect.
 */
module.exports = async function handler(req, res) {
  // Support both GET and POST (Telegram uses GET for redirection callbacks)
  const { code, state, error, error_description } = req.query || {}

  if (!state) {
    return res.status(400).send('Missing state parameter')
  }

  // State format is "randomHex|mobileAppDeepLink"
  const parts = state.split('|')
  const mobileAppDeepLink = parts[1]

  if (!mobileAppDeepLink) {
    return res.status(400).send('Invalid state format')
  }

  try {
    // Build the redirection URL
    const targetUrl = new URL(mobileAppDeepLink)
    if (code) targetUrl.searchParams.set('code', code)
    if (state) targetUrl.searchParams.set('state', state)
    if (error) targetUrl.searchParams.set('error', error)
    if (error_description) targetUrl.searchParams.set('error_description', error_description)

    res.setHeader('Content-Type', 'text/html')
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Redirecting to Mescott...</title>
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
            border-left-color: #7B4FFF;
            animation: spin 1s linear infinite;
            margin: 0 auto 16px;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          h1 { font-size: 20px; margin-bottom: 8px; font-weight: 600; }
          p { font-size: 14px; color: #86868b; margin: 0; }
          a { display: inline-block; margin-top: 16px; color: #7B4FFF; text-decoration: none; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="spinner"></div>
          <h1>Redirecting to Mescott</h1>
          <p>Please wait while we take you back to the app.</p>
          <a href="${targetUrl.toString()}">Tap here if you are not redirected automatically</a>
        </div>
        <script>
          setTimeout(function() {
            window.location.replace("${targetUrl.toString()}");
          }, 100);
        </script>
      </body>
      </html>
    `)
  } catch (err) {
    return res.status(500).send(`Redirection error: ${err.message}`)
  }
}
