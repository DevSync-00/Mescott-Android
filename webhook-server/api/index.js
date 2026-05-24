/** Root handler so visiting the deployment URL does not show Vercel 404 */
module.exports = (req, res) => {
  res.status(200).json({
    ok: true,
    service: 'Mescott webhook server',
    endpoints: {
      webhook: 'POST /api/webhook',
      paymentReturn: 'GET /api/payment-return?tx_ref=YOUR_TX_REF',
      test: 'GET /api/test',
    },
  })
}
