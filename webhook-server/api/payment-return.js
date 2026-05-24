/**
 * Chapa return_url handler — instant redirect into the Mescott app.
 * Flat file path ensures Vercel deploys this as GET /api/payment-return
 */
module.exports = (req, res) => {
  const txRef =
    req.query.tx_ref ||
    req.query.trx_ref ||
    req.query.trxref ||
    ''

  const appUrl = `mescott://payment-success?tx_ref=${encodeURIComponent(txRef)}`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="0;url=${appUrl}">
  <title>Returning to Mescott…</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f5f3ff; color: #333; }
    p { text-align: center; }
    a { color: #7B42F6; }
  </style>
</head>
<body>
  <p>Returning to Mescott…<br><a href="${appUrl}">Tap here if the app does not open</a></p>
  <script>window.location.replace(${JSON.stringify(appUrl)});</script>
</body>
</html>`)
}
