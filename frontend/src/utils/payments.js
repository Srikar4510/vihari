import { API_URL } from '../config';
const API = API_URL;

const postJson = async (path, body, auth = false) => {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { 'auth-token': localStorage.getItem('token') || '' } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Something went wrong. Please try again.');
  return json;
};

// Asks the server for the price (and a Razorpay order when payments are live).
// Returns { demo, amount, orderId?, keyId? }.
export const createOrder = (payload) => postJson('/order', payload);

// Opens Razorpay checkout and resolves with { orderId, paymentId, signature } once paid.
// In demo mode there is no checkout, so it resolves straight away.
// A failed attempt does not end things: Razorpay keeps its window open with "Retry", and a later
// success still resolves. Only closing the window without paying rejects (with the last error).
export const collectPayment = (order, Razorpay, { description, prefill }) => {
  if (order.demo) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    let lastError = null;
    const rzp = new Razorpay({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount * 100,
      currency: 'INR',
      name: 'Vihari',
      description,
      prefill,
      theme: { color: '#29d9d5' },
      handler: (r) => resolve({ orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature }),
      modal: {
        ondismiss: () => reject(new Error(lastError ? `Payment failed: ${lastError}` : 'Payment cancelled')),
      },
    });
    rzp.on('payment.failed', (r) => { lastError = r.error?.description || 'the bank declined it'; });
    rzp.open();
  });
};

export const bookBus = (payload) => postJson('/booking', payload, true);
export const bookTour = (payload) => postJson('/api/tour/tourbooking', payload, true);
