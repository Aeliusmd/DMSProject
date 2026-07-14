/**
 * Stripe payment rows for personal request orders
 * (personal_request_stripe_payments).
 */

const { getPool } = require("../config/database");

class PersonalRequestStripePayment {
  static async createPending(data, connection = null) {
    const executor = connection || getPool();
    const [result] = await executor.execute(
      `INSERT INTO personal_request_stripe_payments (
        personal_request_order_id, amount, currency, status,
        stripe_checkout_session_id, customer_email, customer_name
      ) VALUES (
        :personalRequestOrderId, :amount, :currency, 'pending',
        :stripeCheckoutSessionId, :customerEmail, :customerName
      )`,
      data
    );
    return result.insertId;
  }

  static async findByCheckoutSessionId(sessionId, connection = null) {
    const executor = connection || getPool();
    const [rows] = await executor.execute(
      `SELECT * FROM personal_request_stripe_payments
       WHERE stripe_checkout_session_id = :sessionId
       LIMIT 1`,
      { sessionId }
    );
    return rows[0] || null;
  }

  static async findByPersonalRequestOrderId(personalRequestOrderId, connection = null) {
    const executor = connection || getPool();
    const [rows] = await executor.execute(
      `SELECT * FROM personal_request_stripe_payments
       WHERE personal_request_order_id = :personalRequestOrderId
       ORDER BY created_at DESC`,
      { personalRequestOrderId }
    );
    return rows;
  }

  static async markSucceeded(connection, id, data) {
    const executor = connection || getPool();
    await executor.execute(
      `UPDATE personal_request_stripe_payments
       SET order_id = :orderId,
           status = 'succeeded',
           amount = :amount,
           currency = :currency,
           stripe_payment_intent_id = :stripePaymentIntentId,
           stripe_charge_id = :stripeChargeId,
           stripe_customer_id = :stripeCustomerId,
           payment_method_type = :paymentMethodType,
           card_brand = :cardBrand,
           card_last4 = :cardLast4,
           customer_email = :customerEmail,
           customer_name = :customerName,
           receipt_url = :receiptUrl,
           processing_fee = :processingFee,
           net_amount = :netAmount,
           failure_message = NULL,
           paid_at = :paidAt,
           updated_at = NOW()
       WHERE id = :id`,
      { id, ...data }
    );
  }

  static async insertSucceeded(connection, data) {
    const executor = connection || getPool();
    const [result] = await executor.execute(
      `INSERT INTO personal_request_stripe_payments (
        personal_request_order_id, order_id, amount, currency, status,
        stripe_checkout_session_id, stripe_payment_intent_id, stripe_charge_id,
        stripe_customer_id, payment_method_type, card_brand, card_last4,
        customer_email, customer_name, receipt_url, processing_fee, net_amount,
        paid_at
      ) VALUES (
        :personalRequestOrderId, :orderId, :amount, :currency, 'succeeded',
        :stripeCheckoutSessionId, :stripePaymentIntentId, :stripeChargeId,
        :stripeCustomerId, :paymentMethodType, :cardBrand, :cardLast4,
        :customerEmail, :customerName, :receiptUrl, :processingFee, :netAmount,
        :paidAt
      )`,
      data
    );
    return result.insertId;
  }
}

module.exports = PersonalRequestStripePayment;
