const crypto = require('crypto');
const Razorpay = require('razorpay');

// Payments are only live when both Razorpay keys are configured. Without them the app runs in
// demo mode: bookings are confirmed without taking a payment.
const paymentsEnabled = () => Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

const client = () => new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const paise = (rupees) => Math.round(rupees * 100);

// amount is in rupees; Razorpay works in paise.
const createOrder = (amount, receipt) => client().orders.create({
  amount: paise(amount),
  currency: 'INR',
  receipt,
});

// The checkout signs "order_id|payment_id" with our key secret, so a valid signature proves the
// payment came from Razorpay for that order.
const signatureValid = (payment) => {
  const { orderId, paymentId, signature } = payment || {};
  if (!orderId || !paymentId || !signature) return false;
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
  return expected.length === signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
};

// Checks that the payment is genuine, belongs to the order and is for the expected amount, then
// makes sure the money is captured (accounts with manual capture would otherwise auto-refund it).
const verifyPayment = async (payment, expectedAmount) => {
  if (!signatureValid(payment)) return false;
  const p = await client().payments.fetch(payment.paymentId);
  if (p.order_id !== payment.orderId || p.amount !== paise(expectedAmount) || p.currency !== 'INR') return false;
  if (p.status === 'authorized') await client().payments.capture(p.id, p.amount, 'INR');
  else if (p.status !== 'captured') return false;
  return true;
};

// Gives the money back when a paid booking could not be completed (e.g. the seat was taken while
// the traveller was paying). Never throws: the caller is already handling a failed booking.
const refundIfPaid = async (payment, reason) => {
  if (!paymentsEnabled() || !signatureValid(payment)) return false;
  try {
    const p = await client().payments.fetch(payment.paymentId);
    // An uncaptured payment is released automatically by Razorpay; only captured money needs a refund.
    if (p.status !== 'captured' || p.order_id !== payment.orderId) return false;
    await client().payments.refund(p.id, { amount: p.amount, notes: { reason: String(reason || 'Booking failed').slice(0, 250) } });
    console.log(`Refunded ${p.id}: ${reason}`);
    return true;
  } catch (error) {
    console.log(`Refund failed for ${payment.paymentId}:`, error.error?.description || error.message);
    return false;
  }
};

module.exports = { paymentsEnabled, createOrder, verifyPayment, refundIfPaid, signatureValid };
