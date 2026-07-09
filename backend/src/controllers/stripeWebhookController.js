const asyncHandler = require("../utils/asyncHandler");
const stripePaymentService = require("../services/stripePaymentService");

exports.handleStripeWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers["stripe-signature"];
  await stripePaymentService.handleStripeWebhook(req.body, signature);
  return res.json({ received: true });
});
