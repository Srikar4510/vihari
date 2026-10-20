const { paymentsEnabled, createOrder } = require('../utils/payments');
const { QuoteError, busQuote, tourQuote } = require('../utils/pricing');

// Creates a payment order for a bus or tour booking. The amount is always computed here,
// never taken from the client. In demo mode (no Razorpay keys) it only returns the quote.
//   bus:  { type: 'bus', busId, seats: ['1A', ...], date: 'YYYY-MM-DD', passengers?: [{ seat, gender }] }
//   tour: { type: 'tour', tourId, travellers }
module.exports.createorder = async (req, res) => {
  try {
    const { type } = req.body;
    let quote;
    if (type === 'bus') quote = await busQuote(req.body.busId, req.body.seats, req.body.date, req.body.passengers);
    else if (type === 'tour') quote = await tourQuote(req.body.tourId, req.body.travellers);
    else return res.status(400).json({ error: "type must be 'bus' or 'tour'" });

    if (!paymentsEnabled()) {
      return res.json({ demo: true, amount: quote.amount });
    }
    const order = await createOrder(quote.amount, `${type}-${Date.now()}`);
    res.json({ demo: false, amount: quote.amount, orderId: order.id, keyId: process.env.RAZORPAY_KEY_ID });
  } catch (error) {
    if (error instanceof QuoteError) return res.status(error.status).json({ error: error.message });
    console.log(error);
    res.status(500).json({ error: 'Could not start the payment. Please try again.' });
  }
};
